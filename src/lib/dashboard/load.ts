import { createClient } from "@/lib/supabase/server";

function originOf(lead: {
  ctwa_clid: string | null;
  source_id: string | null;
  campaign_name: string | null;
  utm_source: string | null;
}) {
  if (lead.ctwa_clid || lead.source_id) return "Meta";
  if (lead.campaign_name) return "Google";
  if (lead.utm_source) return lead.utm_source;
  return null;
}

export async function loadOverview(clientId: string, periodDays = 30) {
  const supabase = await createClient();
  const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString();

  // ponytail: 5 buckets fixos de semana (independente do periodo
  // selecionado) pra sparkline dos cards -- mesmo padrao da Visao geral
  // do admin, sem tabela de agregacao.
  const weekBuckets = await Promise.all(
    [4, 3, 2, 1, 0].map(async (weeksAgo) => {
      const from = new Date(Date.now() - (weeksAgo + 1) * 7 * 24 * 60 * 60 * 1000).toISOString();
      const to = new Date(Date.now() - weeksAgo * 7 * 24 * 60 * 60 * 1000).toISOString();
      const [leadsCount, eventsCount, purchasesRows] = await Promise.all([
        supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("client_id", clientId)
          .gte("created_at", from)
          .lt("created_at", to),
        supabase
          .from("events_log")
          .select("id", { count: "exact", head: true })
          .eq("client_id", clientId)
          .gte("created_at", from)
          .lt("created_at", to),
        supabase
          .from("purchases")
          .select("valor")
          .eq("client_id", clientId)
          .eq("status", "paid")
          .gte("created_at", from)
          .lt("created_at", to),
      ]);
      const revenue = (purchasesRows.data ?? []).reduce((sum, p) => sum + Number(p.valor ?? 0), 0);
      return {
        leads: leadsCount.count ?? 0,
        events: eventsCount.count ?? 0,
        sales: purchasesRows.data?.length ?? 0,
        revenue,
      };
    }),
  );

  const [eventsRes, purchasesRes, leadsRes, stagesRes, leadsTotalRes] = await Promise.all([
    supabase
      .from("events_log")
      .select("id, geo_country, geo_city")
      .eq("client_id", clientId)
      .gte("created_at", since),
    supabase
      .from("purchases")
      .select("valor")
      .eq("client_id", clientId)
      .eq("status", "paid")
      .gte("created_at", since),
    supabase
      .from("leads")
      .select(
        "id, name, phone, avatar_url, stage_id, revenue, ctwa_clid, source_id, campaign_name, utm_source, created_at",
      )
      .eq("client_id", clientId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("pipeline_stages")
      .select("id, name, position")
      .eq("client_id", clientId)
      .order("position"),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("client_id", clientId),
  ]);

  const events = eventsRes.data ?? [];
  const purchases = purchasesRes.data ?? [];
  const leads = leadsRes.data ?? [];
  const stages = stagesRes.data ?? [];
  const stageName = (stageId: string | null) => stages.find((s) => s.id === stageId)?.name ?? null;

  const revenuePeriod = purchases.reduce((sum, p) => sum + Number(p.valor ?? 0), 0);

  const leadRows = leads.map((lead) => ({
    id: lead.id as string,
    name: (lead.name as string | null) ?? (lead.phone as string | null) ?? "Sem nome",
    phone: lead.phone as string | null,
    avatarUrl: lead.avatar_url as string | null,
    stageName: stageName(lead.stage_id as string | null),
    origin: originOf(lead),
    createdAt: lead.created_at as string,
    revenue: lead.revenue as number | null,
  }));

  const geoCounts = new Map<string, number>();
  for (const e of events) {
    if (!e.geo_country) continue;
    const key = e.geo_city ? `${e.geo_city}, ${e.geo_country}` : e.geo_country;
    geoCounts.set(key, (geoCounts.get(key) ?? 0) + 1);
  }
  const topGeo = [...geoCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([place, count]) => ({ place, count }));

  return {
    periodDays,
    eventsPeriod: events.length,
    revenuePeriod,
    purchasesPeriod: purchases.length,
    leadsPeriod: leads.length,
    leadsTotal: leadsTotalRes.count ?? 0,
    leadRows,
    topGeo,
    weekBuckets,
  };
}

export async function loadEvents(clientId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events_log")
    .select("id, event_name, utm_source, utm_medium, utm_campaign, response_meta, response_ga4, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(100);

  return (data ?? []).map((e) => ({
    ...e,
    metaOk: Array.isArray(e.response_meta) ? e.response_meta.every((r: { ok?: boolean }) => r.ok !== false) : null,
    ga4Ok: Array.isArray(e.response_ga4) ? e.response_ga4.every((r: { ok?: boolean }) => r.ok !== false) : null,
  }));
}

export async function loadBilling(clientId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("purchases")
    .select("id, transaction_id, produto, valor, moeda, status, utm_campaign, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(200);

  const purchases = data ?? [];
  const paid = purchases.filter((p) => p.status === "paid");
  const totalRevenue = paid.reduce((sum, p) => sum + Number(p.valor ?? 0), 0);

  const byDay = new Map<string, number>();
  for (const p of paid) {
    const day = new Date(p.created_at).toLocaleDateString("pt-BR");
    byDay.set(day, (byDay.get(day) ?? 0) + Number(p.valor ?? 0));
  }
  const chartData = [...byDay.entries()].reverse().map(([day, total]) => ({ day, total }));

  return { purchases, totalRevenue, paidCount: paid.length, chartData };
}

export async function loadCampaigns(clientId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("purchases")
    .select("utm_campaign, valor")
    .eq("client_id", clientId)
    .eq("status", "paid");

  const byCampaign = new Map<string, { revenue: number; sales: number }>();
  for (const p of data ?? []) {
    const key = p.utm_campaign ?? "(sem campanha)";
    const entry = byCampaign.get(key) ?? { revenue: 0, sales: 0 };
    entry.revenue += Number(p.valor ?? 0);
    entry.sales += 1;
    byCampaign.set(key, entry);
  }

  const { data: adAccounts } = await supabase
    .from("meta_ad_accounts")
    .select("id, label")
    .eq("client_id", clientId);

  return {
    campaigns: [...byCampaign.entries()]
      .map(([campaign, v]) => ({ campaign, ...v }))
      .sort((a, b) => b.revenue - a.revenue),
    hasMetaAdsConfigured: (adAccounts ?? []).length > 0,
  };
}