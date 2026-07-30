import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    // --- Workspaces + members ---
    const [{ data: workspaces }, { data: members }, { data: profiles }] = await Promise.all([
      admin.from("workspaces").select("id, name, created_at, created_by").order("created_at"),
      admin.from("workspace_members").select("id, workspace_id, user_id, role, joined_at"),
      admin.from("profiles").select("id, name, photo_url, created_at"),
    ]);

    const { data: authUsers } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const emailMap = new Map<string, string>();
    const lastSignInMap = new Map<string, string | null>();
    for (const u of authUsers?.users ?? []) {
      emailMap.set(u.id, u.email ?? "");
      lastSignInMap.set(u.id, u.last_sign_in_at ?? null);
    }
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    // --- Per-workspace counts ---
    const countBy = async (table: string) => {
      const { data } = await admin.from(table).select("workspace_id");
      const map = new Map<string, number>();
      for (const row of (data ?? []) as { workspace_id: string }[]) {
        map.set(row.workspace_id, (map.get(row.workspace_id) ?? 0) + 1);
      }
      return map;
    };

    const [clientsMap, budgetsMap, leadsMap, projectsMap] = await Promise.all([
      countBy("clients"),
      countBy("budgets"),
      countBy("prospection_leads"),
      countBy("project_cards"),
    ]);

    const workspaceStats = (workspaces ?? []).map((w) => {
      const wsMembers = (members ?? []).filter((m) => m.workspace_id === w.id);
      return {
        id: w.id,
        name: w.name,
        created_at: w.created_at,
        users: wsMembers.map((m) => ({
          user_id: m.user_id,
          role: m.role,
          joined_at: m.joined_at,
          name: profileMap.get(m.user_id)?.name ?? "",
          email: emailMap.get(m.user_id) ?? "",
          last_sign_in_at: lastSignInMap.get(m.user_id) ?? null,
        })),
        userCount: wsMembers.length,
        clients: clientsMap.get(w.id) ?? 0,
        budgets: budgetsMap.get(w.id) ?? 0,
        leads: leadsMap.get(w.id) ?? 0,
        projects: projectsMap.get(w.id) ?? 0,
      };
    });

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

    const signedFeedback = [];
    for (const f of feedback ?? []) {
      const paths: string[] = Array.isArray(f.images) ? (f.images as string[]) : [];
      const urls: string[] = [];
      for (const p of paths) {
        const { data: signed } = await admin.storage
          .from("feedback-images")
          .createSignedUrl(p, 60 * 60);
        if (signed?.signedUrl) urls.push(signed.signedUrl);
      }
      signedFeedback.push({ ...f, imageUrls: urls });
    }

    // --- Global totals ---
    const totals = {
      workspaces: workspaces?.length ?? 0,
      users: authUsers?.users?.length ?? 0,
      members: members?.length ?? 0,
      clients: [...clientsMap.values()].reduce((a, b) => a + b, 0),
      budgets: [...budgetsMap.values()].reduce((a, b) => a + b, 0),
      leads: [...leadsMap.values()].reduce((a, b) => a + b, 0),
      projects: [...projectsMap.values()].reduce((a, b) => a + b, 0),
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
