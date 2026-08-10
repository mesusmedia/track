"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type GoalRow = {
  month: number;
  meta_agendamentos: number;
  meta_consultas: number;
  meta_vendas: number;
  meta_faturamento: number;
  orcamento_midia: number;
  real_investimento: number | null;
  real_cpl: number | null;
};

export type MonthRealizado = {
  total_leads: number;
  agendamentos: number;
  consultas: number;
  vendas: number;
  faturamento: number;
};

export async function upsertGoal(clientId: string, year: number, row: GoalRow) {
  const supabase = await createClient();
  const { error } = await supabase.from("goals").upsert(
    { client_id: clientId, year, ...row, updated_at: new Date().toISOString() },
    { onConflict: "client_id,year,month" },
  );
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/clients/${clientId}/metas`);
}

export async function loadGoals(clientId: string, year: number): Promise<GoalRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("goals")
    .select(
      "month,meta_agendamentos,meta_consultas,meta_vendas,meta_faturamento,orcamento_midia,real_investimento,real_cpl",
    )
    .eq("client_id", clientId)
    .eq("year", year)
    .order("month");
  return (data ?? []) as GoalRow[];
}

export async function loadMonthRealizado(
  clientId: string,
  year: number,
  month: number,
): Promise<MonthRealizado> {
  const supabase = await createClient();

  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const end =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, "0")}-01`;

  const { data: leads } = await supabase
    .from("leads")
    .select("id, revenue, pipeline_stages(name)")
    .eq("client_id", clientId)
    .gte("created_at", start)
    .lt("created_at", end);

  if (!leads || leads.length === 0)
    return { total_leads: 0, agendamentos: 0, consultas: 0, vendas: 0, faturamento: 0 };

  let agendamentos = 0;
  let consultas = 0;
  let vendas = 0;
  let faturamento = 0;

  for (const lead of leads) {
    const ps = lead.pipeline_stages as unknown as { name: string } | null;
    const stageName = ps?.name?.toLowerCase() ?? "";
    if (stageName.includes("agendad")) agendamentos++;
    if (stageName.includes("consult")) consultas++;
    if (stageName.includes("vendid") || stageName.includes("fechad")) vendas++;
    if (lead.revenue) faturamento += Number(lead.revenue);
  }

  return { total_leads: leads.length, agendamentos, consultas, vendas, faturamento };
}

// CPL médio dos últimos N meses com investimento preenchido
export async function loadCplHistorico(
  clientId: string,
  year: number,
  month: number,
  months = 3,
): Promise<number | null> {
  const supabase = await createClient();

  const cpls: number[] = [];

  for (let i = 1; i <= months; i++) {
    let m = month - i;
    let y = year;
    if (m <= 0) { m += 12; y -= 1; }

    const { data: goal } = await supabase
      .from("goals")
      .select("real_investimento")
      .eq("client_id", clientId)
      .eq("year", y)
      .eq("month", m)
      .not("real_investimento", "is", null)
      .maybeSingle();

    if (!goal?.real_investimento) continue;

    const real = await loadMonthRealizado(clientId, y, m);
    if (real.total_leads > 0)
      cpls.push(Number(goal.real_investimento) / real.total_leads);
  }

  if (cpls.length === 0) return null;
  return cpls.reduce((a, b) => a + b, 0) / cpls.length;
}
