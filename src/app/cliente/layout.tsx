import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { ClienteSidebar } from "@/components/cliente-sidebar";
import { ClienteHeader } from "@/components/cliente-header";

export default async function ClienteLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "client") redirect("/admin");

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  return (
    <div className="flex flex-1 min-h-screen">
      <ClienteSidebar email={auth.user?.email ?? null} />
      <div className="flex-1 flex flex-col min-w-0">
        <ClienteHeader />
        <main className="flex-1 p-6 overflow-y-auto space-y-6">{children}</main>
      </div>
    </div>
  );
}
