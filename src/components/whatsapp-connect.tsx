"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  connectWhatsapp,
  getWhatsappStatus,
  syncChatwootInbox,
  linkExistingInstance,
} from "@/lib/whatsapp/actions";

export function WhatsappConnect({
  clientId,
  hasInstance,
  chatwootInboxId,
}: {
  clientId: string;
  hasInstance: boolean;
  chatwootInboxId: string | null;
}) {
  const [qrcode, setQrcode] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [instanceName, setInstanceName] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4 max-w-sm">
      <div className="flex items-center gap-2">
        <Badge variant={chatwootInboxId ? "default" : "secondary"}>
          {chatwootInboxId ? "Inbox vinculada" : hasInstance ? "Instância criada" : "Não conectado"}
        </Badge>
        {status && <Badge variant="outline">{status}</Badge>}
      </div>

      {qrcode && (
        <div className="rounded-md border p-2 w-fit">
          <Image src={qrcode} alt="QR Code do WhatsApp" width={220} height={220} unoptimized />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await connectWhatsapp(clientId);
              if (result.qrcodeBase64) {
                setQrcode(result.qrcodeBase64);
                toast.success("Escaneie o QR code com o WhatsApp");
              } else {
                toast.error("Não foi possível gerar o QR code (talvez já esteja conectado)");
              }
            })
          }
        >
          {hasInstance ? "Gerar novo QR code" : "Conectar WhatsApp"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending || !hasInstance}
          onClick={() =>
            startTransition(async () => {
              const result = await getWhatsappStatus(clientId);
              setStatus(result.state);
            })
          }
        >
          Checar status
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending || !hasInstance}
          onClick={() =>
            startTransition(async () => {
              const result = await syncChatwootInbox(clientId);
              if (result.linked) toast.success("Inbox do Chatwoot vinculada");
              else toast.error("Inbox ainda não existe — conecte o WhatsApp primeiro (escaneie o QR)");
            })
          }
        >
          Sincronizar inbox do Chatwoot
        </Button>
      </div>

      {!hasInstance && (
        <div className="space-y-2 pt-2 border-t">
          <Label htmlFor="instance_name">Ou vincular instância já existente no servidor</Label>
          <div className="flex gap-2">
            <Input
              id="instance_name"
              placeholder="Nome exato da instância no Evolution"
              value={instanceName}
              onChange={(e) => setInstanceName(e.target.value)}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={pending || !instanceName.trim()}
              onClick={() =>
                startTransition(async () => {
                  try {
                    const result = await linkExistingInstance(clientId, instanceName);
                    toast.success(
                      result.inboxLinked
                        ? "Instância e inbox do Chatwoot vinculadas"
                        : `Instância vinculada, mas a inbox "${result.chatwootInboxName ?? "?"}" não foi encontrada no Chatwoot`,
                    );
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Erro ao vincular instância");
                  }
                })
              }
            >
              Vincular
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
