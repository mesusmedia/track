"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, KanbanSquare, Activity, Wallet, Megaphone, Settings } from "lucide-react";

const NAV = [
  { href: "/cliente", label: "Visão geral", icon: LayoutDashboard },
  { href: "/cliente/crm", label: "CRM", icon: KanbanSquare },
  { href: "/cliente/eventos", label: "Eventos", icon: Activity },
  { href: "/cliente/faturamento", label: "Faturamento", icon: Wallet },
  { href: "/cliente/campanhas", label: "Campanhas", icon: Megaphone },
  { href: "/cliente/configuracoes", label: "Configurações", icon: Settings },
];

export function ClienteSidebar({ email }: { email: string | null }) {
  const pathname = usePathname();
  return (
    <aside className="w-56 border-r bg-card flex flex-col h-screen sticky top-0 shrink-0">
      <div className="p-5">
        <Image src="/logo-mesus.png" alt="Mesus Media" width={120} height={40} className="h-7 w-auto" priority />
      </div>
      <nav className="flex-1 px-3 space-y-1">
        {NAV.map((item) => {
          const active = item.href === "/cliente" ? pathname === "/cliente" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                active
                  ? "flex items-center gap-3 px-3 py-2.5 rounded-lg bg-primary/15 text-primary text-sm font-medium transition-colors"
                  : "flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-accent text-sm font-medium transition-colors"
              }
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      {email ? (
        <div className="p-3 border-t">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-accent">
            <div className="size-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
              {email[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium truncate">{email}</p>
              <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Cliente</span>
            </div>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
