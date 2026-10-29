// Google Calendar with the app's own OAuth client.
//
// Each user grants access to calendars this app creates
// (calendar.app.created); on connect we create a "Command OS" calendar in
// their account and only ever write there. Refresh and access tokens are
// stored AES-GCM encrypted (key in GCAL_TOKEN_KEY) in
// google_calendar_connections, which only the service role can read.
//
// Required secrets: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GCAL_TOKEN_KEY
// (base64, 32 bytes). Optional: APP_URL (default https://acesso.command-os.app.br).
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { TIME_ZONE } from "./calendarEvents.ts";

export const APP_URL = (Deno.env.get("APP_URL") ?? "https://acesso.command-os.app.br").replace(/\/$/, "");
export const REDIRECT_URI = `${APP_URL}/auth/google-calendar-callback`;
export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.app.created";
const SCOPES = ["openid", "email", CALENDAR_SCOPE];
const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function adminClient(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

/** The logged-in user calling the function, or null. */
export async function getCaller(req: Request) {
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

export function isConfigured(): boolean {
  return Boolean(
    Deno.env.get("GOOGLE_CLIENT_ID") && Deno.env.get("GOOGLE_CLIENT_SECRET") && Deno.env.get("GCAL_TOKEN_KEY"),
  );
}

// ============================================================================
// Encoding and token encryption
// ============================================================================
function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64(s: string) {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function randomToken(bytes = 32): string {
  return base64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

let tokenKey: Promise<CryptoKey> | null = null;
function getTokenKey(): Promise<CryptoKey> {
  tokenKey ??= crypto.subtle.importKey(
    "raw",
    fromBase64(Deno.env.get("GCAL_TOKEN_KEY") ?? ""),
    "AES-GCM",
    false,
    ["encrypt", "decrypt"],
  );
  return tokenKey;
}

export async function encrypt(plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await getTokenKey(), new TextEncoder().encode(plain));
  const out = new Uint8Array(iv.length + data.byteLength);
  out.set(iv);
  out.set(new Uint8Array(data), iv.length);
  return base64url(out);
}

export async function decrypt(enc: string): Promise<string> {
  const bytes = fromBase64(enc);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.slice(0, 12) }, await getTokenKey(), bytes.slice(12));
  return new TextDecoder().decode(plain);
}

/** Constant-time string comparison for shared secrets. */
export function safeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  if (ea.length !== eb.length) return false;
  let diff = 0;
  for (let i = 0; i < ea.length; i++) diff |= ea[i] ^ eb[i];
  return diff === 0;
}

// ============================================================================
// OAuth
// ============================================================================
export function authorizeUrl(state: string, codeChallenge: string): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  }).toString();
  return url.toString();
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
}

/** The user revoked access or the refresh token expired: they must connect again. */
export class NeedsReconnectError extends Error {}
/** Temporary failure (rate limit, Google outage): try again later. */
export class RetryableError extends Error {}

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
      ...params,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (res.ok) return body as TokenResponse;
  if (body?.error === "invalid_grant") throw new NeedsReconnectError(body.error_description ?? "invalid_grant");
  if (res.status >= 500 || res.status === 429) throw new RetryableError(`token ${res.status}`);
  throw new Error(`token ${res.status}: ${body?.error ?? ""} ${body?.error_description ?? ""}`.trim());
}

export function exchangeCode(code: string, codeVerifier: string): Promise<TokenResponse> {
  return tokenRequest({ grant_type: "authorization_code", code, code_verifier: codeVerifier, redirect_uri: REDIRECT_URI });
}

export async function revokeToken(token: string): Promise<void> {
  await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
  }).catch(() => undefined);
}

/** Email from the id_token returned directly by Google's token endpoint. */
export function emailFromIdToken(idToken: string | undefined): string | null {
  if (!idToken) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(fromBase64(idToken.split(".")[1])));
    return typeof payload.email === "string" ? payload.email : null;
  } catch {
    return null;
  }
}

// ============================================================================
// Calendar API
// ============================================================================
export interface ApiResult {
  status: number;
  ok: boolean;
  data: any;
}

export async function calendarApi(accessToken: string, path: string, init: { method?: string; body?: unknown } = {}): Promise<ApiResult> {
  const res = await fetch(`${CALENDAR_API}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  if (res.status === 401) throw new NeedsReconnectError("calendar 401");
  const reason = data?.error?.errors?.[0]?.reason;
  if (res.status === 429 || res.status >= 500 || (res.status === 403 && /rateLimitExceeded|userRateLimitExceeded/.test(reason ?? ""))) {
    throw new RetryableError(`calendar ${res.status} ${reason ?? ""}`.trim());
  }
  return { status: res.status, ok: res.ok, data };
}

export async function createAppCalendar(accessToken: string): Promise<string> {
  const r = await calendarApi(accessToken, "/calendars", {
    method: "POST",
    body: { summary: "Command OS", description: "Atividades e compromissos do Command OS", timeZone: TIME_ZONE },
  });
  if (!r.ok || !r.data?.id) throw new Error(`create calendar ${r.status}: ${JSON.stringify(r.data)}`);
  return r.data.id as string;
}

// ============================================================================
// Per-user connections
// ============================================================================
export interface Connection {
  user_id: string;
  email: string | null;
  refresh_token_enc: string;
  access_token_enc: string | null;
  access_token_expires_at: string | null;
  calendar_id: string;
  status: "connected" | "needs_reconnect";
}

/** Columns to save for a token response (refresh token only when Google sends one). */
export async function encryptTokens(tokens: TokenResponse): Promise<Record<string, unknown>> {
  const update: Record<string, unknown> = {
    access_token_enc: await encrypt(tokens.access_token),
    access_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
  };
  if (tokens.refresh_token) update.refresh_token_enc = await encrypt(tokens.refresh_token);
  return update;
}

/**
 * A valid access token for the connection, refreshing it when it is about
 * to expire. Marks the connection as needing reconnection when Google
 * refuses the refresh token.
 */
export async function getAccessToken(admin: SupabaseClient, conn: Connection): Promise<string> {
  const expiresAt = conn.access_token_expires_at ? new Date(conn.access_token_expires_at).getTime() : 0;
  if (conn.access_token_enc && expiresAt - Date.now() > 60_000) {
    return decrypt(conn.access_token_enc);
  }
  try {
    const tokens = await tokenRequest({ grant_type: "refresh_token", refresh_token: await decrypt(conn.refresh_token_enc) });
    const update = await encryptTokens(tokens);
    await admin.from("google_calendar_connections").update(update).eq("user_id", conn.user_id);
    Object.assign(conn, update);
    return tokens.access_token;
  } catch (e) {
    if (e instanceof NeedsReconnectError) await markNeedsReconnect(admin, conn, e.message);
    throw e;
  }
}

export async function markNeedsReconnect(admin: SupabaseClient, conn: Connection, reason: string) {
  conn.status = "needs_reconnect";
  await admin
    .from("google_calendar_connections")
    .update({ status: "needs_reconnect", last_error: reason.slice(0, 500), access_token_enc: null, access_token_expires_at: null })
    .eq("user_id", conn.user_id);
}
