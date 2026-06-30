"use client";

import { useActionState } from "react";
import { UserPlus } from "lucide-react";

type ActionResult = { email: string; tempPassword: string } | undefined;

export function NewAdminUserForm({
  action,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  const [result, dispatch, pending] = useActionState<ActionResult, FormData>(
    async (_, formData) => action(formData),
    undefined,
  );

  return (
    <div className="bg-card border rounded-xl p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <UserPlus className="size-4" /> Adicionar administrador
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          O usuário recebe acesso total ao painel de admin.
        </p>
      </div>

      {result && (
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 space-y-1">
          <p className="text-sm font-semibold text-primary">Usuário criado!</p>
          <p className="text-xs text-muted-foreground">
            E-mail: <span className="font-mono font-medium">{result.email}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Senha temporária: <span className="font-mono font-medium">{result.tempPassword}</span>
          </p>
          <p className="text-xs text-muted-foreground">Peça para trocar a senha no primeiro acesso.</p>
        </div>
      )}

      <form action={dispatch} className="flex gap-2">
        <input
          name="email"
          type="email"
          required
          placeholder="email@agencia.com.br"
          className="flex-1 bg-accent border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors"
        />
        <button
          type="submit"
          disabled={pending}
          className="bg-primary hover:bg-primary/85 text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
        >
          {pending ? "Criando..." : "Criar acesso"}
        </button>
      </form>
    </div>
  );
}
