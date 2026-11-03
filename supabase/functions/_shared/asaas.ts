// Asaas (cobrança do Command OS): chamadas à API e acesso às assinaturas.
//
// Segredos (Supabase > Edge Functions > Secrets):
//   ASAAS_API_KEY        chave da API (sandbox ou produção)
//   ASAAS_API_URL        https://api-sandbox.asaas.com/v3 (padrão) ou https://api.asaas.com/v3
//   ASAAS_WEBHOOK_TOKEN  o mesmo token configurado no webhook do Asaas
// Opcional: APP_URL (padrão https://acesso.command-os.app.br).
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export const APP_URL = (Deno.env.get("APP_URL") ?? "https://acesso.command-os.app.br").replace(/\/$/, "");
const API_URL = (Deno.env.get("ASAAS_API_URL") ?? "https://api-sandbox.asaas.com/v3").replace(/\/$/, "");

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

export async function getCaller(req: Request) {
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

/** The caller's company, if they are its owner (only the owner manages billing). */
export async function ownerWorkspace(admin: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await admin
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.role === "owner" ? data.workspace_id : null;
}

export function isConfigured(): boolean {
  return Boolean(Deno.env.get("ASAAS_API_KEY"));
}

export async function asaas(path: string, init: { method?: string; body?: unknown } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method: init.method ?? "GET",
    headers: {
      access_token: Deno.env.get("ASAAS_API_KEY") ?? "",
      "Content-Type": "application/json",
      "User-Agent": "CommandOS",
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const detail = data?.errors?.map((e: { description?: string }) => e.description).join("; ") || text;
    throw new Error(`Asaas ${res.status}: ${detail}`);
  }
  return data;
}

/** YYYY-MM-DD in São Paulo time. */
export function localDate(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

/** YYYY-MM-DD plus whole months (end of month clamps, e.g. 31/01 -> 28/02). */
export function addMonths(date: string, n: number): string {
  const [y, m, d] = date.slice(0, 10).split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + n, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

/** Constant-time comparison for the webhook token. */
export function safeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  if (ea.length !== eb.length) return false;
  let diff = 0;
  for (let i = 0; i < ea.length; i++) diff |= ea[i] ^ eb[i];
  return diff === 0;
}
