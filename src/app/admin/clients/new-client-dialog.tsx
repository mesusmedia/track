"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClientAction } from "./actions";
import { Plus } from "lucide-react";

export function NewClientDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [credentials, setCredentials] = useState<{ email: string; tempPassword: string } | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(formData: FormData) {
    setSubmitting(true);
    try {
      const result = await createClientAction(formData);
      setCredentials({ email: result.email, tempPassword: result.tempPassword });
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setCredentials(null);
      }}
    >
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="size-4" /> Novo cliente
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo cliente</DialogTitle>
        </DialogHeader>
        {credentials ? (
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Cliente criado. Envie esse acesso temporário (ele deve trocar a senha):
            </p>
            <div className="rounded-md border p-3 font-mono text-sm space-y-1">
              <p>e-mail: {credentials.email}</p>
              <p>senha: {credentials.tempPassword}</p>
            </div>
            <Button className="w-full" onClick={() => setOpen(false)}>
              Fechar
            </Button>
          </div>
        ) : (
          <form action={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do cliente</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail de login do cliente</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Criando..." : "Criar cliente"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
