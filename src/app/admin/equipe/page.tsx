import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/profile";
import { createAdminUserAction } from "@/app/admin/clients/actions";
import { Users2 } from "lucide-react";
import { NewAdminUserForm } from "./new-admin-user-form";

export default async function AdminEquipePage() {
  const profile = await getProfile();
  const supabase = await createClient();
  const service = createServiceClient();

  const { data: adminProfiles } = await service
    .from("users_profile")
    .select("id, created_at")
    .eq("agency_id", profile!.agency_id)
    .eq("role", "agency_admin")
    .order("created_at", { ascending: true });

  // busca emails do auth para cada profile
  const users: { id: string; email: string; createdAt: string }[] = [];
  for (const p of adminProfiles ?? []) {
    const { data } = await service.auth.admin.getUserById(p.id);
    if (data?.user) users.push({ id: p.id, email: data.user.email ?? p.id, createdAt: p.created_at });
  }

  void supabase;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Equipe</h2>
        <p className="text-sm text-muted-foreground">Usuários com acesso de administrador</p>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="p-5 border-b flex items-center justify-between">
          <p className="text-sm font-medium">{users.length} administrador{users.length !== 1 ? "es" : ""}</p>
        </div>
        {users.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">Nenhum admin cadastrado.</p>
        ) : (
          <ul className="divide-y">
            {users.map((u) => (
              <li key={u.id} className="flex items-center gap-3 px-5 py-3">
                <div className="size-8 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                  {u.email[0]?.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{u.email}</p>
                  <p className="text-xs text-muted-foreground">
                    desde {new Date(u.createdAt).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <span className="ml-auto text-[10px] font-bold text-primary uppercase tracking-wider bg-primary/10 px-2 py-0.5 rounded-full">
                  Admin
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <NewAdminUserForm action={createAdminUserAction} />
    </div>
  );
}
