"use client";

import { useMemo, useState } from "react";
import { Filter, Download } from "lucide-react";

type LeadRow = {
  id: string;
  name: string;
  phone?: string | null;
  avatarUrl?: string | null;
  clientName?: string;
  stageName: string | null;
  origin: string | null;
  createdAt: string;
  revenue: number | null;
};

const ORIGIN_COLORS: Record<string, string> = {
  meta: "bg-[#378ADD]/10 border-[#378ADD]/20 text-[#378ADD]",
  google: "bg-[#639922]/10 border-[#639922]/20 text-[#639922]",
};

function OriginPill({ origin }: { origin: string }) {
  const color = ORIGIN_COLORS[origin.trim().toLowerCase()] ?? "bg-accent border-border text-muted-foreground";
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase ${color}`}>{origin}</span>;
}

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function relativeTime(iso: string) {
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  return `${Math.round(diffH / 24)}d`;
}

function LeadAvatar({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) {
  if (avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- foto externa do Chatwoot, sem dominio fixo p/ next/image
    return <img src={avatarUrl} alt={name} className="size-8 rounded-full object-cover shrink-0" />;
  }
  return (
    <div className="size-8 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
      {name.trim()[0]?.toUpperCase() ?? "?"}
    </div>
  );
}

// Novo/Em contato: cinza -- Em atendimento: azul claro -- Agendado:
// amarelo/laranja -- Vendido/Ganha: verde -- Perdido: vermelho.
const STAGE_COLORS: Record<string, string> = {
  novo: "bg-[#9ca3af]/10 border-[#9ca3af]/20 text-[#9ca3af] [&_div]:bg-[#9ca3af]",
  "em contato": "bg-[#9ca3af]/10 border-[#9ca3af]/20 text-[#9ca3af] [&_div]:bg-[#9ca3af]",
  "em atendimento": "bg-[#38bdf8]/10 border-[#38bdf8]/20 text-[#38bdf8] [&_div]:bg-[#38bdf8]",
  agendado: "bg-[#fb923c]/10 border-[#fb923c]/20 text-[#fb923c] [&_div]:bg-[#fb923c]",
  vendido: "bg-[#4ade80]/10 border-[#4ade80]/20 text-[#4ade80] [&_div]:bg-[#4ade80]",
  ganha: "bg-[#4ade80]/10 border-[#4ade80]/20 text-[#4ade80] [&_div]:bg-[#4ade80]",
  ganho: "bg-[#4ade80]/10 border-[#4ade80]/20 text-[#4ade80] [&_div]:bg-[#4ade80]",
  perdido: "bg-[#f87171]/10 border-[#f87171]/20 text-[#f87171] [&_div]:bg-[#f87171]",
};
const DEFAULT_STAGE_COLOR = "bg-[#9ca3af]/10 border-[#9ca3af]/20 text-[#9ca3af] [&_div]:bg-[#9ca3af]";

function StagePill({ name }: { name: string }) {
  const color = STAGE_COLORS[name.trim().toLowerCase()] ?? DEFAULT_STAGE_COLOR;
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${color}`}>
      <div className="size-1.5 rounded-full" />
      <span className="text-[10px] font-bold uppercase">{name}</span>
    </div>
  );
}

function exportCsv(rows: LeadRow[], hasClientColumn: boolean) {
  const header = hasClientColumn
    ? "Lead,Telefone,Cliente,Etapa,Origem,Criado em,Receita"
    : "Lead,Telefone,Etapa,Origem,Criado em,Receita";
  const lines = rows.map((r) =>
    [
      r.name,
      r.phone ?? "",
      ...(hasClientColumn ? [r.clientName ?? ""] : []),
      r.stageName ?? "",
      r.origin ?? "",
      new Date(r.createdAt).toLocaleString("pt-BR"),
      r.revenue ?? "",
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function RecentLeadsTable({
  leads,
  title = "Leads recentes",
  subtitle = "Últimos leads recebidos, todos os clientes",
}: {
  leads: LeadRow[];
  title?: string;
  subtitle?: string;
}) {
  const [filter, setFilter] = useState("");
  const hasClientColumn = leads.some((l) => l.clientName);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.phone?.toLowerCase().includes(q) ||
        l.clientName?.toLowerCase().includes(q) ||
        l.stageName?.toLowerCase().includes(q),
    );
  }, [leads, filter]);

  return (
    <div className="bg-card border rounded-xl overflow-hidden">
      <div className="p-5 border-b flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filtrar leads..."
              className="w-44 bg-accent border rounded-lg py-1.5 pl-8 pr-3 text-xs focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <button
            onClick={() => exportCsv(filtered, hasClientColumn)}
            className="flex items-center gap-2 bg-primary hover:bg-primary/85 text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
          >
            <Download className="size-3.5" /> Exportar
          </button>
        </div>
      </div>
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground p-5">Nenhum lead encontrado.</p>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="bg-accent/40">
              <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Lead
              </th>
              {hasClientColumn && (
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Cliente
                </th>
              )}
              <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Etapa
              </th>
              <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Origem
              </th>
              <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Quando
              </th>
              <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Receita
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((lead) => (
              <tr key={lead.id} className="hover:bg-accent/30 transition-colors">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <LeadAvatar name={lead.name} avatarUrl={lead.avatarUrl} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{lead.name}</p>
                      {lead.phone && (
                        <p className="text-xs text-muted-foreground font-mono truncate">{lead.phone}</p>
                      )}
                    </div>
                  </div>
                </td>
                {hasClientColumn && (
                  <td className="px-4 py-3 text-xs text-muted-foreground">{lead.clientName}</td>
                )}
                <td className="px-4 py-3">{lead.stageName ? <StagePill name={lead.stageName} /> : "—"}</td>
                <td className="px-4 py-3">{lead.origin ? <OriginPill origin={lead.origin} /> : "—"}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{relativeTime(lead.createdAt)}</td>
                <td className="px-5 py-3 text-right text-xs font-semibold tabular-nums">
                  {lead.revenue ? formatBRL(Number(lead.revenue)) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="p-4 border-t flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          Mostrando {filtered.length} de {leads.length} leads
        </span>
      </div>
    </div>
  );
}
