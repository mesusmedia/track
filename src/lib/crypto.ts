import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// ponytail: AES-256-GCM em codigo de servidor em vez de pgcrypto no Postgres
// (evita ter que expor a chave de cifragem como GUC de sessao do banco).
// Layout do buffer: [iv(12) | authTag(16) | ciphertext]
const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const hex = process.env.SECRETS_ENCRYPTION_KEY;
  if (!hex) throw new Error("SECRETS_ENCRYPTION_KEY nao configurada");
  return Buffer.from(hex, "hex");
}

export function encryptSecret(plaintext: string): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
}

export function decryptSecret(encrypted: Buffer): string {
  const iv = encrypted.subarray(0, 12);
  const authTag = encrypted.subarray(12, 28);
  const ciphertext = encrypted.subarray(28);
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export function maskSecret(plaintext: string): string {
  if (plaintext.length <= 4) return "••••";
  return `••••${plaintext.slice(-4)}`;
}

// postgrest devolve bytea como string hex prefixada com "\x"
export function byteaToBuffer(value: string): Buffer {
  return Buffer.from(value.startsWith("\\x") ? value.slice(2) : value, "hex");
}
