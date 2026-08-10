import { Users, CalendarCheck, UserCheck, TrendingUp, DollarSign } from "lucide-react";

type Stage = { id: string; name: string; position: number };
type Lead = { stage_id: string | null; max_position: number | null; revenue?: number | null };

function pct(num: number, den: number) {
  if (!den) return "—";
  return `${Math.round((num / den) * 100)}%`;
}

function findStage(stages: Stage[], keyword: string) {
  return stages.find((s) => s.name.toLowerCase().includes(keyword.toLowerCase()));
}

export function CrmStats({ stages, leads }: { stages: Stage[]; leads: Lead[] }) {
  const stageAgendado = findStage(stages, "agendado");
  const stageCompareceu = findStage(stages, "compareceu");
  const stageFaltou = findStage(stages, "faltou");
  const stageVendido = findStage(stages, "vendido");
  const stagePerdido = findStage(stages, "perdido");

  const stagePos = Object.fromEntries(stages.map((s) => [s.id, s.position]));

  const total = leads.length;
  const leadsAtivos = stagePerdido
    ? leads.filter((l) => l.stage_id !== stagePerdido.id)
    : leads;
  const totalAtivos = leadsAtivos.length;

  // posição efetiva do lead: máximo entre posição atual e histórica (max_position).
  // Perdido e Faltou usam APENAS max_position (não a posição atual do estágio,
  // que seria alta demais e inflaria métricas). Leads movidos de volta contam
  // pelo histórico registrado em max_position.
  const effPos = (l: { stage_id: string | null; max_position: number | null }) => {
    if (!l.stage_id) return -1;
    const isPerdido = stagePerdido && l.stage_id === stagePerdido.id;
    const isFaltou = stageFaltou && l.stage_id === stageFaltou.id;
    if (isPerdido || isFaltou) return l.max_position ?? 0;
    const cur = stagePos[l.stage_id] ?? -1;
    if (cur < 0) return -1;
    return Math.max(cur, l.max_position ?? 0);
  };
  const countAgendado = stageAgendado
    ? leads.filter((l) => effPos(l) >= stageAgendado.position).length
    : null;
  // exclui leads em Faltou: chegaram ao agendamento mas não compareceram
  const countCompareceu = stageCompareceu
    ? leads.filter((l) => {
        if (stageFaltou && l.stage_id === stageFaltou.id) return false;
        return effPos(l) >= stageCompareceu.position;
      }).length
    : null;
  const countVendido = stageVendido
    ? leads.filter((l) => l.stage_id === stageVendido.id).length
    : null;
  const receita = leads.reduce((acc, l) => acc + (l.revenue ?? 0), 0);

  const cards = [
    {
      icon: Users,
      label: "Leads totais",
      value: String(total),
      sub: totalAtivos !== total ? `${totalAtivos} ativos` : undefined,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      icon: CalendarCheck,
      label: "Taxa de agendamento",
      value: countAgendado !== null ? pct(countAgendado, totalAtivos) : "—",
      sub: countAgendado !== null ? `${countAgendado} agendamentos` : "etapa não encontrada",
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    },
    {
      icon: UserCheck,
      label: "Taxa de comparecimento",
      value: countCompareceu !== null ? pct(countCompareceu, countAgendado ?? totalAtivos) : "—",
      sub: countCompareceu !== null ? `${countCompareceu} comparecimentos` : "etapa não encontrada",
      color: "text-sky-500",
      bg: "bg-sky-500/10",
    },
    {
      icon: TrendingUp,
      label: "Taxa de conversão",
      value: countVendido !== null ? pct(countVendido, countCompareceu ?? countAgendado ?? totalAtivos) : "—",
      sub: countVendido !== null ? `${countVendido} venda${countVendido !== 1 ? "s" : ""}` : "etapa não encontrada",
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      icon: DollarSign,
      label: "Receita atribuída",
      value:
        receita > 0
          ? receita.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
          : "R$ 0",
      sub: countVendido ? `${countVendido} venda${countVendido !== 1 ? "s" : ""} fechada${countVendido !== 1 ? "s" : ""}` : undefined,
      color: "text-violet-500",
      bg: "bg-violet-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((c) => (
        <div key={c.label} className="bg-card border rounded-xl p-4 space-y-2">
          <div className={`size-8 rounded-lg ${c.bg} flex items-center justify-center`}>
            <c.icon className={`size-4 ${c.color}`} />
          </div>
          <p className="text-2xl font-bold tracking-tight">{c.value}</p>
          <div>
            <p className="text-xs font-medium text-foreground/80">{c.label}</p>
            {c.sub && <p className="text-[11px] text-muted-foreground">{c.sub}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
