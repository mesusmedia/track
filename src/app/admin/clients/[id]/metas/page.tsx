import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadGoals, loadMonthRealizado } from "@/lib/goals/actions";
import { ClientSubNav } from "@/components/client-subnav";
import { GoalsEditor } from "@/components/goals-editor";
import { MetaVsRealizado } from "@/components/meta-vs-realizado";

export default async function AdminClientMetasPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const { id } = await params;
  const { year: yearParam, month: monthParam } = await searchParams;
  const year = Number(yearParam) > 2000 ? Number(yearParam) : new Date().getFullYear();
  const month = Number(monthParam) >= 1 && Number(monthParam) <= 12
    ? Number(monthParam)
    : new Date().getMonth() + 1;

  const supabase = await createClient();
  const { data: client } = await supabase.from("clients").select("id, name").eq("id", id).single();
  if (!client) notFound();

  const [goals, realizado] = await Promise.all([
    loadGoals(id, year),
    loadMonthRealizado(id, year, month),
  ]);

  const currentGoal = goals.find((g) => g.month === month) ?? null;
  const years = Array.from({ length: 3 }, (_, i) => new Date().getFullYear() - 1 + i);

  return (
    <div className="space-y-6">
      <ClientSubNav clientId={id} clientName={client.name} />

      {/* cabeçalho + seletor de ano */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Metas</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Defina as metas anuais na grade abaixo e acompanhe o realizado por mês.
          </p>
        </div>
        <div className="flex gap-1">
          {years.map((y) => (
            <a
              key={y}
              href={`?year=${y}&month=${month}`}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                y === year
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {y}
            </a>
          ))}
        </div>
      </div>

      {/* grade anual de metas */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Metas anuais — clique para editar, Tab avança o mês, ⎘ replica para todos
        </p>
        <GoalsEditor clientId={id} year={year} initial={goals} />
      </div>

      {/* divisor */}
      <div className="border-t" />

      {/* análise do mês — Meta vs Realizado + Inteligência */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Análise mensal — Meta vs Realizado
        </p>
        <MetaVsRealizado
          clientId={id}
          year={year}
          month={month}
          goal={currentGoal}
          realizado={realizado}
        />
      </div>
    </div>
  );
}
