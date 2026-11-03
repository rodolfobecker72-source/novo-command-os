// Cancels the owner's subscription in Asaas. Access continues until the end of
// the period already paid (current_period_end).
import { adminClient, asaas, corsHeaders, getCaller, jsonResponse, ownerWorkspace } from "../_shared/asaas.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await getCaller(req);
    if (!user) return jsonResponse({ error: "Não autenticado" }, 401);

    const admin = adminClient();
    const workspaceId = await ownerWorkspace(admin, user.id);
    if (!workspaceId) return jsonResponse({ error: "Só o proprietário da empresa pode cancelar." }, 403);

    const { data: sub } = await admin
      .from("workspace_subscriptions")
      .select("asaas_subscription_id")
      .eq("workspace_id", workspaceId)
      .single();
    if (!sub?.asaas_subscription_id) return jsonResponse({ error: "Não há assinatura ativa." }, 409);

    await asaas(`/subscriptions/${encodeURIComponent(sub.asaas_subscription_id)}`, { method: "DELETE" });
    await admin
      .from("workspace_subscriptions")
      .update({ status: "canceled", canceled_at: new Date().toISOString() })
      .eq("workspace_id", workspaceId);

    return jsonResponse({ ok: true });
  } catch (e) {
    console.error("[billing-cancel]", e);
    return jsonResponse({ error: "Não foi possível cancelar. Tente novamente em instantes." }, 500);
  }
});
