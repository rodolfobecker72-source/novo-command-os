// Shared helper for Google Calendar App User Connector via Lovable connector gateway.
// FLOW (connection-key):
//   1. POST /api/v1/app-users/oauth2/authorize with client key
//      -> returns { authorization_url, session_id }. Store session_id per user.
//   2. User completes Google OAuth. Google redirects to the gateway callback.
//      The gateway redirects to our return_url with `code` (and success=true).
//   3. POST /api/v1/app-users/oauth2/exchange with { session_id, code }
//      -> returns a per-user `connection_key` (lovack_*). Store per user.
//   4. Provider API calls: X-Connection-Api-Key = <per-user connection_key>
//      (NOT the shared client key). Bearer LOVABLE_API_KEY still required.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const GATEWAY_BASE = "https://connector-gateway.lovable.dev";
export const CONNECTOR_ID = "google_calendar";

export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
];

function requireEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export function getGatewayCreds() {
  return {
    lovableKey: requireEnv("LOVABLE_API_KEY"),
    clientKey: requireEnv("GOOGLE_CALENDAR_APP_USER_CONNECTOR_CLIENT_API_KEY"),
  };
}

export function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

// STEP 1: Start authorize. Returns URL + session_id.
export async function startAuthorize(opts: {
  appUserId: string;
  returnUrl: string;
  scopes?: string[];
}): Promise<{ authorization_url: string; session_id: string }> {
  const { lovableKey, clientKey } = getGatewayCreds();
  const res = await fetch(`${GATEWAY_BASE}/api/v1/app-users/oauth2/authorize`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableKey}`,
      "X-Client-Api-Key": clientKey,
    },
    body: JSON.stringify({
      connector_id: CONNECTOR_ID,
      app_user_id: opts.appUserId,
      return_url: opts.returnUrl,
      credentials_configuration: { scopes: opts.scopes ?? GOOGLE_CALENDAR_SCOPES },
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`authorize [${res.status}]: ${text}`);
  return JSON.parse(text);
}

// STEP 3: Exchange code for per-user connection_key.
export async function exchangeCode(opts: {
  sessionId: string;
  code: string;
}): Promise<{ connection_key: string; raw: any }> {
  const { lovableKey, clientKey } = getGatewayCreds();
  const res = await fetch(`${GATEWAY_BASE}/api/v1/app-users/oauth2/exchange`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableKey}`,
      "X-Client-Api-Key": clientKey,
    },
    body: JSON.stringify({
      connector_id: CONNECTOR_ID,
      session_id: opts.sessionId,
      code: opts.code,
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`exchange [${res.status}]: ${text}`);
  const raw = JSON.parse(text);
  const key = raw.connection_key ?? raw.connection_api_key ?? raw.api_key ?? raw.key;
  if (!key) throw new Error(`exchange missing connection_key: ${text}`);
  return { connection_key: key, raw };
}

// Provider API calls, using the stored per-user connection_key.
export async function callAsUser(opts: {
  connectionKey: string;
  path: string;
  method?: string;
  body?: unknown;
  query?: Record<string, string>;
}): Promise<{ status: number; ok: boolean; data: any; text: string }> {
  const { lovableKey } = getGatewayCreds();
  const url = new URL(`${GATEWAY_BASE}/${CONNECTOR_ID}${opts.path}`);
  if (opts.query) for (const [k, v] of Object.entries(opts.query)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), {
    method: opts.method ?? "GET",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": opts.connectionKey,
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* keep null */ }
  return { status: res.status, ok: res.ok, data, text };
}

// Load a user's stored connection_key. Returns null if not connected yet.
export async function getUserConnectionKey(userId: string): Promise<string | null> {
  const admin = adminClient();
  const { data } = await admin
    .from("google_calendar_connections")
    .select("connection_key")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.connection_key ?? null;
}

export async function getConnectionStatus(userId: string): Promise<{ connected: boolean; email?: string }> {
  const admin = adminClient();
  const { data: row } = await admin
    .from("google_calendar_connections")
    .select("connection_key, email")
    .eq("user_id", userId)
    .maybeSingle();
  if (!row?.connection_key) return { connected: false };

  // Quick verify with a light Google call; if it 401s, treat as disconnected.
  const probe = await callAsUser({
    connectionKey: row.connection_key,
    path: "/calendar/v3/users/me/calendarList",
    query: { maxResults: "1" },
  });
  if (probe.status === 401) return { connected: false };
  return { connected: probe.ok, email: row.email ?? undefined };
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, DELETE",
};

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
