import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { isRateLimited } from "@/lib/rate-limit";
import { decryptSecret, byteaToBuffer } from "@/lib/crypto";
import { sendMetaCapiEvent } from "@/lib/meta/capi";
import { sendGa4Event } from "@/lib/ga4/mp";

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(`event:${ip}`)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.client_slug !== "string" || typeof body.event_name !== "string") {
    return NextResponse.json(
      { error: "client_slug e event_name são obrigatórios" },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();
  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("slug", body.client_slug)
    .single();
  if (!client) {
    return NextResponse.json({ error: "cliente não encontrado" }, { status: 404 });
  }

  const eventId = typeof body.event_id === "string" ? body.event_id : randomUUID();

  const { data: inserted, error: insertErr } = await supabase
    .from("events_log")
    .upsert(
      {
        client_id: client.id,
        trck_user_id: body.trck_user_id ?? null,
        event_name: body.event_name,
        event_id: eventId,
        utm_source: body.utm_source ?? null,
        utm_medium: body.utm_medium ?? null,
        utm_campaign: body.utm_campaign ?? null,
        ip,
      },
      { onConflict: "client_id,event_id", ignoreDuplicates: true },
    )
    .select("id")
    .maybeSingle();
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  // ja existia (dedup) -- nao reenvia pra Meta/GA4
  if (!inserted) return NextResponse.json({ event_id: eventId, dispatched: false });

  const [visitorRes, settingsRes, pixelsRes, ga4Res] = await Promise.all([
    body.trck_user_id
      ? supabase
          .from("visitors")
          .select("fbp, fbc, email_hash, phone_hash, ctwa_clid, ga_client_id, ga_session_id, referrer")
          .eq("trck_user_id", body.trck_user_id)
          .eq("client_id", client.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("settings").select("test_event_code").eq("client_id", client.id).maybeSingle(),
    supabase
      .from("meta_pixels")
      .select("id, pixel_id, capi_token_enc")
      .eq("client_id", client.id)
      .eq("active", true),
    supabase
      .from("ga4_accounts")
      .select("id, measurement_id, api_secret_enc")
      .eq("client_id", client.id)
      .eq("active", true),
  ]);

  const visitor = visitorRes.data;
  const eventTime = Math.floor(Date.now() / 1000);
  const customData =
    typeof body.value === "number"
      ? { value: body.value, currency: body.currency ?? "BRL", content_name: body.content_name }
      : undefined;

  const metaResults = await Promise.all(
    (pixelsRes.data ?? []).map(async (pixel) => {
      const token = decryptSecret(byteaToBuffer(pixel.capi_token_enc));
      const result = await sendMetaCapiEvent({
        pixelId: pixel.pixel_id,
        accessToken: token,
        testEventCode: settingsRes.data?.test_event_code,
        eventName: body.event_name,
        eventId,
        eventTime,
        eventSourceUrl: visitor?.referrer,
        actionSource: visitor?.ctwa_clid ? "business_messaging" : "website",
        userData: {
          emailHash: visitor?.email_hash,
          phoneHash: visitor?.phone_hash,
          externalId: body.trck_user_id ?? null,
          fbp: visitor?.fbp,
          fbc: visitor?.fbc,
          clientIp: ip,
          clientUserAgent: request.headers.get("user-agent"),
        },
        customData,
      });
      return { pixel_id: pixel.pixel_id, ...result };
    }),
  );

  const ga4Results = await Promise.all(
    (ga4Res.data ?? []).map(async (account) => {
      const apiSecret = decryptSecret(byteaToBuffer(account.api_secret_enc));
      const result = await sendGa4Event({
        measurementId: account.measurement_id,
        apiSecret,
        clientId: visitor?.ga_client_id ?? body.trck_user_id ?? eventId,
        sessionId: visitor?.ga_session_id,
        eventName: body.event_name,
        params: customData,
      });
      return { measurement_id: account.measurement_id, ...result };
    }),
  );

  await supabase
    .from("events_log")
    .update({
      payload_meta: metaResults.map((r) => ({ pixel_id: r.pixel_id, ...r.request })),
      response_meta: metaResults.map((r) => ({ pixel_id: r.pixel_id, ok: r.ok, response: r.response })),
      payload_ga4: ga4Results.map((r) => ({ measurement_id: r.measurement_id, ...r.request })),
      response_ga4: ga4Results.map((r) => ({
        measurement_id: r.measurement_id,
        ok: r.ok,
        response: r.response,
      })),
    })
    .eq("id", inserted.id);

  return NextResponse.json({ event_id: eventId, dispatched: true });
}
