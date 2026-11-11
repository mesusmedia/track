import { createSign } from "crypto";

// ponytail: JWT de service account assinado a mao (RS256 via node:crypto) em
// vez de googleapis/google-auth-library -- mesmo padrao sem SDK que
// src/lib/google-ads/client.ts ja usa pro OAuth2 de Ads.
// GOOGLE_SERVICE_ACCOUNT_JSON = conteudo inteiro do JSON da service account
// (Console GCP -> IAM -> Service Accounts -> Keys), com a planilha de cada
// cliente compartilhada com o client_email dela (Leitor/Editor).
let cachedToken: { value: string; expiresAt: number } | null = null;

function base64url(input: Buffer | string) {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;

  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON não configurada");
  const account = JSON.parse(raw) as { client_email: string; private_key: string };

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      iss: account.client_email,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  const signature = base64url(signer.sign(account.private_key));
  const assertion = `${header}.${payload}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error_description ?? "Falha ao obter access token do Google Sheets");

  cachedToken = { value: body.access_token, expiresAt: Date.now() + (body.expires_in - 60) * 1000 };
  return cachedToken.value;
}

// mesmo layout de colunas que o Apps Script do pipeline n8n antigo usava --
// mantem os paineis/planilhas que os clientes ja olham funcionando sem
// mudar nada do lado deles.
const COLUMNS = [
  "Data",
  "Hora",
  "Nome",
  "Número",
  "Mensagem",
  "Status",
  "Origem",
  "SubOrigem",
  "Campanha",
  "Conjunto",
  "Anúncio",
  "AdID",
  "Plataforma",
  "SourceID",
  "ctwaClid",
] as const;

export type SheetBackupRow = {
  nome: string | null;
  numero: string | null;
  mensagem?: string | null;
  status?: string;
  origem?: string | null;
  suborigem?: string | null;
  campanha?: string | null;
  conjunto?: string | null;
  anuncio?: string | null;
  adId?: string | null;
  plataforma?: string | null;
  sourceId?: string | null;
  ctwaClid?: string | null;
};

// append-only: cada touchpoint de lead gera uma linha nova (igual ao
// pipeline antigo) -- isso e so backup/registro, nao e a fonte de verdade
// (o Supabase e). Nunca deve bloquear a criacao do lead: chamado com
// .catch() no call site, erro so vai pro log.
export async function appendSheetBackupRow(sheetId: string, gid: string, row: SheetBackupRow) {
  const token = await getAccessToken();
  const now = new Date();
  const values = [
    [
      now.toLocaleDateString("pt-BR"),
      now.toLocaleTimeString("pt-BR"),
      row.nome ?? "",
      row.numero ?? "",
      row.mensagem ?? "",
      row.status ?? "Cadastrado",
      row.origem ?? "",
      row.suborigem ?? "",
      row.campanha ?? "",
      row.conjunto ?? "",
      row.anuncio ?? "",
      row.adId ?? "",
      row.plataforma ?? "",
      row.sourceId ?? "",
      row.ctwaClid ?? "",
    ],
  ];

  // gid numerico nao serve como nome de aba no range A1 -- precisa resolver
  // pro titulo da aba primeiro.
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const meta = await metaRes.json();
  if (!metaRes.ok) throw new Error(meta?.error?.message ?? "Falha ao ler metadados da planilha");
  const sheetProps = (meta.sheets ?? []).find(
    (s: { properties: { sheetId: number } }) => String(s.properties.sheetId) === gid,
  );
  const sheetTitle = sheetProps?.properties?.title;
  if (!sheetTitle) throw new Error(`Aba com gid=${gid} não encontrada na planilha ${sheetId}`);

  const range = `${sheetTitle}!A:${String.fromCharCode(64 + COLUMNS.length)}`;
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values }),
    },
  );
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error?.message ?? "Falha ao gravar linha na planilha");
  return body;
}
