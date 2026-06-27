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
