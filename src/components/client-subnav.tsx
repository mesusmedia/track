"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, LayoutDashboard, KanbanSquare, Activity, Wallet, Megaphone, Settings } from "lucide-react";

const TABS = [
  { slug: "visao-geral", label: "Visão geral", icon: LayoutDashboard },
  { slug: "crm", label: "CRM", icon: KanbanSquare },
  { slug: "eventos", label: "Eventos", icon: Activity },
  { slug: "faturamento", label: "Faturamento", icon: Wallet },
  { slug: "campanhas", label: "Campanhas", icon: Megaphone },
  { slug: "configuracoes", label: "Configurações", icon: Settings },
];

export function ClientSubNav({ clientId, clientName }: { clientId: string; clientName: string }) {
  const pathname = usePathname();

  return (
    <div className="space-y-3">
      <Link
        href="/admin/clients"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Clientes
      </Link>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">{clientName}</h1>
      </div>
      <div className="flex gap-1 border-b -mb-px overflow-x-auto">
        {TABS.map((tab) => {
          const href = `/admin/clients/${clientId}/${tab.slug}`;
          const active = pathname === href;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.slug}
              href={href}
              className={
                active
                  ? "flex items-center gap-1.5 px-3 py-2 border-b-2 border-primary text-primary text-sm font-medium whitespace-nowrap"
                  : "flex items-center gap-1.5 px-3 py-2 border-b-2 border-transparent text-muted-foreground hover:text-foreground text-sm font-medium whitespace-nowrap"
              }
            >
              <Icon className="size-3.5" /> {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
