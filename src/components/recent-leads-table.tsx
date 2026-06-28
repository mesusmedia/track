"use client";

import { useMemo, useState } from "react";
import { Filter, Download } from "lucide-react";

type LeadRow = {
  id: string;
  name: string;
  clientName: string;
  stageName: string | null;
  createdAt: string;
  revenue: number | null;
};

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

const STAGE_COLORS: Record<string, string> = {
  vendido: "bg-[#4ade80]/10 border-[#4ade80]/20 text-[#4ade80] [&_div]:bg-[#4ade80]",
  perdido: "bg-[#f87171]/10 border-[#f87171]/20 text-[#f87171] [&_div]:bg-[#f87171]",
};
const DEFAULT_STAGE_COLOR = "bg-[#fbbf24]/10 border-[#fbbf24]/20 text-[#fbbf24] [&_div]:bg-[#fbbf24]";

function StagePill({ name }: { name: string }) {
  const color = STAGE_COLORS[name.trim().toLowerCase()] ?? DEFAULT_STAGE_COLOR;
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${color}`}>
      <div className="size-1.5 rounded-full" />
      <span className="text-[10px] font-bold uppercase">{name}</span>
    </div>
  );
}

function exportCsv(rows: LeadRow[]) {
  const header = "Lead,Cliente,Etapa,Criado em,Receita";
  const lines = rows.map((r) =>
    [r.name, r.clientName, r.stageName ?? "", new Date(r.createdAt).toLocaleString("pt-BR"), r.revenue ?? ""]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `leads-recentes-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function RecentLeadsTable({ leads }: { leads: LeadRow[] }) {
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter(
      (l) => l.name.toLowerCase().includes(q) || l.clientName.toLowerCase().includes(q) || l.stageName?.toLowerCase().includes(q),
    );
  }, [leads, filter]);

  return (
    <div className="bg-card border rounded-xl overflow-hidden">
      <div className="p-5 border-b flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Leads recentes</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Últimos leads recebidos, todos os clientes</p>
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
            onClick={() => exportCsv(filtered)}
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
              <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Cliente
              </th>
              <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Etapa
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
                <td className="px-5 py-3 text-sm font-medium">{lead.name}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{lead.clientName}</td>
                <td className="px-4 py-3">{lead.stageName ? <StagePill name={lead.stageName} /> : "—"}</td>
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
