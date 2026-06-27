import Image from "next/image";
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
          <Image src="/logo-mesus.png" alt="Mesus Media" width={120} height={40} className="h-7 w-auto" priority />
          <nav className="flex gap-4 text-sm text-muted-foreground">
            <Link href="/cliente" className="hover:text-foreground">
              Visão geral
            </Link>
            <Link href="/cliente/crm" className="hover:text-foreground">
              CRM
            </Link>
            <Link href="/cliente/eventos" className="hover:text-foreground">
              Eventos
            </Link>
            <Link href="/cliente/faturamento" className="hover:text-foreground">
              Faturamento
            </Link>
            <Link href="/cliente/campanhas" className="hover:text-foreground">
              Campanhas
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
