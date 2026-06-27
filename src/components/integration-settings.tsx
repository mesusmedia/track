"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Trash2, Plug } from "lucide-react";
import { toast } from "sonner";
import {
  addIntegrationAccount,
  addGoogleAdsAccount,
  removeIntegrationAccount,
  removeGoogleAdsAccount,
  updateWhatsappNumber,
} from "@/lib/integrations/actions";
import {
  testGa4Connection,
  testMetaPixelConnection,
  testMetaAdAccountConnection,
  testGoogleAdsConnection,
} from "@/lib/integrations/test-connection";
import { WhatsappConnect } from "@/components/whatsapp-connect";

type Account = { id: string; label: string; masked: string; idValue: string };

export function IntegrationSettings({
  clientId,
  settings,
  ga4,
  metaPixels,
  metaAds,
  googleAds,
}: {
  clientId: string;
  settings: {
    webhook_token: string;
    whatsapp_number: string | null;
    evolution_instance_apikey_enc: string | null;
    chatwoot_inbox_id: string | null;
  };
  ga4: Account[];
  metaPixels: Account[];
  metaAds: Account[];
  googleAds: Account[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Contas de integração</CardTitle>
        <CardDescription>GA4, Meta Pixel, Meta Ads e Google Ads — todas opcionais por cliente</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="geral">
          <TabsList>
            <TabsTrigger value="geral">Geral</TabsTrigger>
            <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
            <TabsTrigger value="ga4">GA4</TabsTrigger>
            <TabsTrigger value="meta_pixel">Meta Pixel</TabsTrigger>
            <TabsTrigger value="meta_ads">Meta Ads</TabsTrigger>
            <TabsTrigger value="google_ads">Google Ads</TabsTrigger>
          </TabsList>
          <TabsContent value="whatsapp" className="pt-4">
            <WhatsappConnect
              clientId={clientId}
              hasInstance={!!settings.evolution_instance_apikey_enc}
              chatwootInboxId={settings.chatwoot_inbox_id}
            />
          </TabsContent>
          <TabsContent value="geral" className="space-y-4 pt-4">
            <form action={updateWhatsappNumber} className="space-y-4 max-w-sm">
              <input type="hidden" name="client_id" value={clientId} />
              <div className="space-y-2">
                <Label htmlFor="whatsapp_number">Número de WhatsApp (com DDI/DDD)</Label>
                <Input
                  id="whatsapp_number"
                  name="whatsapp_number"
                  defaultValue={settings.whatsapp_number ?? ""}
                  placeholder="5511999999999"
                />
              </div>
              <Button type="submit" size="sm">
                Salvar
              </Button>
            </form>
            <div className="space-y-2 max-w-sm">
              <Label>Token do webhook de compra</Label>
              <Input readOnly value={settings.webhook_token} className="font-mono text-xs" />
            </div>
          </TabsContent>
          <TabsContent value="ga4" className="space-y-3 pt-4">
            <AccountList
              clientId={clientId}
              accounts={ga4}
              idLabel="Measurement ID"
              idField="measurement_id"
              secretLabel="API Secret"
              type="ga4"
              onTest={testGa4Connection}
            />
          </TabsContent>
          <TabsContent value="meta_pixel" className="space-y-3 pt-4">
            <AccountList
              clientId={clientId}
              accounts={metaPixels}
              idLabel="Pixel ID"
              idField="pixel_id"
              secretLabel="Token CAPI"
              type="meta_pixel"
              onTest={testMetaPixelConnection}
            />
          </TabsContent>
          <TabsContent value="meta_ads" className="space-y-3 pt-4">
            <AccountList
              clientId={clientId}
              accounts={metaAds}
              idLabel="Ad Account ID"
              idField="ad_account_id"
              secretLabel="Token de Ads"
              type="meta_ads"
              onTest={testMetaAdAccountConnection}
            />
          </TabsContent>
          <TabsContent value="google_ads" className="space-y-3 pt-4">
            <GoogleAdsList clientId={clientId} accounts={googleAds} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function AccountList({
  clientId,
  accounts,
  idLabel,
  idField,
  secretLabel,
  type,
  onTest,
}: {
  clientId: string;
  accounts: Account[];
  idLabel: string;
  idField: string;
  secretLabel: string;
  type: "ga4" | "meta_pixel" | "meta_ads";
  onTest: (accountId: string, clientId: string) => Promise<{ ok: boolean; message: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      {accounts.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhuma conta cadastrada.</p>
      )}
      {accounts.map((acc) => (
        <div key={acc.id} className="flex items-center justify-between rounded-md border p-3">
          <div>
            <p className="text-sm font-medium">{acc.label}</p>
            <p className="text-xs font-mono text-muted-foreground">
              {acc.idValue} · {acc.masked}
            </p>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await onTest(acc.id, clientId);
                  if (r.ok) toast.success(r.message);
                  else toast.error(r.message);
                })
              }
            >
              <Plug className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await removeIntegrationAccount(type, acc.id, clientId);
                  toast.success("Conta removida");
                })
              }
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
      ))}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button variant="outline" size="sm" />}>
          <Plus className="size-4" /> Adicionar
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar conta</DialogTitle>
          </DialogHeader>
          <form
            action={async (formData) => {
              await addIntegrationAccount(type, formData);
              setOpen(false);
            }}
            className="space-y-4"
          >
            <input type="hidden" name="client_id" value={clientId} />
            <div className="space-y-2">
              <Label htmlFor={`${type}-label`}>Nome (rótulo)</Label>
              <Input id={`${type}-label`} name="label" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${type}-id`}>{idLabel}</Label>
              <Input id={`${type}-id`} name={idField} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${type}-secret`}>{secretLabel}</Label>
              <Input id={`${type}-secret`} name="secret" type="password" required />
            </div>
            <Button type="submit" className="w-full">
              Salvar
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GoogleAdsList({ clientId, accounts }: { clientId: string; accounts: Account[] }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      {accounts.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhuma conta cadastrada.</p>
      )}
      {accounts.map((acc) => (
        <div key={acc.id} className="flex items-center justify-between rounded-md border p-3">
          <div>
            <p className="text-sm font-medium">{acc.label}</p>
            <p className="text-xs font-mono text-muted-foreground">
              {acc.idValue} · {acc.masked}
            </p>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await testGoogleAdsConnection();
                  if (r.ok) toast.success(r.message);
                  else toast.error(r.message);
                })
              }
            >
              <Plug className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await removeGoogleAdsAccount(acc.id, clientId);
                  toast.success("Conta removida");
                })
              }
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
      ))}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button variant="outline" size="sm" />}>
          <Plus className="size-4" /> Adicionar
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar conta Google Ads</DialogTitle>
          </DialogHeader>
          <form
            action={async (formData) => {
              await addGoogleAdsAccount(formData);
              setOpen(false);
            }}
            className="space-y-4"
          >
            <input type="hidden" name="client_id" value={clientId} />
            <div className="space-y-2">
              <Label htmlFor="ga-label">Nome (rótulo)</Label>
              <Input id="ga-label" name="label" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ga-customer">Customer ID</Label>
              <Input id="ga-customer" name="customer_id" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ga-login-customer">Login Customer ID (MCC, opcional)</Label>
              <Input id="ga-login-customer" name="login_customer_id" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ga-refresh">Refresh Token (OAuth)</Label>
              <Input id="ga-refresh" name="refresh_token" type="password" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ga-dev-token">Developer Token</Label>
              <Input id="ga-dev-token" name="developer_token" type="password" required />
            </div>
            <Button type="submit" className="w-full">
              Salvar
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
