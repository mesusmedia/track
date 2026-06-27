import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import crypto from "crypto";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

function decryptSecret(encrypted) {
  const key = Buffer.from(env.SECRETS_ENCRYPTION_KEY, "hex");
  const iv = encrypted.subarray(0, 12);
  const authTag = encrypted.subarray(12, 28);
  const ciphertext = encrypted.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const { data } = await supabase
  .from("settings")
  .select("evolution_instance_apikey_enc")
  .eq("evolution_instance_name", "C52-DrLucasPitao")
  .single();

const hex = data.evolution_instance_apikey_enc.startsWith("\\x")
  ? data.evolution_instance_apikey_enc.slice(2)
  : data.evolution_instance_apikey_enc;
console.log(decryptSecret(Buffer.from(hex, "hex")));
