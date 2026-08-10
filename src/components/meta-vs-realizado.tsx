"use client";

import { useRef, useState, useTransition } from "react";
import { upsertGoal, type GoalRow, type MonthRealizado } from "@/lib/goals/actions";
import { TrendingUp, TrendingDown, Minus, AlertCircle, Lightbulb, ArrowDown, ArrowUp } from "lucide-react";

const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function brl2(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pct(real: number, meta: number) {
  if (meta === 0) return null;
  return Math.round((real / meta) * 100);
}

function PctBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs text-muted-foreground">—</span>;
  const color = value >= 100 ? "text-emerald-500" : value >= 70 ? "text-amber-500" : "text-red-500";
  const Icon = value >= 100 ? TrendingUp : value >= 70 ? Minus : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${color}`}>
      <Icon className="size-3" /> {value}%
    </span>
  );
}

function MetricCard({
  label,
  meta,
  real,
  formatFn = String,
  hideMeta = false,
}: {
  label: string;
  meta: number;
  real: number;
  formatFn?: (v: number) => string;
  hideMeta?: boolean;
}) {
  const p = hideMeta ? null : pct(real, meta);
  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
      <div className="grid grid-cols-2 gap-2">
        {!hideMeta && (
          <div>
            <p className="text-[11px] text-muted-foreground">Meta</p>
            <p className="text-lg font-bold tabular-nums">{meta === 0 ? "—" : formatFn(meta)}</p>
          </div>
        )}
        <div className={hideMeta ? "col-span-2" : ""}>
          <p className="text-[11px] text-muted-foreground">Realizado</p>
          <p className="text-lg font-bold tabular-nums text-primary">{formatFn(real)}</p>
        </div>
      </div>
      {!hideMeta && <PctBadge value={p} />}
    </div>
  );
}

function ManualInput({
  label,
  sublabel,
  value,
  onChange,
  onBlur,
  saving,
  prefix = "R$",
}: {
  label: string;
  sublabel?: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  saving: boolean;
  prefix?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">{prefix}</span>
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          onFocus={(e) => e.target.select()}
          placeholder="0"
          className={`w-full pl-8 pr-3 py-2 rounded-lg border bg-background text-sm outline-none
            focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all
            ${saving ? "opacity-60" : ""}`}
        />
      </div>
      {sublabel && <p className="text-[11px] text-muted-foreground">{sublabel}</p>}
    </div>
  );
}

export function MetaVsRealizado({
  clientId,
  year,
  month,
  goal,
  realizado,
}: {
  clientId: string;
  year: number;
  month: number;
  goal: GoalRow | null;
  realizado: MonthRealizado;
}) {
  const [investimento, setInvestimento] = useState(
    goal?.real_investimento != null ? String(goal.real_investimento) : "",
  );
  const [cplReal, setCplReal] = useState(
    goal?.real_cpl != null ? String(goal.real_cpl) : "",
  );
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();

  const meta: GoalRow = goal ?? {
    month,
    meta_agendamentos: 0,
    meta_consultas: 0,
    meta_vendas: 0,
    meta_faturamento: 0,
    orcamento_midia: 0,
    real_investimento: null,
    real_cpl: null,
  };

  function save(patch: Partial<GoalRow>) {
    setSaving(true);
    startTransition(async () => {
      try {
        const invNum = parseFloat(investimento.replace(",", ".")) || null;
        const cplNum = parseFloat(cplReal.replace(",", ".")) || null;
        await upsertGoal(clientId, year, {
          ...meta,
          real_investimento: invNum,
          real_cpl: cplNum,
          ...patch,
        });
      } finally {
        setSaving(false);
      }
    });
  }

  const invNum = parseFloat(investimento.replace(",", ".")) || 0;
  const cplRealNum = parseFloat(cplReal.replace(",", ".")) || 0;

  // CPL ideal = orçamento planejado / meta de agendamentos
  const cplIdeal =
    meta.orcamento_midia > 0 && meta.meta_agendamentos > 0
      ? meta.orcamento_midia / meta.meta_agendamentos
      : null;

  // com CPL real, quantos agendamentos o orçamento atual consegue?
  const agendamentosComOrcamento =
    cplRealNum > 0 && meta.orcamento_midia > 0
      ? Math.floor(meta.orcamento_midia / cplRealNum)
      : null;

  // investimento necessário para bater a meta com CPL real
  const investimentoNecessario =
    cplRealNum > 0 && meta.meta_agendamentos > 0
      ? cplRealNum * meta.meta_agendamentos
      : null;

  // gap CPL: quanto precisa reduzir
  const gapCplPct =
    cplRealNum > 0 && cplIdeal != null
      ? Math.round(((cplRealNum - cplIdeal) / cplRealNum) * 100)
      : null;

  // CPA e ROAS (a partir do realizado do CRM)
  const cpa = invNum > 0 && realizado.vendas > 0 ? invNum / realizado.vendas : null;
  const roas = invNum > 0 && realizado.faturamento > 0 ? realizado.faturamento / invNum : null;

  return (
    <div className="space-y-6">
      {/* seletor de mês */}
      <div className="flex gap-1 flex-wrap">
        {MONTHS.map((m, i) => (
          <a
            key={m}
            href={`?year=${year}&month=${i + 1}`}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              i + 1 === month
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {m}
          </a>
        ))}
      </div>

      {/* entradas manuais: investimento + CPL real */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl border bg-muted/30 p-4">
        <ManualInput
          label="Investimento realizado"
          sublabel={`Orçamento planejado: ${meta.orcamento_midia > 0 ? brl(meta.orcamento_midia) : "—"}`}
          value={investimento}
          onChange={setInvestimento}
          onBlur={() => save({ real_investimento: parseFloat(investimento.replace(",", ".")) || null })}
          saving={saving}
        />
        <ManualInput
          label="CPL real (do gerenciador)"
          sublabel={`CPL ideal para bater a meta: ${cplIdeal ? brl2(cplIdeal) : "—"}`}
          value={cplReal}
          onChange={setCplReal}
          onBlur={() => save({ real_cpl: parseFloat(cplReal.replace(",", ".")) || null })}
          saving={saving}
        />
      </div>

      {/* análise de CPL */}
      {cplRealNum > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* CPL real vs ideal */}
          <div className="rounded-xl border bg-card p-4 space-y-2">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">CPL Real vs Ideal</p>
            <div className="flex items-end gap-3">
              <div>
                <p className="text-[11px] text-muted-foreground">Real</p>
                <p className="text-xl font-bold tabular-nums">{brl2(cplRealNum)}</p>
              </div>
              {cplIdeal && (
                <div>
                  <p className="text-[11px] text-muted-foreground">Ideal</p>
                  <p className="text-xl font-bold tabular-nums text-emerald-500">{brl2(cplIdeal)}</p>
                </div>
              )}
            </div>
            {gapCplPct !== null && (
              <div className={`flex items-center gap-1 text-xs font-semibold ${gapCplPct > 0 ? "text-red-500" : "text-emerald-500"}`}>
                {gapCplPct > 0 ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />}
                {gapCplPct > 0
                  ? `Reduzir CPL ${gapCplPct}% para bater meta`
                  : `CPL ${Math.abs(gapCplPct)}% abaixo do ideal`}
              </div>
            )}
          </div>

          {/* agendamentos possíveis com orçamento atual */}
          <div className="rounded-xl border bg-card p-4 space-y-2">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Com orçamento atual</p>
            <p className="text-xl font-bold tabular-nums">
              {agendamentosComOrcamento ?? "—"}
              <span className="text-sm font-normal text-muted-foreground ml-1">agendamentos</span>
            </p>
            {meta.meta_agendamentos > 0 && agendamentosComOrcamento !== null && (
              <PctBadge value={pct(agendamentosComOrcamento, meta.meta_agendamentos)} />
            )}
          </div>

          {/* investimento para bater a meta */}
          <div className="rounded-xl border bg-card p-4 space-y-2">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Para bater a meta</p>
            <p className="text-xl font-bold tabular-nums text-amber-500">
              {investimentoNecessario ? brl(investimentoNecessario) : "—"}
            </p>
            {investimentoNecessario && meta.orcamento_midia > 0 && (
              <p className="text-xs text-muted-foreground">
                {investimentoNecessario > meta.orcamento_midia
                  ? `+${brl(investimentoNecessario - meta.orcamento_midia)} acima do orçamento`
                  : `${brl(meta.orcamento_midia - investimentoNecessario)} dentro do orçamento`}
              </p>
            )}
          </div>
        </div>
      )}

      {/* cards meta vs realizado (CRM) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <MetricCard label="Total Leads" meta={0} real={realizado.total_leads} hideMeta />
        <MetricCard label="Agendamentos" meta={meta.meta_agendamentos} real={realizado.agendamentos} />
        <MetricCard label="Consultas" meta={meta.meta_consultas} real={realizado.consultas} />
        <MetricCard label="Vendas" meta={meta.meta_vendas} real={realizado.vendas} />
        <MetricCard label="Faturamento" meta={meta.meta_faturamento} real={realizado.faturamento} formatFn={brl} />
      </div>

      {/* CPA e ROAS */}
      {invNum > 0 && (cpa || roas) && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">CPA (custo por venda)</p>
            <p className="text-xl font-bold">{cpa ? brl2(cpa) : "—"}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">ROAS</p>
            <p className="text-xl font-bold">{roas ? `${roas.toFixed(1)}x` : "—"}</p>
          </div>
        </div>
      )}

      {/* caixa de inteligência */}
      {cplRealNum > 0 && meta.meta_agendamentos > 0 && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
          <div className="flex items-center gap-2 text-primary">
            <Lightbulb className="size-4 shrink-0" />
            <p className="text-sm font-semibold">Inteligência de Meta — {MONTHS[month - 1]}/{year}</p>
          </div>
          <ul className="space-y-1.5 text-sm text-foreground/80 list-none">
            {cplIdeal && (
              <li className="flex items-start gap-1.5">
                <span className="text-primary font-bold mt-0.5">→</span>
                Para atingir <strong>{meta.meta_agendamentos} agendamentos</strong> com o orçamento de{" "}
                <strong>{brl(meta.orcamento_midia)}</strong>, o CPL precisa ser{" "}
                <strong className="text-emerald-500">{brl2(cplIdeal)}</strong>.
              </li>
            )}
            {gapCplPct !== null && gapCplPct > 0 && (
              <li className="flex items-start gap-1.5">
                <AlertCircle className="size-3.5 mt-0.5 shrink-0 text-red-500" />
                CPL atual <strong>{brl2(cplRealNum)}</strong> está <strong className="text-red-500">{gapCplPct}% acima do ideal</strong>.{" "}
                Precisa reduzir <strong>{brl2(cplRealNum - (cplIdeal ?? 0))}</strong>/lead para fechar dentro do orçamento.
              </li>
            )}
            {investimentoNecessario && (
              <li className="flex items-start gap-1.5">
                <span className="text-amber-500 font-bold mt-0.5">→</span>
                Com CPL de <strong>{brl2(cplRealNum)}</strong>, investir{" "}
                <strong className="text-amber-500">{brl(investimentoNecessario)}</strong> para bater a meta.
                {investimentoNecessario > meta.orcamento_midia && meta.orcamento_midia > 0 && (
                  <> Aumento de <strong>{brl(investimentoNecessario - meta.orcamento_midia)}</strong> necessário.</>
                )}
              </li>
            )}
            {agendamentosComOrcamento !== null && agendamentosComOrcamento < meta.meta_agendamentos && (
              <li className="flex items-start gap-1.5">
                <span className="text-muted-foreground mt-0.5">→</span>
                Com o orçamento atual e CPL real, estimativa de{" "}
                <strong>{agendamentosComOrcamento} agendamentos</strong> — faltam{" "}
                <strong>{meta.meta_agendamentos - agendamentosComOrcamento}</strong> para bater a meta.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
