// Starts (or restarts) the owner's subscription: creates an Asaas Checkout for a
// monthly credit-card subscription and returns its link. The card is typed on
// Asaas's page; confirmation arrives later through asaas-webhook.
import {
  adminClient, APP_URL, asaas, addMonths, corsHeaders, getCaller, isConfigured, jsonResponse, localDate,
  ownerWorkspace,
} from "../_shared/asaas.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await getCaller(req);
    if (!user) return jsonResponse({ error: "Não autenticado" }, 401);
    if (!isConfigured()) return jsonResponse({ error: "A cobrança ainda não foi configurada." }, 503);

    const admin = adminClient();
    const workspaceId = await ownerWorkspace(admin, user.id);
    if (!workspaceId) return jsonResponse({ error: "Só o proprietário da empresa pode assinar." }, 403);

    const { data: sub, error } = await admin
      .from("workspace_subscriptions")
      .select("status, trial_ends_at, asaas_subscription_id, checkout_url, billing_plans(name, price)")
      .eq("workspace_id", workspaceId)
      .single();
    if (error || !sub) throw error ?? new Error("subscription row missing");
    if (sub.asaas_subscription_id && sub.status !== "canceled") {
      // Overdue charge: pay it on its Asaas page instead of starting a second subscription
      if (sub.status === "past_due" && sub.checkout_url) return jsonResponse({ url: sub.checkout_url });
      return jsonResponse({ error: "A assinatura já está ativa." }, 409);
    }
    const plan = sub.billing_plans as unknown as { name: string; price: number };

    // During the trial the first charge happens when the trial ends
    const today = localDate(new Date());
    const trialEnd = localDate(new Date(sub.trial_ends_at));
    const firstDue = sub.status === "trialing" && trialEnd > today ? trialEnd : today;

    const checkout = await asaas("/checkouts", {
      method: "POST",
      body: {
        billingTypes: ["CREDIT_CARD"],
        chargeTypes: ["RECURRENT"],
        minutesToExpire: 60,
        externalReference: workspaceId,
        callback: {
          successUrl: `${APP_URL}/assinatura?retorno=sucesso`,
          cancelUrl: `${APP_URL}/assinatura`,
          expiredUrl: `${APP_URL}/assinatura`,
        },
        items: [{ name: plan.name, description: "Assinatura mensal", quantity: 1, value: Number(plan.price) }],
        subscription: { cycle: "MONTHLY", nextDueDate: firstDue, endDate: addMonths(firstDue, 120) },
      },
    });
    const url = checkout?.link ?? checkout?.url;
    if (!checkout?.id || !url) throw new Error(`checkout without link: ${JSON.stringify(checkout)}`);

    await admin
      .from("workspace_subscriptions")
      .update({ asaas_checkout_id: checkout.id, checkout_url: url })
      .eq("workspace_id", workspaceId);

    return jsonResponse({ url });
  } catch (e) {
    console.error("[billing-checkout]", e);
    return jsonResponse({ error: "Não foi possível abrir o pagamento. Tente novamente em instantes." }, 500);
  }
});
