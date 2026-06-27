import { randomUUID } from "crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { dispatchEvent } from "@/lib/dispatch";
import { hashPhone } from "@/lib/hash";

// ponytail: deteccao de "lead fechou" e por NOME da etapa ("vendido",
// case-insensitive) -- se a agencia renomear a etapa, isso para de disparar.
// Upgrade: flag booleana dedicada em pipeline_stages se isso virar problema.
const SOLD_STAGE_NAME = "vendido";

export async function maybeDispatchPurchaseForLead(leadId: string, clientId: string) {
  const supabase = createServiceClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("id, phone, revenue, ctwa_clid, capi_purchase_sent_at, stage_id")
    .eq("id", leadId)
    .single();
  if (!lead || lead.capi_purchase_sent_at || !lead.revenue || !lead.phone) return;

  const { data: stage } = await supabase
    .from("pipeline_stages")
    .select("name")
    .eq("id", lead.stage_id)
    .single();
  if (!stage || stage.name.trim().toLowerCase() !== SOLD_STAGE_NAME) return;

  const eventId = randomUUID();
  const result = await dispatchEvent({
    clientId,
    eventName: "Purchase",
    eventId,
    ip: "",
    userAgent: null,
    visitor: { ctwa_clid: lead.ctwa_clid, phone_hash: hashPhone(lead.phone) },
    phoneHash: hashPhone(lead.phone),
    customData: { value: lead.revenue, currency: "BRL" },
  });

  await supabase
    .from("leads")
    .update({ capi_purchase_sent_at: new Date().toISOString() })
    .eq("id", leadId);

  await supabase.from("events_log").insert({
    client_id: clientId,
    event_name: "Purchase",
    event_id: eventId,
    payload_meta: result.payloadMeta,
    response_meta: result.responseMeta,
  });
}
