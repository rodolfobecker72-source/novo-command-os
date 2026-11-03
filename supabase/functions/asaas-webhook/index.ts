// Receives Asaas notifications and keeps workspace_subscriptions in sync.
//
// Asaas sends the token configured on the webhook in the asaas-access-token
// header. Delivery is at least once, so each event id is recorded in
// billing_events and processed only once; a failed event is left unprocessed
// and the 500 response makes Asaas send it again.
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { adminClient, addMonths, jsonResponse, safeEqual } from "../_shared/asaas.ts";

type Json = Record<string, any>;

const idOf = (v: unknown): string | null =>
  typeof v === "string" ? v : (v && typeof v === "object" && typeof (v as Json).id === "string" ? (v as Json).id : null);

/** The company a payment or subscription belongs to. */
async function findWorkspace(
  admin: SupabaseClient,
  ref: { subscription?: string | null; customer?: string | null; checkout?: string | null; external?: string | null },
): Promise<string | null> {
  const byColumn = async (column: string, value: string | null | undefined) => {
    if (!value) return null;
    const { data } = await admin.from("workspace_subscriptions").select("workspace_id").eq(column, value).limit(1).maybeSingle();
    return data?.workspace_id ?? null;
  };

  const found = (await byColumn("asaas_subscription_id", ref.subscription)) ?? (await byColumn("asaas_customer_id", ref.customer));
  if (found) return found;

  if (ref.checkout) {
    // The checkout's own events carry our workspace id as externalReference. Looking
    // them up keeps working when the owner opened another checkout afterwards.
    const { data } = await admin
      .from("billing_events")
      .select("payload")
      .like("event", "CHECKOUT_%")
      .eq("payload->checkout->>id", ref.checkout)
      .limit(1)
      .maybeSingle();
    const external = data?.payload?.checkout?.externalReference;
    if (typeof external === "string" && (await byColumn("workspace_id", external))) return external;
    const byCheckout = await byColumn("asaas_checkout_id", ref.checkout);
    if (byCheckout) return byCheckout;
  }

  // externalReference is our workspace id
  if (ref.external && /^[0-9a-f-]{36}$/i.test(ref.external)) return byColumn("workspace_id", ref.external);
  return null;
}

async function update(admin: SupabaseClient, workspaceId: string, values: Json) {
  const { error } = await admin.from("workspace_subscriptions").update(values).eq("workspace_id", workspaceId);
  if (error) throw error;
}

/** Asaas ids to follow the company's charges, when the event carries them. */
function links(subscription: unknown, customer: unknown): Json {
  const values: Json = {};
  if (typeof subscription === "string") values.asaas_subscription_id = subscription;
  if (typeof customer === "string") values.asaas_customer_id = customer;
  return values;
}

async function handle(admin: SupabaseClient, body: Json): Promise<string | null> {
  const event = String(body.event ?? "");

  // Card registered on the checkout page. During the trial the first charge is
  // scheduled for the trial end, so the company stays in trial until it is paid.
  if (event === "CHECKOUT_PAID") {
    const checkout = body.checkout ?? {};
    const workspaceId = await findWorkspace(admin, {
      checkout: checkout.id, customer: idOf(checkout.customer), external: checkout.externalReference,
    });
    if (!workspaceId) return null;
    const { data: current } = await admin
      .from("workspace_subscriptions").select("status, trial_ends_at").eq("workspace_id", workspaceId).single();
    const inTrial = current?.status === "trialing" && new Date(current.trial_ends_at).getTime() > Date.now();
    await update(admin, workspaceId, {
      status: inTrial ? "trialing" : "active",
      past_due_since: null,
      canceled_at: null,
      checkout_url: null,
      asaas_checkout_id: checkout.id ?? null,
      ...links(null, idOf(checkout.customer)),
    });
    return workspaceId;
  }

  // The subscription and its first charge are created by the checkout: they bring
  // the Asaas ids (and the checkout id in checkoutSession)
  if (event === "SUBSCRIPTION_CREATED" || event === "SUBSCRIPTION_UPDATED") {
    const s = body.subscription ?? {};
    if (s.deleted) return null;
    const workspaceId = await findWorkspace(admin, {
      subscription: s.id, customer: idOf(s.customer), checkout: s.checkoutSession, external: s.externalReference,
    });
    if (!workspaceId) return null;
    await update(admin, workspaceId, links(s.id, idOf(s.customer)));
    return workspaceId;
  }

  if (event === "PAYMENT_CREATED") {
    const p = body.payment ?? {};
    const workspaceId = await findWorkspace(admin, {
      subscription: p.subscription, customer: p.customer, checkout: p.checkoutSession, external: p.externalReference,
    });
    if (!workspaceId) return null;
    await update(admin, workspaceId, links(p.subscription, p.customer));
    return workspaceId;
  }

  if (event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED") {
    const p = body.payment ?? {};
    const workspaceId = await findWorkspace(admin, {
      subscription: p.subscription, customer: p.customer, checkout: p.checkoutSession, external: p.externalReference,
    });
    if (!workspaceId) return null;
    const values: Json = { status: "active", past_due_since: null, checkout_url: null, ...links(p.subscription, p.customer) };
    // The payment covers one month from its due date
    if (p.dueDate) values.current_period_end = addMonths(String(p.dueDate), 1);
    await update(admin, workspaceId, values);
    return workspaceId;
  }

  if (event === "PAYMENT_OVERDUE") {
    const p = body.payment ?? {};
    const workspaceId = await findWorkspace(admin, {
      subscription: p.subscription, customer: p.customer, checkout: p.checkoutSession, external: p.externalReference,
    });
    if (!workspaceId) return null;
    const { data: current } = await admin
      .from("workspace_subscriptions").select("status, past_due_since").eq("workspace_id", workspaceId).single();
    // The owner pays the overdue charge on its own Asaas page (checkout_url)
    const values: Json = { checkout_url: typeof p.invoiceUrl === "string" ? p.invoiceUrl : null };
    // The 3-day grace period counts from the first unpaid due date
    if (current?.status !== "past_due" || !current.past_due_since) {
      values.status = "past_due";
      values.past_due_since = p.dueDate ? `${String(p.dueDate).slice(0, 10)}T03:00:00Z` : new Date().toISOString();
    }
    await update(admin, workspaceId, values);
    return workspaceId;
  }

  if (event === "SUBSCRIPTION_DELETED" || event === "SUBSCRIPTION_INACTIVATED") {
    const s = body.subscription ?? {};
    const workspaceId = await findWorkspace(admin, {
      subscription: s.id, customer: idOf(s.customer), checkout: s.checkoutSession, external: s.externalReference,
    });
    if (!workspaceId) return null;
    // Only the company's current subscription ends its access
    const { data: current } = await admin
      .from("workspace_subscriptions").select("asaas_subscription_id").eq("workspace_id", workspaceId).single();
    if (current?.asaas_subscription_id && current.asaas_subscription_id !== s.id) return workspaceId;
    await update(admin, workspaceId, { status: "canceled", canceled_at: new Date().toISOString() });
    return workspaceId;
  }

  // Other events (checkout created, refunds, ...) are only recorded
  return null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return jsonResponse({ error: "method not allowed" }, 405);

  const token = Deno.env.get("ASAAS_WEBHOOK_TOKEN") ?? "";
  if (!token || !safeEqual(req.headers.get("asaas-access-token") ?? "", token)) {
    return jsonResponse({ error: "forbidden" }, 401);
  }

  let body: Json;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid json" }, 400);
  }

  const admin = adminClient();
  const eventId = String(
    body.id ?? `${body.event}:${body.payment?.id ?? body.checkout?.id ?? body.subscription?.id ?? ""}:${body.dateCreated ?? ""}`,
  );

  // Record first; skip events already processed
  await admin.from("billing_events").upsert(
    { id: eventId, event: String(body.event ?? ""), payload: body },
    { onConflict: "id", ignoreDuplicates: true },
  );
  const { data: existing } = await admin.from("billing_events").select("processed_at").eq("id", eventId).single();
  if (existing?.processed_at) return jsonResponse({ ok: true, duplicate: true });

  try {
    const workspaceId = await handle(admin, body);
    await admin.from("billing_events")
      .update({ processed_at: new Date().toISOString(), workspace_id: workspaceId, error: null })
      .eq("id", eventId);
    return jsonResponse({ ok: true });
  } catch (e) {
    console.error("[asaas-webhook]", body.event, e);
    await admin.from("billing_events").update({ error: String(e).slice(0, 1000) }).eq("id", eventId);
    return jsonResponse({ error: "processing failed" }, 500);
  }
});
