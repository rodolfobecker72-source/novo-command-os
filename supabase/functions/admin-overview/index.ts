import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function sessionAal(authHeader: string): string | null {
  try {
    const payload = authHeader.replace(/^Bearer\s+/i, "").split(".")[1];
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4))).aal ?? null;
  } catch {
    return null;
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado" }, 401);

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return json({ error: "Não autenticado" }, 401);

    const { data: sysAdmin } = await admin
      .from("system_admins")
      .select("user_id")
      .eq("user_id", caller.id)
      .maybeSingle();
    if (!sysAdmin) return json({ error: "Acesso restrito ao administrador do sistema" }, 403);

    // The admin area requires 2-step verification: the session must be aal2.
    // getUser() above already validated this token with the auth server.
    if (sessionAal(authHeader) !== "aal2") {
      return json({ error: "Verificação em duas etapas necessária" }, 403);
    }

    // Optional action: update feedback status
    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* no body */ }
    if (body.action === "update_feedback_status") {
      const id = String(body.id ?? "");
      const status = String(body.status ?? "");
      if (!id || !["aberto", "em_analise", "resolvido", "descartado"].includes(status)) {
        return json({ error: "Parâmetros inválidos" }, 400);
      }
      const { error } = await admin.from("feedback_reports").update({ status }).eq("id", id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    // --- Empresas e usuários (calculado no banco) ---
    const { data: overview, error: overviewError } = await admin.rpc("admin_workspace_overview");
    if (overviewError) throw overviewError;

    const ACTIVE_MS = 30 * 24 * 60 * 60 * 1000;
    const isActive = (at: string | null) => Boolean(at) && Date.now() - new Date(at!).getTime() <= ACTIVE_MS;

    type OverviewUser = { user_id: string; last_seen_at: string | null };
    type OverviewWorkspace = {
      users: OverviewUser[];
      last_seen_at: string | null;
      clients: number;
      budgets: number;
      leads: number;
      projects: number;
    };
    const workspaces = (overview?.workspaces ?? []) as OverviewWorkspace[];
    const workspaceStats = workspaces.map((w) => ({ ...w, active: isActive(w.last_seen_at) }));

    const activeUsers = new Set<string>();
    for (const w of workspaces) {
      for (const u of w.users) if (isActive(u.last_seen_at)) activeUsers.add(u.user_id);
    }
    const sum = (key: "clients" | "budgets" | "leads" | "projects") =>
      workspaces.reduce((acc, w) => acc + (w[key] ?? 0), 0);

    // --- Landing leads (/home) ---
    const { data: landingLeads } = await admin
      .from("landing_leads")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    // --- Feedback reports ---
    const { data: feedback } = await admin
      .from("feedback_reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    // All attachment links in one request
    const allPaths = (feedback ?? []).flatMap((f) => (Array.isArray(f.images) ? (f.images as string[]) : []));
    const signedByPath = new Map<string, string>();
    if (allPaths.length) {
      const { data: signed } = await admin.storage.from("feedback-images").createSignedUrls(allPaths, 60 * 60);
      for (const item of signed ?? []) if (item.path && item.signedUrl) signedByPath.set(item.path, item.signedUrl);
    }
    const signedFeedback = (feedback ?? []).map((f) => ({
      ...f,
      imageUrls: (Array.isArray(f.images) ? (f.images as string[]) : [])
        .map((p) => signedByPath.get(p))
        .filter(Boolean),
    }));

    // --- Global totals ---
    const totals = {
      workspaces: workspaces.length,
      activeWorkspaces: workspaceStats.filter((w) => w.active).length,
      users: overview?.total_users ?? 0,
      activeUsers: activeUsers.size,
      clients: sum("clients"),
      budgets: sum("budgets"),
      leads: sum("leads"),
      projects: sum("projects"),
      landingLeads: landingLeads?.length ?? 0,
      feedback: feedback?.length ?? 0,
      openFeedback: (feedback ?? []).filter((f) => f.status === "aberto").length,
    };

    return json({
      totals,
      workspaces: workspaceStats,
      landingLeads: landingLeads ?? [],
      feedback: signedFeedback,
    });
  } catch (err) {
    console.error("[admin-overview]", err);
    return json({ error: (err as Error).message }, 500);
  }
});
