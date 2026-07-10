const GOOGLE_MARKERS = ["olá, vim pelo site", "olá vim pelo site", "olá vim do site", "vim pelo site"];

export function matchesGoogleMarker(text: string) {
  const lower = text.toLowerCase();
  return GOOGLE_MARKERS.some((marker) => lower.includes(marker));
}

// extrai identificador de campanha do texto pre-preenchido da landing page.
// ex: "Olá vim pelo site do Google Gastro e gostaria..." → "gastro"
// funciona com qualquer palavra depois de "Google " na mensagem.
export function extractGoogleCampaignFromText(text: string): string | null {
  const match = text.match(/google\s+(\w+)/i);
  return match ? match[1].toLowerCase() : null;
}
