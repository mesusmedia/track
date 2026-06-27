"use client";

import { useState, useTransition } from "react";
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
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  moveLeadStage,
  updateLeadRevenue,
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
};
type Rule = { id: string; keyword: string; stage_id: string };

export function CrmBoard({
  clientId,
  stages,
  leads,
  rules,
}: {
  clientId: string;
  stages: Stage[];
  leads: Lead[];
  rules: Rule[];
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(220px, 1fr))` }}>
        {stages.map((stage) => (
          <div key={stage.id} className="space-y-2">
            <p className="text-sm font-medium">{stage.name}</p>
            <div className="space-y-2">
              {leads
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

  return (
    <Card>
      <CardContent className="p-3 space-y-2">
        <p className="text-sm font-medium">{lead.name ?? "Sem nome"}</p>
        <p className="text-xs font-mono text-muted-foreground">{lead.phone ?? "-"}</p>
        {lead.utm_source && <Badge variant="secondary">{lead.utm_source}</Badge>}
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
