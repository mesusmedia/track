import { createServiceClient } from "@/lib/supabase/server";
import { decryptSecret, byteaToBuffer } from "@/lib/crypto";
import { sendMetaCapiEvent } from "@/lib/meta/capi";
import { sendGa4Event } from "@/lib/ga4/mp";

type Visitor = {
  fbp?: string | null;
  fbc?: string | null;
  email_hash?: string | null;
  phone_hash?: string | null;
  ctwa_clid?: string | null;
  ga_client_id?: string | null;
  ga_session_id?: string | null;
  referrer?: string | null;
} | null;

export async function dispatchEvent(params: {
  clientId: string;
  eventName: string;
  eventId: string;
  ip: string;
  userAgent: string | null;
  visitor: Visitor;
  emailHash?: string | null;
  phoneHash?: string | null;
  customData?: { value?: number | null; currency?: string; content_name?: string | null };
}) {
  const supabase = createServiceClient();
  const [settingsRes, pixelsRes, ga4Res] = await Promise.all([
    supabase
      .from("settings")
      .select("test_event_code")
      .eq("client_id", params.clientId)
      .maybeSingle(),
    supabase
      .from("meta_pixels")
      .select("id, pixel_id, capi_token_enc")
      .eq("client_id", params.clientId)
      .eq("active", true),
    supabase
      .from("ga4_accounts")
      .select("id, measurement_id, api_secret_enc")
      .eq("client_id", params.clientId)
      .eq("active", true),
  ]);

  const eventTime = Math.floor(Date.now() / 1000);
  const customData = params.customData?.value
    ? {
        value: params.customData.value,
        currency: params.customData.currency ?? "BRL",
        content_name: params.customData.content_name ?? undefined,
      }
    : undefined;

  const metaResults = await Promise.all(
    (pixelsRes.data ?? []).map(async (pixel) => {
      const token = decryptSecret(byteaToBuffer(pixel.capi_token_enc));
      const result = await sendMetaCapiEvent({
        pixelId: pixel.pixel_id,
        accessToken: token,
        testEventCode: settingsRes.data?.test_event_code,
        eventName: params.eventName,
        eventId: params.eventId,
        eventTime,
        eventSourceUrl: params.visitor?.referrer,
        actionSource: params.visitor?.ctwa_clid ? "business_messaging" : "website",
        userData: {
          emailHash: params.emailHash ?? params.visitor?.email_hash,
          phoneHash: params.phoneHash ?? params.visitor?.phone_hash,
          externalId: null,
          fbp: params.visitor?.fbp,
          fbc: params.visitor?.fbc,
          clientIp: params.ip,
          clientUserAgent: params.userAgent,
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
        clientId: params.visitor?.ga_client_id ?? params.eventId,
        sessionId: params.visitor?.ga_session_id,
        eventName: params.eventName,
        params: customData,
      });
      return { measurement_id: account.measurement_id, ...result };
    }),
  );

  return {
    payloadMeta: metaResults.map((r) => ({ pixel_id: r.pixel_id, ...r.request })),
    responseMeta: metaResults.map((r) => ({ pixel_id: r.pixel_id, ok: r.ok, response: r.response })),
    payloadGa4: ga4Results.map((r) => ({ measurement_id: r.measurement_id, ...r.request })),
    responseGa4: ga4Results.map((r) => ({
      measurement_id: r.measurement_id,
      ok: r.ok,
      response: r.response,
    })),
  };
}
