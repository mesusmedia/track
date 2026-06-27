import { META_GRAPH_API_BASE } from "./constants";

type MetaUserData = {
  emailHash?: string | null;
  phoneHash?: string | null;
  externalId?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  ctwaClid?: string | null;
  clientIp?: string | null;
  clientUserAgent?: string | null;
};

type MetaEventParams = {
  pixelId: string;
  accessToken: string;
  testEventCode?: string | null;
  eventName: string;
  eventId: string;
  eventTime: number;
  eventSourceUrl?: string | null;
  actionSource: "website" | "business_messaging" | "system_generated";
  userData: MetaUserData;
  customData?: { value?: number; currency?: string; content_name?: string };
};

export async function sendMetaCapiEvent(params: MetaEventParams) {
  const userData: Record<string, unknown> = {};
  if (params.userData.emailHash) userData.em = params.userData.emailHash;
  if (params.userData.phoneHash) userData.ph = params.userData.phoneHash;
  if (params.userData.externalId) userData.external_id = params.userData.externalId;
  // fbp/fbc/ip/user_agent NUNCA sao hasheados (exigencia da Meta)
  if (params.userData.fbp) userData.fbp = params.userData.fbp;
  if (params.userData.fbc) userData.fbc = params.userData.fbc;
  if (params.userData.ctwaClid) userData.ctwa_clid = params.userData.ctwaClid;
  if (params.userData.clientIp) userData.client_ip_address = params.userData.clientIp;
  if (params.userData.clientUserAgent) userData.client_user_agent = params.userData.clientUserAgent;

  const payload = {
    data: [
      {
        event_name: params.eventName,
        event_time: params.eventTime,
        event_id: params.eventId,
        action_source: params.actionSource,
        // exigido pra Meta atribuir o clique-pra-WhatsApp ao
        // anuncio/conjunto/campanha certo dentro do Ads Manager -- sem isso
        // (+ ctwa_clid em user_data) o evento e aceito mas fica "orfao",
        // sem credito pra nenhuma campanha.
        ...(params.actionSource === "business_messaging" ? { messaging_channel: "whatsapp" } : {}),
        event_source_url: params.eventSourceUrl ?? undefined,
        user_data: userData,
        custom_data: params.customData,
      },
    ],
    ...(params.testEventCode ? { test_event_code: params.testEventCode } : {}),
  };

  const res = await fetch(
    `${META_GRAPH_API_BASE}/${params.pixelId}/events?access_token=${params.accessToken}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  const responseBody = await res.json().catch(() => ({ error: "resposta inválida" }));
  return { request: payload, response: responseBody, ok: res.ok };
}
