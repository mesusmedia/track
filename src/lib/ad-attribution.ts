// frases-marcador usadas nos anuncios do Google (sem externalAdReply nativo
// como o Meta tem) -- mesmo padrao que o n8n antigo usava pra identificar
// clique vindo de anuncio do Google na primeira mensagem do WhatsApp.
const GOOGLE_MARKERS = ["olá, vim pelo site", "olá vim pelo site", "olá vim do site", "vim pelo site"];

export function matchesGoogleMarker(text: string) {
  const lower = text.toLowerCase();
  return GOOGLE_MARKERS.some((marker) => lower.includes(marker));
}
