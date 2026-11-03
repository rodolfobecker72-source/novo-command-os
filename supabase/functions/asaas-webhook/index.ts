// Receives Asaas notifications and keeps workspace_subscriptions in sync.
//
// Asaas sends the token configured on the webhook in the asaas-access-token
// header. Delivery is at least once, so each event id is recorded in
// billing_events and processed only once; a failed event is left unprocessed
// and the 500 response makes Asaas send it again.
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { adminClient, asaas, addMonths, jsonResponse, safeEqual } from "../_shared/asaas.ts";

type Json = Record<string, any>;

const idOf = (v: unknown): string | null =>
  typeof v === "string" ? v : (v && typeof v === "object" && typeof (v as Json).id === "string" ? (v as Json).id : null);

/** The company a payment or subscription belongs to. */
async function findWorkspace(
  admin: SupabaseClient,
  ref: { subscription?: string | null; customer?: string | null; checkout?: string | null; external?: string | null },
): Promise<string | null> {
  const lookups: [string, string | null | undefined][] = [
    ["asaas_subscription_id", ref.subscription],
    ["asaas_checkout_id", ref.checkout],
    ["asaas_customer_id", ref.customer],
  ];
  for (const [column, value] of lookups) {
    if (!value) continue;
    const { data } = await admin.from("workspace_subscriptions").select("workspace_id").eq(column, value).limit(1).maybeSingle();
    if (data) return data.workspace_id;
  }
  // externalReference is our workspace id
  if (ref.external && /^[0-9a-f-]{36}$/i.test(ref.external)) {
    const { data } = await admin.from("workspace_subscriptions").select("workspace_id").eq("workspace_id", ref.external).maybeSingle();
    if (data) return data.workspace_id;
  }
  return null;
}

async function update(admin: SupabaseClient, workspaceId: string, values: Json) {
  const { error } = await admin.from("workspace_subscriptions").update(values).eq("workspace_id", workspaceId);
  if (error) throw error;
}

async function handle(admin: SupabaseClient, body: Json): Promise<string | null> {
  const event = String(body.event ?? "");

  if (event === "CHECKOUT_PAID") {
    const checkout = body.checkout ?? {};
    const customer = idOf(checkout.customer);
    const workspaceId = await findWorkspace(admin, {
      checkout: checkout.id, customer, external: checkout.externalReference,
    });
    if (!workspaceId) return null;

    const values: Json = { status: "active", past_due_since: null, canceled_at: null, checkout_url: null };
    if (customer) {
      values.asaas_customer_id = customer;
      // The checkout created the subscription: find it to follow its charges
      const list = await asaas(`/subscriptions?customer=${encodeURIComponent(customer)}&limit=10`);
      const subs = ((list?.data ?? []) as Json[]).filter((s) => s.status === "ACTIVE" && !s.deleted);
      subs.sort((a, b) => String(b.dateCreated ?? "").localeCompare(String(a.dateCreated ?? "")));
      if (subs[0]) {
        values.asaas_subscription_id = subs[0].id;
        if (subs[0].nextDueDate) values.current_period_end = String(subs[0].nextDueDate).slice(0, 10);
      }
    }
    await update(admin, workspaceId, values);
    return workspaceId;
  }

  if (event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED") {
    const p = body.payment ?? {};
    const workspaceId = await findWorkspace(admin, {
      subscription: p.subscription, customer: p.customer, external: p.externalReference,
    });
    if (!workspaceId) return null;
    const values: Json = { status: "active", past_due_since: null };
    if (p.subscription) values.asaas_subscription_id = p.subscription;
    if (p.customer) values.asaas_customer_id = p.customer;
    // The payment covers one month from its due date
    if (p.dueDate) values.current_period_end = addMonths(String(p.dueDate), 1);
    await update(admin, workspaceId, values);
    return workspaceId;
  }

  if (event === "PAYMENT_OVERDUE") {
    const p = body.payment ?? {};
    const workspaceId = await findWorkspace(admin, {
      subscription: p.subscription, customer: p.customer, external: p.externalReference,
    });
    if (!workspaceId) return null;
    const { data: current } = await admin
      .from("workspace_subscriptions").select("status, past_due_since").eq("workspace_id", workspaceId).single();
    // The 3-day grace period counts from the first unpaid due date
    if (current?.status !== "past_due" || !current.past_due_since) {
      await update(admin, workspaceId, {
        status: "past_due",
        past_due_since: p.dueDate ? `${String(p.dueDate).slice(0, 10)}T03:00:00Z` : new Date().toISOString(),
      });
    }
    return workspaceId;
  }

  if (event === "SUBSCRIPTION_DELETED" || event === "SUBSCRIPTION_INACTIVATED") {
    const s = body.subscription ?? {};
    const workspaceId = await findWorkspace(admin, { subscription: s.id, customer: idOf(s.customer), external: s.externalReference });
    if (!workspaceId) return null;
    await update(admin, workspaceId, { status: "canceled", canceled_at: new Date().toISOString() });
    return workspaceId;
  }

  // Other events (payment created, refunds, ...) are only recorded
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
