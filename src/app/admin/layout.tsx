import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { AdminSidebar } from "@/components/admin-sidebar";
import { AdminHeader } from "@/components/admin-header";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "agency_admin") redirect("/cliente");

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  return (
    <div className="flex flex-1 min-h-screen">
      <AdminSidebar email={auth.user?.email ?? null} />
      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader />
        <main className="flex-1 p-6 overflow-y-auto space-y-6">{children}</main>
      </div>
    </div>
  );
}
