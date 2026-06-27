const API_VERSION = "v24"; // conferir https://developers.google.com/google-ads/api/docs/release-notes antes de atualizar

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_ADS_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_ADS_OAUTH_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
      grant_type: "refresh_token",
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error_description ?? "Falha ao obter access token do Google Ads");

  cachedToken = { value: body.access_token, expiresAt: Date.now() + (body.expires_in - 60) * 1000 };
  return cachedToken.value;
}

// resolve campanha/conjunto/anuncio a partir do gclid capturado no /api/go ->
// usa o recurso click_view (so disponivel pra cliques dos ultimos 90 dias,
// limitacao da propria API do Google). Token de agencia (MCC), nao por
// cliente -- ver CLAUDE.md "Atribuicao de anuncio".
export async function resolveAdFromGclid(customerId: string, gclid: string) {
  const token = await getAccessToken();
  const res = await fetch(
    `https://googleads.googleapis.com/${API_VERSION}/customers/${customerId}/googleAds:search`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
        "login-customer-id": process.env.GOOGLE_ADS_MCC_CUSTOMER_ID!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `SELECT campaign.name, ad_group.name, ad_group_ad.ad.id FROM click_view WHERE click_view.gclid = "${gclid}" LIMIT 1`,
      }),
    },
  );
  const body = await res.json();
  const row = body?.results?.[0];
  if (!res.ok || !row) return null;

  return {
    campaignName: row.campaign?.name as string | undefined,
    adGroupName: row.adGroup?.name as string | undefined,
    adId: row.adGroupAd?.ad?.id as string | undefined,
  };
}
