import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Home() {
  return (
    <div className="flex-1 flex flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <span className="font-semibold tracking-tight">Plataforma de Tracking & CRM</span>
        <ThemeToggle />
      </header>
      <main className="flex-1 p-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="backdrop-blur supports-[backdrop-filter]:bg-card/60">
          <CardHeader>
            <CardTitle>Fase 0</CardTitle>
            <CardDescription>Setup do projeto</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Badge>Next.js + Supabase + Vercel</Badge>
            <p className="text-sm text-muted-foreground font-mono tabular-nums">
              Design system ativo: tema escuro padrao, verde-neon primario.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
