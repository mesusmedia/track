"use client";

import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignOutButton } from "@/components/sign-out-button";

const TITLES: Record<string, string> = {
  "/cliente": "Visão geral",
  "/cliente/crm": "CRM",
  "/cliente/eventos": "Eventos",
  "/cliente/faturamento": "Faturamento",
  "/cliente/campanhas": "Campanhas",
  "/cliente/configuracoes": "Configurações",
};

export function ClienteHeader() {
  const pathname = usePathname();
  const title = TITLES[pathname] ?? "Painel";

  return (
    <header className="h-14 border-b bg-card sticky top-0 z-40 px-6 flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Painel</span>
        <span className="text-muted-foreground">/</span>
        <span className="text-primary font-medium">{title}</span>
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <SignOutButton />
      </div>
    </header>
  );
}
