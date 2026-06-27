type Ga4EventParams = {
  measurementId: string;
  apiSecret: string;
  clientId: string;
  sessionId?: string | null;
  eventName: string;
  params?: Record<string, unknown>;
};

// Measurement Protocol so deve ser usado pra "aumentar" o GA4 com eventos que
// nascem fora do navegador (ex: confirmacao de compra via webhook) -- nao
// duplicar aqui eventos que a gtag.js do site ja envia.
export async function sendGa4Event(event: Ga4EventParams) {
  const payload = {
    client_id: event.clientId,
    events: [
      {
        name: event.eventName,
        params: { session_id: event.sessionId ?? undefined, ...event.params },
      },
    ],
  };

  const res = await fetch(
    `https://www.google-analytics.com/mp/collect?measurement_id=${event.measurementId}&api_secret=${event.apiSecret}`,
    { method: "POST", body: JSON.stringify(payload) },
  );
  // GA4 MP responde 204 sem corpo em sucesso -- nao ha o que parsear
  return { request: payload, response: { status: res.status }, ok: res.ok };
}
