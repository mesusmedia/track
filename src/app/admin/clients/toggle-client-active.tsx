"use client";

import { useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { toggleClientActive } from "@/lib/crm/actions";
import { toast } from "sonner";

export function ToggleClientActive({ clientId, active }: { clientId: string; active: boolean }) {
  const [pending, start] = useTransition();

  return (
    <button
      disabled={pending}
      onClick={() =>
        start(async () => {
          await toggleClientActive(clientId, !active);
          toast.success(active ? "Cliente desativado" : "Cliente ativado");
        })
      }
      title={active ? "Clique para desativar" : "Clique para ativar"}
      className="cursor-pointer disabled:opacity-50"
    >
      <Badge variant={active ? "secondary" : "outline"} className={active ? "" : "text-muted-foreground"}>
        {pending ? "..." : active ? "Ativo" : "Inativo"}
      </Badge>
    </button>
  );
}
