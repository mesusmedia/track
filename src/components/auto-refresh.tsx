"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// ponytail: router.refresh() reroda as queries do server component sem
// recarregar a pagina inteira (mantem scroll/filtro de periodo na URL).
export function AutoRefresh({ intervalMs = 5 * 60 * 1000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
