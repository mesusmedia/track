import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth/profile";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignOutButton } from "@/components/sign-out-button";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "agency_admin") redirect("/cliente");

  return (
    <div className="flex-1 flex flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <span className="font-semibold tracking-tight">Painel da Agência</span>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <SignOutButton />
        </div>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
