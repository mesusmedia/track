import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";

const supabase = createClient(
  "https://akhtbuklaasaiptnruvb.supabase.co",
  "sb_secret_tAqr5qnejxKg9WZtu5BYag_cGvik8mV",
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const email = "gestor.lucasmedeiros@gmail.com";
const tempPassword = randomBytes(9).toString("base64url");

const { data, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
if (listErr) { console.log("Erro listUsers:", listErr.message); process.exit(1); }

const user = data?.users?.find(u => u.email === email);
if (!user) {
  console.log("Não encontrado. Emails disponíveis:");
  data?.users?.slice(0,10).forEach(u => console.log(" -", u.email));
  process.exit(1);
}

const { error } = await supabase.auth.admin.updateUserById(user.id, { password: tempPassword });
if (error) { console.log("Erro reset:", error.message); process.exit(1); }

console.log(`Email: ${email}`);
console.log(`Nova senha: ${tempPassword}`);
