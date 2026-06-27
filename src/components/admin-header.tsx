"use client";

import { useRouter, usePathname } from "next/navigation";
import { Search, Bell } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignOutButton } from "@/components/sign-out-button";

const TITLES: Record<string, string> = {
  "/admin": "Visão geral",
  "/admin/clients": "Clientes",
};

export function AdminHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const title = TITLES[pathname] ?? "Painel da agência";

  return (
    <header className="h-14 border-b bg-card sticky top-0 z-40 px-6 flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Dashboard</span>
        <span className="text-muted-foreground">/</span>
        <span className="text-primary font-medium">{title}</span>
      </div>
      <div className="flex items-center gap-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const q = new FormData(e.currentTarget).get("q");
            router.push(`/admin/clients?q=${encodeURIComponent(String(q ?? ""))}`);
          }}
          className="relative"
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <input
            name="q"
            placeholder="Buscar cliente..."
            className="w-56 bg-accent border rounded-lg py-1.5 pl-8 pr-3 text-xs focus:outline-none focus:border-primary transition-colors"
          />
        </form>
        <button className="size-8 rounded-lg bg-accent flex items-center justify-center hover:bg-accent/70 transition-colors" title="Notificações">
          <Bell className="size-4 text-muted-foreground" />
        </button>
        <ThemeToggle />
        <SignOutButton />
      </div>
    </header>
  );
}
