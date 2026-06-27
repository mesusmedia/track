import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth/profile";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignOutButton } from "@/components/sign-out-button";

export default async function ClienteLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "client") redirect("/admin");

  return (
    <div className="flex-1 flex flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-6">
          <span className="font-semibold tracking-tight">Painel do Cliente</span>
          <nav className="flex gap-4 text-sm text-muted-foreground">
            <Link href="/cliente" className="hover:text-foreground">
              Visão geral
            </Link>
            <Link href="/cliente/crm" className="hover:text-foreground">
              CRM
            </Link>
            <Link href="/cliente/configuracoes" className="hover:text-foreground">
              Configurações
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <SignOutButton />
        </div>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
