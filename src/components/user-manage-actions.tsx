"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Trash2 } from "lucide-react";
import { resetUserPasswordAction, deleteUserAction } from "@/app/admin/clients/actions";

export function UserManageActions({ userId }: { userId: string }) {
  const router = useRouter();
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [busy, setBusy] = useState<"reset" | "delete" | null>(null);

  async function handleReset() {
    setBusy("reset");
    try {
      const fd = new FormData();
      fd.append("user_id", userId);
      const result = await resetUserPasswordAction(fd);
      setTempPassword(result.tempPassword);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Erro ao resetar senha");
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete() {
    if (!confirm("Excluir este usuário? Essa ação não pode ser desfeita.")) return;
    setBusy("delete");
    try {
      const fd = new FormData();
      fd.append("user_id", userId);
      await deleteUserAction(fd);
      router.refresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Erro ao excluir usuário");
      setBusy(null);
    }
  }

  if (tempPassword) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-1 rounded">
          Nova senha: {tempPassword}
        </span>
        <button
          onClick={() => setTempPassword(null)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ok
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 ml-auto">
      <button
        onClick={handleReset}
        disabled={busy !== null}
        title="Resetar senha"
        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-40"
      >
        <RotateCcw className="size-3.5" />
      </button>
      <button
        onClick={handleDelete}
        disabled={busy !== null}
        title="Excluir usuário"
        className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}
