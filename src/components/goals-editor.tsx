"use client";

import { useRef, useState, useTransition } from "react";
import { upsertGoal, type GoalRow } from "@/lib/goals/actions";
import { Copy, Check } from "lucide-react";

const METRICS = [
  { key: "meta_agendamentos", label: "Agendamentos", type: "int" },
  { key: "meta_consultas",    label: "Consultas",    type: "int" },
  { key: "meta_vendas",       label: "Vendas",       type: "int" },
  { key: "meta_faturamento",  label: "Faturamento",  type: "brl" },
  { key: "orcamento_midia",   label: "Orç. Mídia",   type: "brl" },
] as const;

type MetricKey = (typeof METRICS)[number]["key"];

const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function toNum(v: string, type: "int" | "brl") {
  const clean = v.replace(/[^\d,]/g, "").replace(",", ".");
  const n = parseFloat(clean);
  if (isNaN(n)) return 0;
  return type === "int" ? Math.round(n) : n;
}

function fmt(v: number, type: "int" | "brl") {
  if (type === "int") return v === 0 ? "" : String(v);
  return v === 0 ? "" : v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function GoalsEditor({
  clientId,
  year,
  initial,
}: {
  clientId: string;
  year: number;
  initial: GoalRow[];
}) {
  const emptyRow = (): GoalRow => ({
    month: 0,
    meta_agendamentos: 0,
    meta_consultas: 0,
    meta_vendas: 0,
    meta_faturamento: 0,
    orcamento_midia: 0,
    real_investimento: null,
    real_cpl: null,
  });

  // grid[month-1][metricKey] = number
  const [grid, setGrid] = useState<Record<MetricKey, number>[]>(() =>
    Array.from({ length: 12 }, (_, i) => {
      const row = initial.find((r) => r.month === i + 1) ?? emptyRow();
      return {
        meta_agendamentos: row.meta_agendamentos,
        meta_consultas:    row.meta_consultas,
        meta_vendas:       row.meta_vendas,
        meta_faturamento:  row.meta_faturamento,
        orcamento_midia:   row.orcamento_midia,
      };
    }),
  );

  const [saving, setSaving] = useState<string | null>(null);
  const [copied, setCopied] = useState<MetricKey | null>(null);
  const [, startTransition] = useTransition();
  const inputRefs = useRef<(HTMLInputElement | null)[][]>(
    Array.from({ length: METRICS.length }, () => Array(12).fill(null)),
  );

  function save(monthIdx: number) {
    const row = grid[monthIdx];
    setSaving(`${monthIdx}`);
    startTransition(async () => {
      try {
        await upsertGoal(clientId, year, { month: monthIdx + 1, ...row, real_investimento: null, real_cpl: null });
      } finally {
        setSaving(null);
      }
    });
  }

  function handleBlur(metricIdx: number, monthIdx: number, value: string) {
    const metric = METRICS[metricIdx];
    const num = toNum(value, metric.type);
    setGrid((prev) => {
      const next = [...prev];
      next[monthIdx] = { ...next[monthIdx], [metric.key]: num };
      return next;
    });
    save(monthIdx);
  }

  function replicateRow(metricKey: MetricKey) {
    // pega o primeiro valor preenchido da linha, ou o valor do mês atual
    const now = new Date().getMonth(); // 0-based
    const base = grid[now][metricKey] || grid.find((g) => g[metricKey] > 0)?.[metricKey] || 0;
    setGrid((prev) => prev.map((g) => ({ ...g, [metricKey]: base })));
    setCopied(metricKey);
    setTimeout(() => setCopied(null), 1500);
    // salva todos os meses
    Array.from({ length: 12 }, (_, i) => i).forEach((i) => {
      const row = { ...grid[i], [metricKey]: base };
      startTransition(async () => {
        await upsertGoal(clientId, year, { month: i + 1, ...row, real_investimento: null, real_cpl: null });
      });
    });
  }

  // navegação por teclado: Tab vai pra próxima célula da mesma linha (mês)
  function handleKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>,
    metricIdx: number,
    monthIdx: number,
  ) {
    if (e.key === "Tab") return; // deixa o browser lidar (tabIndex resolve)
    if (e.key === "Enter") {
      e.preventDefault();
      const nextMetric = metricIdx + 1 < METRICS.length ? metricIdx + 1 : 0;
      const nextMonth  = metricIdx + 1 < METRICS.length ? monthIdx : (monthIdx + 1) % 12;
      inputRefs.current[nextMetric]?.[nextMonth]?.focus();
    }
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm border-collapse min-w-[900px]">
        <thead>
          <tr className="bg-muted/50">
            <th className="text-left px-4 py-3 font-medium text-muted-foreground w-36">Métrica</th>
            <th className="px-2 py-3 text-muted-foreground w-8"></th>
            {MONTHS.map((m) => (
              <th key={m} className="px-2 py-3 text-center font-medium text-muted-foreground w-20">{m}</th>
            ))}
            <th className="px-3 py-3 text-center font-medium text-muted-foreground w-20">Total</th>
          </tr>
        </thead>
        <tbody>
          {METRICS.map((metric, mi) => {
            const total = grid.reduce((s, g) => s + g[metric.key], 0);
            const isCopied = copied === metric.key;
            return (
              <tr key={metric.key} className="border-t hover:bg-muted/20 transition-colors">
                <td className="px-4 py-2 font-medium text-foreground/80 whitespace-nowrap">
                  {metric.label}
                </td>
                <td className="px-2 py-2">
                  <button
                    onClick={() => replicateRow(metric.key)}
                    title="Replicar valor do mês atual para todos os meses"
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    {isCopied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                  </button>
                </td>
                {grid.map((monthData, idx) => (
                  <td key={idx} className="px-1 py-1">
                    <div className="relative">
                      {metric.type === "brl" && (
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground pointer-events-none">
                          R$
                        </span>
                      )}
                      <input
                        ref={(el) => { inputRefs.current[mi][idx] = el; }}
                        type="text"
                        inputMode="numeric"
                        tabIndex={mi * 12 + idx + 1}
                        defaultValue={fmt(monthData[metric.key], metric.type)}
                        onFocus={(e) => e.target.select()}
                        onBlur={(e) => handleBlur(mi, idx, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, mi, idx)}
                        placeholder="0"
                        className={`w-full rounded-md border bg-background text-center text-sm py-1.5 outline-none
                          focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all
                          ${saving === `${idx}` ? "opacity-60" : ""}
                          ${metric.type === "brl" ? "pl-6 pr-2" : "px-2"}
                        `}
                      />
                    </div>
                  </td>
                ))}
                <td className="px-3 py-2 text-center font-semibold text-sm tabular-nums text-foreground/70">
                  {metric.type === "brl"
                    ? total.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
                    : total}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
