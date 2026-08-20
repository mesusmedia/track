"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Trash2, CalendarRange, FileDown, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import {
  moveLeadStage,
  updateLeadRevenue,
  updateLeadNotes,
  addAutomationRule,
  removeAutomationRule,
  createLeadManual,
  deleteLeadAction,
} from "@/lib/crm/actions";

type Stage = { id: string; name: string; position: number };
type Lead = {
  id: string;
  name: string | null;
  phone: string | null;
  stage_id: string | null;
  max_position: number | null;
  revenue: number | null;
  utm_source: string | null;
  utm_campaign: string | null;
  campaign_name: string | null;
  adset_name: string | null;
  ad_name: string | null;
  notes: string | null;
  created_at?: string | null;
};
type Rule = { id: string; keyword: string; stage_id: string };

function periodPresets() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const today = now.toISOString().slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, "0");
  return [
    { label: "Este mês", from: `${y}-${pad(m + 1)}-01`, to: today },
    {
      label: "Mês passado",
      from: `${m === 0 ? y - 1 : y}-${pad(m === 0 ? 12 : m)}-01`,
      to: `${m === 0 ? y - 1 : y}-${pad(m === 0 ? 12 : m)}-${new Date(y, m, 0).getDate()}`,
    },
    {
      label: "Últimos 7 dias",
      from: new Date(now.getTime() - 6 * 864e5).toISOString().slice(0, 10),
      to: today,
    },
    {
      label: "Últimos 30 dias",
      from: new Date(now.getTime() - 29 * 864e5).toISOString().slice(0, 10),
      to: today,
    },
    { label: "Este ano", from: `${y}-01-01`, to: today },
  ];
}

export function CrmBoard({
  clientId,
  clientName,
  stages,
  leads,
  rules,
  from,
  to,
  isAdmin,
}: {
  clientId: string;
  clientName?: string;
  stages: Stage[];
  leads: Lead[];
  rules: Rule[];
  from: string;
  to: string;
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [customFrom, setCustomFrom] = useState(from);
  const [customTo, setCustomTo] = useState(to);

  function navigate(f: string, t: string) {
    router.push(`${pathname}?from=${f}&to=${t}`);
  }
  // estado local otimista -- arrastar move o card na hora, sem esperar o
  // round-trip do server action. Resincroniza quando o pai re-busca os
  // dados (revalidatePath depois da action).
  const [leadList, setLeadList] = useState(leads);
  useEffect(() => setLeadList(leads), [leads]);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  function handleDrop(stageId: string, leadId: string | undefined) {
    setDragOverStage(null);
    if (!leadId) return;
    const lead = leadList.find((l) => l.id === leadId);
    if (!lead || lead.stage_id === stageId) return;

    setLeadList((prev) => prev.map((l) => (l.id === leadId ? { ...l, stage_id: stageId } : l)));
    moveLeadStage(leadId, stageId, clientId)
      .then(() => toast.success("Etapa atualizada"))
      .catch(() => {
        setLeadList((prev) => prev.map((l) => (l.id === leadId ? lead : l)));
        toast.error("Erro ao mover o lead");
      });
  }

  return (
    <div className="space-y-6">
      {/* header: novo lead + filtro */}
      <div className="flex items-center justify-between gap-2">
        <NewLeadDialog clientId={clientId} stages={stages} />
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const stageName = (id: string | null) => stages.find((s) => s.id === id)?.name ?? "";
              const header = "Nome,Telefone,Etapa,Origem,Campanha,Conjunto,Anúncio,UTM Source,Receita,Criado em,Observações";
              const lines = leadList.map((l) =>
                [
                  l.name ?? "",
                  l.phone ?? "",
                  stageName(l.stage_id),
                  l.utm_source ?? l.campaign_name ?? "",
                  l.campaign_name ?? "",
                  l.adset_name ?? "",
                  l.ad_name ?? "",
                  l.utm_source ?? "",
                  l.revenue ?? "",
                  l.created_at ? new Date(l.created_at).toLocaleString("pt-BR") : "",
                  l.notes ?? "",
                ]
                  .map((v) => `"${String(v).replace(/"/g, '""')}"`)
                  .join(","),
              );
              const bom = "﻿";
              const blob = new Blob([bom + [header, ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `leads-${clientName ?? "crm"}-${new Date().toISOString().slice(0, 10)}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <FileDown className="size-4" /> Exportar CSV
          </Button>
          {isAdmin && (
            <Button size="sm" variant="outline" onClick={() => document.getElementById("relatorio-comercial")?.scrollIntoView({ behavior: "smooth" })}>
              Relatório comercial
            </Button>
          )}
        </div>
      </div>

      {/* filtro de período */}
      <div className="flex flex-wrap items-end gap-2">
        <CalendarRange className="size-4 text-muted-foreground self-center" />
        {periodPresets().map((p) => (
          <Button
            key={p.label}
            size="sm"
            variant={from === p.from && to === p.to ? "default" : "outline"}
            onClick={() => navigate(p.from, p.to)}
          >
            {p.label}
          </Button>
        ))}
        <div className="flex items-center gap-1 ml-auto">
          <Input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="h-8 w-36 text-xs"
          />
          <span className="text-muted-foreground text-xs">até</span>
          <Input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="h-8 w-36 text-xs"
          />
          <Button size="sm" variant="outline" onClick={() => navigate(customFrom, customTo)}>
            Filtrar
          </Button>
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4" style={{ minWidth: 0 }}>
        {stages.map((stage) => (
          <div
            key={stage.id}
            className={`flex-none w-56 space-y-2 rounded-lg p-1 select-none transition-colors ${dragOverStage === stage.id ? "bg-accent" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverStage(stage.id);
            }}
            onDragLeave={() => setDragOverStage((s) => (s === stage.id ? null : s))}
            onDrop={(e) => {
              e.preventDefault();
              handleDrop(stage.id, e.dataTransfer.getData("text/plain"));
            }}
          >
            <p className="text-sm font-medium">
              {stage.name}
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                ({leadList.filter((l) => l.stage_id === stage.id).length})
              </span>
            </p>
            <div className="space-y-2">
              {leadList
                .filter((l) => l.stage_id === stage.id)
                .map((lead) => (
                  <LeadCard key={lead.id} clientId={clientId} lead={lead} stages={stages} />
                ))}
            </div>
          </div>
        ))}
      </div>
      <AutomationRules clientId={clientId} stages={stages} rules={rules} />
      {isAdmin && (
        <RelatorioComercial
          clientName={clientName ?? "Cliente"}
          stages={stages}
          leads={leadList}
          from={from}
          to={to}
        />
      )}
    </div>
  );
}

function LeadCard({
  clientId,
  lead,
  stages,
}: {
  clientId: string;
  lead: Lead;
  stages: Stage[];
}) {
  const [pending, startTransition] = useTransition();
  const [notes, setNotes] = useState(lead.notes ?? "");
  const [notesPending, startNotesTrans] = useTransition();
  const cardRef = useRef<HTMLDivElement>(null);

  return (
    <Card
      ref={cardRef}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", lead.id);
        // forca o navegador a usar so esse card como imagem de arrasto --
        // sem isso, o preview "fantasma" as vezes captura a coluna inteira
        // (bug visual do drag nativo do browser em grid/flex).
        if (cardRef.current) e.dataTransfer.setDragImage(cardRef.current, 20, 20);
      }}
      className="cursor-grab active:cursor-grabbing select-none"
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0">
            <p className="text-sm font-medium">{lead.name ?? "Sem nome"}</p>
            <p className="text-xs font-mono text-muted-foreground">{lead.phone ?? "-"}</p>
          </div>
          <button
            onClick={() => {
              if (!confirm(`Deletar ${lead.name ?? lead.phone}? Essa ação não pode ser desfeita.`)) return;
              startTransition(async () => {
                await deleteLeadAction(clientId, lead.id);
                toast.success("Lead deletado");
              });
            }}
            disabled={pending}
            className="shrink-0 p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
            title="Deletar lead"
          >
            <Trash2 className="size-3" />
          </button>
        </div>
        {lead.utm_source && <Badge variant="secondary">{lead.utm_source}</Badge>}
        {(lead.campaign_name || (lead.utm_campaign && lead.utm_campaign.length > 1)) && (
          <div className="text-xs text-muted-foreground space-y-0.5">
            <p>📣 {lead.campaign_name ?? lead.utm_campaign}</p>
            {lead.adset_name && <p>🎯 {lead.adset_name}</p>}
            {lead.ad_name && <p>🖼️ {lead.ad_name}</p>}
          </div>
        )}
        <Select
          value={lead.stage_id ?? undefined}
          disabled={pending}
          onValueChange={(stageId: string | null) => {
            if (!stageId) return;
            startTransition(async () => {
              await moveLeadStage(lead.id, stageId, clientId);
              toast.success("Etapa atualizada");
            });
          }}
        >
          <SelectTrigger className="h-7 text-xs">
            <SelectValue>
              {(stageId: string | null) => stages.find((s) => s.id === stageId)?.name ?? "-"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {stages.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <form action={updateLeadRevenue} className="flex gap-1">
          <input type="hidden" name="lead_id" value={lead.id} />
          <input type="hidden" name="client_id" value={clientId} />
          <Input
            name="revenue"
            type="number"
            step="0.01"
            defaultValue={lead.revenue ?? ""}
            placeholder="Receita"
            className="h-7 text-xs"
          />
          <Button type="submit" size="xs" variant="outline">
            Salvar
          </Button>
        </form>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Observação:</p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-md border border-input bg-transparent px-2 py-1 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <Button
            size="xs"
            variant="outline"
            disabled={notesPending}
            onClick={() =>
              startNotesTrans(async () => {
                await updateLeadNotes(lead.id, notes, clientId);
                toast.success("Observação salva");
              })
            }
          >
            Salvar obs.
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function NewLeadDialog({ clientId, stages }: { clientId: string; stages: Stage[] }) {
  const [open, setOpen] = useState(false);
  const [stageId, setStageId] = useState<string | null>(null);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="size-4" /> Novo lead
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar lead manualmente</DialogTitle>
        </DialogHeader>
        <form
          action={async (formData) => {
            if (stageId) formData.set("stage_id", stageId);
            await createLeadManual(formData);
            toast.success("Lead adicionado");
            setOpen(false);
          }}
          className="space-y-4"
        >
          <input type="hidden" name="client_id" value={clientId} />
          <div className="space-y-2">
            <Label htmlFor="nl-name">Nome</Label>
            <Input id="nl-name" name="name" placeholder="Nome do paciente" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nl-phone">Telefone</Label>
            <Input id="nl-phone" name="phone" placeholder="5583999990000" />
          </div>
          <div className="space-y-2">
            <Label>Etapa inicial</Label>
            <Select value={stageId ?? ""} onValueChange={setStageId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {stages.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="nl-notes">Observação (opcional)</Label>
            <Input id="nl-notes" name="notes" placeholder="Interesse em consulta de gastro..." />
          </div>
          <Button type="submit" className="w-full">Adicionar</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AutomationRules({
  clientId,
  stages,
  rules,
}: {
  clientId: string;
  stages: Stage[];
  rules: Rule[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Automação por palavra-chave</CardTitle>
        <CardDescription>
          Mensagens enviadas pela equipe que contêm a palavra-chave movem o lead pra etapa
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {rules.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma regra cadastrada.</p>
        )}
        {rules.map((rule) => (
          <div key={rule.id} className="flex items-center justify-between rounded-md border p-2">
            <p className="text-sm">
              <span className="font-mono">&quot;{rule.keyword}&quot;</span> →{" "}
              {stages.find((s) => s.id === rule.stage_id)?.name ?? "?"}
            </p>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeAutomationRule(rule.id, clientId)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button variant="outline" size="sm" />}>
            <Plus className="size-4" /> Nova regra
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova regra de automação</DialogTitle>
            </DialogHeader>
            <form
              action={async (formData) => {
                await addAutomationRule(formData);
                setOpen(false);
              }}
              className="space-y-4"
            >
              <input type="hidden" name="client_id" value={clientId} />
              <div className="space-y-2">
                <Label htmlFor="keyword">Palavra-chave</Label>
                <Input id="keyword" name="keyword" required placeholder="agendado" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stage_id">Mover pra etapa</Label>
                <Select name="stage_id">
                  <SelectTrigger id="stage_id">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full">
                Salvar
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function findStage(stages: Stage[], kw: string) {
  return stages.find((s) => s.name.toLowerCase().includes(kw.toLowerCase()));
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function pctStr(num: number, den: number) {
  if (!den) return "0%";
  return `${Math.round((num / den) * 100)}%`;
}

function RelatorioComercial({
  clientName,
  stages,
  leads,
  from,
  to,
}: {
  clientName: string;
  stages: Stage[];
  leads: Lead[];
  from: string;
  to: string;
}) {
  const [obs, setObs] = useState("");
  const [plano, setPlano] = useState("");
  const [copied, setCopied] = useState(false);

  const stagePos = Object.fromEntries(stages.map((s) => [s.id, s.position]));
  const stagePerdido = findStage(stages, "perdido");
  const stageAgendado = findStage(stages, "agendado");
  const stageCompareceu = findStage(stages, "compareceu");
  const stageVendido = findStage(stages, "vendido");
  const stageOrcamento = findStage(stages, "orçamento");
  const stageFaltou = findStage(stages, "faltou");

  const ativos = stagePerdido ? leads.filter((l) => l.stage_id !== stagePerdido.id) : leads;
  const total = leads.length;
  const totalAtivos = ativos.length;
  // mesma lógica do crm-stats: Perdido e Faltou usam max_position histórico;
  // demais usam max(posição atual, max_position).
  const effPos = (l: Lead) => {
    if (!l.stage_id) return -1;
    const isPerdido = stagePerdido && l.stage_id === stagePerdido.id;
    const isFaltou = stageFaltou && l.stage_id === stageFaltou.id;
    if (isPerdido || isFaltou) return l.max_position ?? 0;
    const cur = stagePos[l.stage_id] ?? -1;
    if (cur < 0) return -1;
    return Math.max(cur, l.max_position ?? 0);
  };
  const agend = stageAgendado ? leads.filter((l) => effPos(l) >= stageAgendado.position).length : 0;
  const comp = stageCompareceu ? leads.filter((l) => {
    if (stageFaltou && l.stage_id === stageFaltou.id) return false;
    return effPos(l) >= stageCompareceu.position;
  }).length : 0;
  const vend = stageVendido ? leads.filter((l) => l.stage_id === stageVendido.id).length : 0;
  const orc = stageOrcamento ? leads.filter((l) => l.stage_id === stageOrcamento.id).length : 0;
  const leadsOrc = stageOrcamento ? leads.filter((l) => l.stage_id === stageOrcamento.id) : [];
  const leadsVendidos = stageVendido ? leads.filter((l) => l.stage_id === stageVendido.id) : [];
  const leadsAgendados = stageAgendado ? leads.filter((l) => effPos(l) >= stageAgendado.position) : [];
  const faltou = stageFaltou ? leads.filter((l) => l.stage_id === stageFaltou.id).length : 0;
  const receita = leadsVendidos.reduce((acc, l) => acc + (l.revenue ?? 0), 0);
  const receitaOportunidades = [...leadsVendidos, ...leadsOrc].reduce((acc, l) => acc + (l.revenue ?? 0), 0);
  const oportunidades = vend + orc;
  const receitaFmt = receita > 0 ? receita.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }) : "R$ 0";
  const receitaOportFmt = receitaOportunidades > 0 ? receitaOportunidades.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }) : "R$ 0";

  function groupCampaigns(subset: Lead[]) {
    const map = new Map<string, number>();
    for (const l of subset) {
      const camp = l.campaign_name ?? l.utm_campaign ?? "Não identificada";
      const adset = l.adset_name ? ` › ${l.adset_name}` : "";
      const ad = l.ad_name ? ` › ${l.ad_name}` : "";
      const key = `${camp}${adset}${ad}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `- ${k} (${n})`);
  }

  const campAgend = groupCampaigns(leadsAgendados);
  const campVend = groupCampaigns(leadsVendidos);

  const periodo = from === to ? fmtDate(from) : `${fmtDate(from)} a ${fmtDate(to)}`;

  function fmtLead(l: Lead) {
    const phone = l.phone ? l.phone.replace(/^\+55/, "").replace(/(\d{2})(\d{4,5})(\d{4})/, "($1) $2-$3") : "-";
    const val = l.revenue ? l.revenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }) : "";
    return `  • ${l.name || "Sem nome"} | ${phone}${val ? ` | ${val}` : ""}`;
  }

  function buildText() {
    return [
      `📊 Relatório Comercial | ${clientName}`,
      ``,
      `Análise do período ${periodo}`,
      ``,
      `👥 Leads: ${total}`,
      `📞 Agendamentos: ${agend}`,
      `🏥 Comparecimentos: ${comp}`,
      `💰 Vendas: ${vend}`,
      `📄 Orçamento em Aberto: ${orc}`,
      ``,
      `📊 Taxa de Agendamentos: ${pctStr(agend, totalAtivos)}`,
      `📊 Taxa de Comparecimentos: ${pctStr(comp, agend)}`,
      ...(stageFaltou && faltou > 0 ? [`📊 Taxa de No-Show: ${pctStr(faltou, agend)}`] : []),
      `📊 Taxa de Fechamentos (sobre comparecimentos): ${pctStr(vend, comp)}`,
      ``,
      `💵 Faturamento: ${receitaFmt}`,
      `🎯 Total de oportunidades geradas: ${oportunidades} (${receitaOportFmt})`,
      ``,
      ...(leadsVendidos.length ? [`💰 Vendidos (${vend}):`, ...leadsVendidos.map(fmtLead), ``] : []),
      ...(leadsOrc.length ? [`📄 Orçamento em Aberto (${orc}):`, ...leadsOrc.map(fmtLead), ``] : []),
      ...(campAgend.length ? [`📣 Campanhas que geraram agendamentos:`, ...campAgend, ``] : []),
      ...(campVend.length ? [`🏆 Campanhas que geraram vendas:`, ...campVend, ``] : []),
      `📉 Observações Gerais:`,
      obs ? obs.split("\n").map((l) => `- ${l}`).join("\n") : `- `,
      ``,
      `✅ Plano de ação:`,
      plano || ``,
    ].join("\n");
  }

  function copy() {
    navigator.clipboard.writeText(buildText()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Card id="relatorio-comercial">
      <CardHeader>
        <CardTitle>Relatório Comercial</CardTitle>
        <CardDescription>Resumo do período para envio ao cliente. Edite observações e copie o texto.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border bg-muted/30 p-4 font-mono text-xs whitespace-pre-wrap text-muted-foreground leading-relaxed">
          {[
            `📊 Relatório Comercial | ${clientName}`,
            ``,
            `Análise do período ${periodo}`,
            ``,
            `👥 Leads: ${total}`,
            `📞 Agendamentos: ${agend}`,
            `🏥 Comparecimentos: ${comp}`,
            `💰 Vendas: ${vend}`,
            `📄 Orçamento em Aberto: ${orc}`,
            ``,
            `📊 Taxa de Agendamentos: ${pctStr(agend, totalAtivos)}`,
            `📊 Taxa de Comparecimentos: ${pctStr(comp, agend)}`,
            `📊 Taxa de Fechamentos (sobre comparecimentos): ${pctStr(vend, comp)}`,
            ``,
            `💵 Faturamento: ${receitaFmt}`,
            `🎯 Total de oportunidades geradas: ${oportunidades} (${receitaOportFmt})`,
            ``,
            ...(leadsVendidos.length ? [`💰 Vendidos (${vend}):`, ...leadsVendidos.map(fmtLead), ``] : []),
            ...(leadsOrc.length ? [`📄 Orçamento em Aberto (${orc}):`, ...leadsOrc.map(fmtLead), ``] : []),
            ...(campAgend.length ? [`📣 Campanhas que geraram agendamentos:`, ...campAgend] : []),
            ...(campAgend.length && campVend.length ? [`\n`] : []),
            ...(campVend.length ? [`🏆 Campanhas que geraram vendas:`, ...campVend] : []),
          ].join("\n")}
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">📉 Observações Gerais</p>
          <textarea
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            rows={3}
            placeholder="Identificamos queda na taxa de agendamento na terça-feira..."
            className="w-full resize-none rounded-md border border-input bg-transparent px-2 py-1 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">✅ Plano de ação</p>
          <textarea
            value={plano}
            onChange={(e) => setPlano(e.target.value)}
            rows={3}
            placeholder={`1. Ajustar horários de veiculação\n2. Revisar criativos...`}
            className="w-full resize-none rounded-md border border-input bg-transparent px-2 py-1 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <Button size="sm" onClick={copy} className="w-full">
          {copied ? <><Check className="size-4" /> Copiado!</> : <><Copy className="size-4" /> Copiar relatório</>}
        </Button>
      </CardContent>
    </Card>
  );
}
