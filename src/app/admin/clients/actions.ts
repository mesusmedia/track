"use server";

import { getProfile } from "@/lib/auth/profile";
import { createServiceClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";

function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function createClientAction(formData: FormData) {
  const profile = await getProfile();
  if (!profile || profile.role !== "agency_admin") {
    throw new Error("Apenas admin da agência pode criar clientes");
  }

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  if (!name || !email) throw new Error("Nome e e-mail são obrigatórios");

  const supabase = createServiceClient();

  const { data: client, error: clientErr } = await supabase
    .from("clients")
    .insert({ agency_id: profile.agency_id, name, slug: slugify(name) })
    .select()
    .single();
  if (clientErr) throw clientErr;

  const { data: settings, error: settingsErr } = await supabase
    .from("settings")
    .insert({ client_id: client.id, webhook_token: randomBytes(24).toString("hex") })
    .select()
    .single();
  if (settingsErr) throw settingsErr;
  void settings;

  const defaultStages = ["Novo", "Em atendimento", "Agendado", "Vendido", "Perdido"];
  const { error: stagesErr } = await supabase.from("pipeline_stages").insert(
    defaultStages.map((name, position) => ({ client_id: client.id, name, position })),
  );
  if (stagesErr) throw stagesErr;

  const tempPassword = randomBytes(9).toString("base64url");
  const { data: userRes, error: userErr } = await supabase.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
  });
  if (userErr) throw userErr;

  const { error: profileErr } = await supabase.from("users_profile").insert({
    id: userRes.user.id,
    agency_id: profile.agency_id,
    role: "client",
    client_id: client.id,
  });
  if (profileErr) throw profileErr;

  revalidatePath("/admin");
  return { client, tempPassword, email };
}

// pra clientes que ja existiam antes de ter login (ex: importados em lote
// dos servidores reais de Evolution/Chatwoot) -- cria so o acesso, sem
// duplicar client/settings/pipeline_stages. Suporta mais de 1 login por
// cliente (ex: medica + secretaria), users_profile nao tem unique em
// client_id.
export async function createClientLoginAction(formData: FormData) {
  const profile = await getProfile();
  if (!profile || profile.role !== "agency_admin") {
    throw new Error("Apenas admin da agência pode criar acesso");
  }

  const clientId = String(formData.get("client_id") ?? "");
  const email = String(formData.get("email") ?? "").trim();
  if (!clientId || !email) throw new Error("E-mail é obrigatório");

  const supabase = createServiceClient();
  const { data: client, error: clientErr } = await supabase
    .from("clients")
    .select("id, agency_id")
    .eq("id", clientId)
    .single();
  if (clientErr) throw clientErr;

  const tempPassword = randomBytes(9).toString("base64url");
  const { data: userRes, error: userErr } = await supabase.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
  });
  if (userErr) throw userErr;

  const { error: profileErr } = await supabase.from("users_profile").insert({
    id: userRes.user.id,
    agency_id: client.agency_id,
    role: "client",
    client_id: client.id,
  });
  if (profileErr) throw profileErr;

  revalidatePath(`/admin/clients/${clientId}/configuracoes`);
  return { tempPassword, email };
}

export async function createAdminUserAction(formData: FormData) {
  const profile = await getProfile();
  if (!profile || profile.role !== "agency_admin") {
    throw new Error("Apenas admin da agência pode criar usuários admin");
  }

  const email = String(formData.get("email") ?? "").trim();
  if (!email) throw new Error("E-mail é obrigatório");

  const supabase = createServiceClient();
  const tempPassword = randomBytes(9).toString("base64url");

  const { data: userRes, error: userErr } = await supabase.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
  });
  if (userErr) throw userErr;

  const { error: profileErr } = await supabase.from("users_profile").insert({
    id: userRes.user.id,
    agency_id: profile.agency_id,
    role: "agency_admin",
    client_id: null,
  });
  if (profileErr) throw profileErr;

  revalidatePath("/admin/equipe");
  return { tempPassword, email };
}
