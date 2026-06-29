"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClientLoginAction } from "@/app/admin/clients/actions";

type Login = { email: string; role: string; createdAt: string };

export function ClientLoginAccess({ clientId, logins }: { clientId: string; logins: Login[] }) {
  const router = useRouter();
  const [credentials, setCredentials] = useState<{ email: string; tempPassword: string } | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(formData: FormData) {
    setSubmitting(true);
    try {
      const result = await createClientLoginAction(formData);
      setCredentials(result);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-card border rounded-xl p-5 space-y-4">
      <div>
        <h2 className="text-base font-semibold">Acesso de login</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Crie um login pra esse cliente (médico, secretária, etc) — todos veem só os dados
          desse cliente. Pode criar mais de um.
        </p>
      </div>

      {logins.length > 0 && (
        <div className="space-y-1.5">
          {logins.map((l) => (
            <div key={l.email} className="flex items-center justify-between text-sm border rounded-md px-3 py-2">
              <span>{l.email}</span>
              <span className="text-xs text-muted-foreground">
                criado em {new Date(l.createdAt).toLocaleDateString("pt-BR")}
              </span>
            </div>
          ))}
        </div>
      )}

      {credentials ? (
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Acesso criado. Envie pra pessoa (ela deve trocar a senha no primeiro login):
          </p>
          <div className="rounded-md border p-3 font-mono text-sm space-y-1">
            <p>e-mail: {credentials.email}</p>
            <p>senha: {credentials.tempPassword}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setCredentials(null)}>
            Criar outro acesso
          </Button>
        </div>
      ) : (
        <form action={handleSubmit} className="flex items-end gap-2">
          <input type="hidden" name="client_id" value={clientId} />
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="login-email">E-mail de login</Label>
            <Input id="login-email" name="email" type="email" required placeholder="secretaria@cliente.com" />
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Criando..." : "Criar acesso"}
          </Button>
        </form>
      )}
    </div>
  );
}
