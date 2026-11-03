// Cancels the owner's subscription in Asaas and records why. Access continues
// until the end of the period already paid (current_period_end) or of the trial.
import { adminClient, asaas, corsHeaders, getCaller, jsonResponse, ownerWorkspace } from "../_shared/asaas.ts";

const REASONS = ["preco", "faltou_recurso", "nao_usei", "outro_sistema", "outro"];

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

    const { reason, note } = await req.json().catch(() => ({}));
    if (!REASONS.includes(reason)) return jsonResponse({ error: "Escolha o motivo do cancelamento." }, 400);

    await asaas(`/subscriptions/${encodeURIComponent(sub.asaas_subscription_id)}`, { method: "DELETE" });
    await admin
      .from("workspace_subscriptions")
      .update({ status: "canceled", canceled_at: new Date().toISOString() })
      .eq("workspace_id", workspaceId);
    await admin.from("subscription_cancellations").insert({
      workspace_id: workspaceId,
      user_id: user.id,
      reason,
      note: typeof note === "string" ? note.trim().slice(0, 2000) : "",
    });

    return jsonResponse({ ok: true });
  } catch (e) {
    console.error("[billing-cancel]", e);
    return jsonResponse({ error: "Não foi possível cancelar. Tente novamente em instantes." }, 500);
  }
});
