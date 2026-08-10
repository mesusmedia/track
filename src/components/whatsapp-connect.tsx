"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
  saveWabaConfig,
} from "@/lib/whatsapp/actions";

export function WhatsappConnect({
  clientId,
  hasInstance,
  chatwootInboxId,
  wabaPhoneNumberId,
}: {
  clientId: string;
  hasInstance: boolean;
  chatwootInboxId: string | null;
  wabaPhoneNumberId?: string | null;
}) {
  const router = useRouter();
  const [qrcode, setQrcode] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [instanceName, setInstanceName] = useState("");
  const [pending, startTransition] = useTransition();
  const [linked, setLinked] = useState(hasInstance);
  const [localInboxId, setLocalInboxId] = useState(chatwootInboxId);
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [wabaId, setWabaId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [wabaSaved, setWabaSaved] = useState(!!wabaPhoneNumberId);

  return (
    <div className="space-y-4 max-w-sm">
      <div className="flex items-center gap-2">
        <Badge variant={localInboxId ? "default" : "secondary"}>
          {localInboxId ? "Inbox vinculada" : linked ? "Instância criada" : "Não conectado"}
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
          {linked ? "Gerar novo QR code" : "Conectar WhatsApp"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending || !linked}
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
          disabled={pending || !linked}
          onClick={() =>
            startTransition(async () => {
              const result = await syncChatwootInbox(clientId);
              if (result.linked) {
                toast.success("Inbox do Chatwoot vinculada");
                setLocalInboxId(String(result.inboxId));
                router.refresh();
              } else {
                toast.error("Inbox ainda não existe — conecte o WhatsApp primeiro (escaneie o QR)");
              }
            })
          }
        >
          Sincronizar inbox do Chatwoot
        </Button>
      </div>

      {!linked && (
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
                    setLinked(true);
                    if (result.inboxLinked) setLocalInboxId("linked");
                    toast.success(
                      result.inboxLinked
                        ? "Instância e inbox do Chatwoot vinculadas"
                        : `Instância vinculada (inbox do Chatwoot: clique em "Sincronizar inbox" depois de conectar o WhatsApp)`,
                    );
                    router.refresh();
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

      {/* Migração para API Oficial do WhatsApp (Meta Cloud API) */}
      <div className="space-y-3 pt-3 border-t">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">API Oficial Meta</span>
          {wabaSaved && <Badge variant="default">Configurado</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">
          Substitui o Evolution — mais estável, sem risco de banimento. Configure no Meta Business Manager → WhatsApp Manager.
        </p>
        <div className="space-y-2">
          <Input
            placeholder="Phone Number ID (ex: 123456789012345)"
            value={phoneNumberId}
            onChange={(e) => setPhoneNumberId(e.target.value)}
          />
          <Input
            placeholder="WABA ID (WhatsApp Business Account ID)"
            value={wabaId}
            onChange={(e) => setWabaId(e.target.value)}
          />
          <Input
            type="password"
            placeholder="System User Token (permanente)"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
          />
          <Button
            size="sm"
            disabled={pending || !phoneNumberId.trim() || !wabaId.trim() || !accessToken.trim()}
            onClick={() =>
              startTransition(async () => {
                try {
                  await saveWabaConfig(clientId, phoneNumberId, wabaId, accessToken);
                  setWabaSaved(true);
                  setAccessToken("");
                  toast.success("API Oficial configurada — webhook: /api/webhook/whatsapp");
                  router.refresh();
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Erro ao salvar configuração");
                }
              })
            }
          >
            Salvar configuração
          </Button>
        </div>
        {wabaSaved && (
          <p className="text-xs text-muted-foreground">
            Configure o webhook no Meta:{" "}
            <code className="text-xs bg-muted px-1 rounded">
              {typeof window !== "undefined" ? window.location.origin : ""}/api/webhook/whatsapp
            </code>
          </p>
        )}
      </div>
    </div>
  );
}
