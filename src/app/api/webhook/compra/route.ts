import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isRateLimited } from "@/lib/rate-limit";
import { hashPii, hashPhone } from "@/lib/hash";
import { normalizePurchase } from "@/lib/webhooks/normalize";
import { dispatchEvent } from "@/lib/dispatch";

const APPROVED_STATUSES = new Set([
  "approved",
  "completed",
  "complete",
  "paid",
  "purchase_approved",
]);

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(`webhook:${ip}`)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const platform = url.searchParams.get("platform") ?? "generic";
  if (!token) return NextResponse.json({ error: "token é obrigatório" }, { status: 401 });

  const supabase = createServiceClient();
  const { data: settings } = await supabase
    .from("settings")
    .select("client_id, currency")
    .eq("webhook_token", token)
    .maybeSingle();
  if (!settings) return NextResponse.json({ error: "token inválido" }, { status: 401 });

  const rawBody = await request.json().catch(() => null);
  if (!rawBody) return NextResponse.json({ error: "payload inválido" }, { status: 400 });

  const purchase = normalizePurchase(platform, rawBody);
  if (!purchase.transactionId) {
    return NextResponse.json({ error: "transaction_id não encontrado no payload" }, { status: 400 });
  }

  const emailHash = purchase.email ? hashPii(purchase.email) : null;
  const phoneHash = purchase.phone ? hashPhone(purchase.phone) : null;

  // vinculacao: por trck_user_id (completo ou os 8 chars do link de
  // redirecionamento), com fallback pra email/telefone.
  let visitor = null as Awaited<ReturnType<typeof findVisitorById>> | null;
  let matchMethod = "none";
  if (purchase.trckUserId) {
    visitor = await findVisitorById(supabase, settings.client_id, purchase.trckUserId);
    if (visitor) matchMethod = "trck_user_id";
  }
  if (!visitor && emailHash) {
    visitor = await findVisitorByHash(supabase, settings.client_id, "email_hash", emailHash);
    if (visitor) matchMethod = "email";
  }
  if (!visitor && phoneHash) {
    visitor = await findVisitorByHash(supabase, settings.client_id, "phone_hash", phoneHash);
    if (visitor) matchMethod = "phone";
  }

  const isApproved = APPROVED_STATUSES.has(purchase.status.toLowerCase());
  const metaEventId = `purchase_${purchase.transactionId}`;

  const { data: existing } = await supabase
    .from("purchases")
    .select("id, status")
    .eq("client_id", settings.client_id)
    .eq("transaction_id", purchase.transactionId)
    .maybeSingle();
  const alreadyDispatched = existing?.status?.toLowerCase() === "paid";

  const { data: savedPurchase, error: upsertErr } = await supabase
    .from("purchases")
    .upsert(
      {
        client_id: settings.client_id,
        transaction_id: purchase.transactionId,
        trck_user_id: visitor?.trck_user_id ?? null,
        email_hash: emailHash,
        phone_hash: phoneHash,
        produto: purchase.productName,
        valor: purchase.value,
        moeda: purchase.currency ?? settings.currency,
        status: isApproved ? "paid" : purchase.status,
        utm_source: purchase.utmSource ?? visitor?.utm_source ?? null,
        utm_medium: purchase.utmMedium ?? visitor?.utm_medium ?? null,
        utm_campaign: purchase.utmCampaign ?? visitor?.utm_campaign ?? null,
        fbp: visitor?.fbp ?? null,
        fbc: visitor?.fbc ?? null,
        match_method: matchMethod,
        meta_event_id: metaEventId,
        webhook_raw: rawBody,
      },
      { onConflict: "client_id,transaction_id" },
    )
    .select("id")
    .single();
  if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 });

  if (!isApproved || alreadyDispatched) {
    return NextResponse.json({ transaction_id: purchase.transactionId, dispatched: false });
  }

  const result = await dispatchEvent({
    clientId: settings.client_id,
    eventName: "Purchase",
    eventId: metaEventId,
    ip,
    userAgent: request.headers.get("user-agent"),
    visitor,
    emailHash,
    phoneHash,
    customData: { value: purchase.value, currency: purchase.currency ?? settings.currency },
  });

  await supabase
    .from("purchases")
    .update({ response_meta: result.responseMeta })
    .eq("id", savedPurchase.id);

  return NextResponse.json({ transaction_id: purchase.transactionId, dispatched: true });
}

async function findVisitorById(
  supabase: ReturnType<typeof createServiceClient>,
  clientId: string,
  trckUserId: string,
) {
  const isFullUuid = trckUserId.length === 36;
  const query = supabase
    .from("visitors")
    .select("trck_user_id, fbp, fbc, utm_source, utm_medium, utm_campaign")
    .eq("client_id", clientId);
  if (isFullUuid) {
    const { data } = await query.eq("trck_user_id", trckUserId).maybeSingle();
    return data;
  }
  // trck_user_id e uuid (nao texto) -- nao da pra usar ilike; o prefixo de 8
  // chars do /api/go vira os 4 primeiros bytes do uuid, comparados por faixa.
  const { data } = await query
    .gte("trck_user_id", `${trckUserId}-0000-0000-0000-000000000000`)
    .lte("trck_user_id", `${trckUserId}-ffff-ffff-ffff-ffffffffffff`)
    .limit(1)
    .maybeSingle();
  return data;
}

async function findVisitorByHash(
  supabase: ReturnType<typeof createServiceClient>,
  clientId: string,
  field: "email_hash" | "phone_hash",
  hash: string,
) {
  const { data } = await supabase
    .from("visitors")
    .select("trck_user_id, fbp, fbc, utm_source, utm_medium, utm_campaign")
    .eq("client_id", clientId)
    .eq(field, hash)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}
