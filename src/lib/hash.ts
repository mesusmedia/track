import { createHash } from "crypto";

// Meta exige SHA-256 em minusculo, sem espaco nas pontas. Telefone so digitos.
// https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/customer-information-parameters
export function hashPii(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

export function hashPhone(value: string): string {
  return hashPii(value.replace(/\D/g, ""));
}
