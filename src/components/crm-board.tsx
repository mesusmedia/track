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
import { Plus, Trash2, CalendarRange } from "lucide-react";
import { toast } from "sonner";
import {
  moveLeadStage,
  updateLeadRevenue,
  updateLeadNotes,
  addAutomationRule,
  removeAutomationRule,
} from "@/lib/crm/actions";

type Stage = { id: string; name: string; position: number };
type Lead = {
  id: string;
  name: string | null;
  phone: string | null;
  stage_id: string | null;
  revenue: number | null;
  utm_source: string | null;
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
  stages,
  leads,
  rules,
  from,
  to,
}: {
  clientId: string;
  stages: Stage[];
  leads: Lead[];
  rules: Rule[];
  from: string;
  to: string;
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

      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(220px, 1fr))` }}>
        {stages.map((stage) => (
          <div
            key={stage.id}
            className={`space-y-2 rounded-lg p-1 select-none transition-colors ${dragOverStage === stage.id ? "bg-accent" : ""}`}
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
            <p className="text-sm font-medium">{stage.name}</p>
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
        <p className="text-sm font-medium">{lead.name ?? "Sem nome"}</p>
        <p className="text-xs font-mono text-muted-foreground">{lead.phone ?? "-"}</p>
        {lead.utm_source && <Badge variant="secondary">{lead.utm_source}</Badge>}
        {lead.campaign_name && (
          <div className="text-xs text-muted-foreground space-y-0.5">
            <p>📣 {lead.campaign_name}</p>
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
