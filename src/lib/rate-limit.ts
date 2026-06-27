// ponytail: limite em memoria por instancia (reseta em cold start, nao e
// distribuido entre regioes). Suficiente pro volume atual; trocar por
// Vercel KV/Upstash se o trafico publico crescer e isso comecar a vazar.
const hits = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const LIMIT = 30;

export function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || now > entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > LIMIT;
}
