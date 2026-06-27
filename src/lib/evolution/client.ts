const BASE_URL = process.env.EVOLUTION_BASE_URL!;

function globalHeaders() {
  return { apikey: process.env.EVOLUTION_GLOBAL_API_KEY!, "Content-Type": "application/json" };
}

function instanceHeaders(instanceApiKey: string) {
  return { apikey: instanceApiKey, "Content-Type": "application/json" };
}

// cria a instancia (apikey global) -- ja retorna o QR code base64, alem da
// apikey propria da instancia (em hash.apikey) usada pra todas as chamadas
// seguintes especificas dela.
export async function createInstance(instanceName: string) {
  const res = await fetch(`${BASE_URL}/instance/create`, {
    method: "POST",
    headers: globalHeaders(),
    body: JSON.stringify({ instanceName, qrcode: true }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.response?.message?.[0] ?? "Falha ao criar instância");
  return {
    apikey: body.hash.apikey as string,
    qrcodeBase64: body.qrcode?.base64 as string | undefined,
  };
}

// integracao nativa Evolution<->Chatwoot. A inbox so e criada no Chatwoot
// depois que o numero conectar de verdade (sem WhatsApp conectado, Evolution
// nao tem identidade pra registrar o canal) -- ver syncChatwootInboxId.
export async function setChatwootIntegration(instanceName: string, instanceApiKey: string) {
  const res = await fetch(`${BASE_URL}/chatwoot/set/${instanceName}`, {
    method: "POST",
    headers: instanceHeaders(instanceApiKey),
    body: JSON.stringify({
      enabled: true,
      account_id: process.env.CHATWOOT_ACCOUNT_ID,
      token: process.env.CHATWOOT_API_ACCESS_TOKEN,
      url: process.env.CHATWOOT_BASE_URL,
      sign_msg: false,
      reopen_conversation: true,
      conversation_pending: false,
      name_inbox: instanceName,
    }),
  });
  if (!res.ok) throw new Error("Falha ao configurar integração com o Chatwoot");
}

export async function getQrCode(instanceName: string, instanceApiKey: string) {
  const res = await fetch(`${BASE_URL}/instance/connect/${instanceName}`, {
    headers: instanceHeaders(instanceApiKey),
  });
  const body = await res.json();
  return (body.base64 ?? body.qrcode?.base64 ?? null) as string | null;
}

export async function getConnectionState(instanceName: string, instanceApiKey: string) {
  const res = await fetch(`${BASE_URL}/instance/connectionState/${instanceName}`, {
    headers: instanceHeaders(instanceApiKey),
  });
  const body = await res.json();
  return (body.instance?.state ?? "unknown") as string;
}

// busca uma instancia ja existente no servidor Evolution (cliente que ja
// estava conectado antes de existir essa plataforma) -- nao cria nada, so
// le. Formato de resposta varia por versao do Evolution: pode vir como
// array direto (servidor novo) ou {instance: {...}} (servidor antigo).
export async function findInstanceByName(instanceName: string) {
  const res = await fetch(`${BASE_URL}/instance/fetchInstances?instanceName=${instanceName}`, {
    headers: globalHeaders(),
  });
  if (!res.ok) return null;
  const body = await res.json();
  const entry = Array.isArray(body) ? body[0] : body?.instance;
  if (!entry) return null;

  return {
    apikey: (entry.token ?? entry.apikey) as string,
    chatwootInboxName: (entry.Chatwoot?.nameInbox ?? entry.chatwoot?.name_inbox ?? null) as
      | string
      | null,
  };
}

export async function deleteInstance(instanceName: string) {
  await fetch(`${BASE_URL}/instance/delete/${instanceName}`, {
    method: "DELETE",
    headers: globalHeaders(),
  });
}
