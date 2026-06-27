import { createClient } from "@/lib/supabase/server";

const THIRTY_DAYS_AGO = () => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

export async function loadOverview(clientId: string) {
  const supabase = await createClient();
  const since = THIRTY_DAYS_AGO();

  const [eventsRes, purchasesRes, leadsRes, stagesRes] = await Promise.all([
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
    supabase.from("leads").select("id, stage_id").eq("client_id", clientId),
    supabase
      .from("pipeline_stages")
      .select("id, name, position")
      .eq("client_id", clientId)
      .order("position"),
  ]);

  const events = eventsRes.data ?? [];
  const purchases = purchasesRes.data ?? [];
  const leads = leadsRes.data ?? [];
  const stages = stagesRes.data ?? [];

  const revenue30d = purchases.reduce((sum, p) => sum + Number(p.valor ?? 0), 0);

  const leadsByStage = stages.map((stage) => ({
    name: stage.name,
    count: leads.filter((l) => l.stage_id === stage.id).length,
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
    events30d: events.length,
    revenue30d,
    purchases30d: purchases.length,
    leadsByStage,
    leadsTotal: leads.length,
    topGeo,
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
