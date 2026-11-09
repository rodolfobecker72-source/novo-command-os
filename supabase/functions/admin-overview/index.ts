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

    // Optional action: grant or remove courtesy (full access with no charge)
    if (body.action === "set_courtesy") {
      const workspaceId = String(body.workspace_id ?? "");
      if (!/^[0-9a-f-]{36}$/i.test(workspaceId) || typeof body.courtesy !== "boolean") {
        return json({ error: "Parâmetros inválidos" }, 400);
      }
      const { data: sub, error: subError } = await admin
        .from("workspace_subscriptions")
        .select("status, asaas_subscription_id")
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      if (subError) return json({ error: subError.message }, 400);
      if (!sub) return json({ error: "Empresa não encontrada" }, 404);

      if (body.courtesy) {
        if (sub.status === "courtesy") return json({ ok: true });
        // A live Asaas subscription would keep charging and its events would undo the courtesy
        if (sub.asaas_subscription_id && sub.status !== "canceled") {
          return json({ error: "Esta empresa tem uma assinatura ativa no Asaas. Cancele a assinatura antes de dar cortesia." }, 409);
        }
        const { error } = await admin.from("workspace_subscriptions")
          .update({ status: "courtesy", past_due_since: null, checkout_url: null })
          .eq("workspace_id", workspaceId);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }

      if (sub.status !== "courtesy") return json({ ok: true });
      // Back to a 7-day trial, so the owner has time to subscribe
      const { error } = await admin.from("workspace_subscriptions")
        .update({
          status: "trialing",
          trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          current_period_end: null,
          canceled_at: null,
        })
        .eq("workspace_id", workspaceId);
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
      subscription: { status: string; access: string; price: number } | null;
      last_seen_at: string | null;
      clients: number;
      budgets: number;
      leads: number;
      projects: number;
    };
    const workspaces = (overview?.workspaces ?? []) as OverviewWorkspace[];
    const workspaceStats = workspaces.map((w) => ({ ...w, active: isActive(w.last_seen_at), ai_uses_30d: 0 }));

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

    // --- Cancelamentos (motivo informado pelo proprietário) ---
    const { data: cancellationRows } = await admin
      .from("subscription_cancellations")
      .select("id, workspace_id, reason, note, created_at, workspaces(name)")
      .order("created_at", { ascending: false })
      .limit(200);
    const cancellations = (cancellationRows ?? []).map((c) => ({
      id: c.id,
      workspace_id: c.workspace_id,
      workspace_name: (c.workspaces as unknown as { name: string } | null)?.name ?? "",
      reason: c.reason,
      note: c.note,
      created_at: c.created_at,
    }));

    // --- Uso de IA nos últimos 30 dias (Claude Haiku 5.5: US$ 0,10 / 0,50 por milhão de tokens) ---
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: aiRows } = await admin
      .from("ai_usage")
      .select("workspace_id, input_tokens, output_tokens")
      .gte("created_at", since)
      .limit(100000);
    const aiByWorkspace = new Map<string, number>();
    let aiInput = 0;
    let aiOutput = 0;
    for (const r of aiRows ?? []) {
      aiByWorkspace.set(r.workspace_id, (aiByWorkspace.get(r.workspace_id) ?? 0) + 1);
      aiInput += r.input_tokens ?? 0;
      aiOutput += r.output_tokens ?? 0;
    }

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
      // Billing: paying = active or within the grace period of an unpaid invoice
      paying: workspaces.filter((w) => w.subscription && ["active", "past_due"].includes(w.subscription.status)).length,
      trialing: workspaces.filter((w) => w.subscription?.status === "trialing").length,
      courtesy: workspaces.filter((w) => w.subscription?.status === "courtesy").length,
      readOnly: workspaces.filter((w) => w.subscription?.access === "read_only").length,
      mrr: workspaces
        .filter((w) => w.subscription && ["active", "past_due"].includes(w.subscription.status))
        .reduce((acc, w) => acc + Number(w.subscription!.price ?? 0), 0),
      landingLeads: landingLeads?.length ?? 0,
      feedback: feedback?.length ?? 0,
      openFeedback: (feedback ?? []).filter((f) => f.status === "aberto").length,
      aiUses30d: aiRows?.length ?? 0,
      aiCostUsd30d: Math.round(((aiInput * 0.10 + aiOutput * 0.50) / 1_000_000) * 100) / 100,
    };
    for (const w of workspaceStats) w.ai_uses_30d = aiByWorkspace.get((w as unknown as { id: string }).id) ?? 0;

    return json({
      totals,
      workspaces: workspaceStats,
      landingLeads: landingLeads ?? [],
      feedback: signedFeedback,
      cancellations,
    });
  } catch (err) {
    console.error("[admin-overview]", err);
    return json({ error: (err as Error).message }, 500);
  }
});
