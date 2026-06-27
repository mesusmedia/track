const BASE_URL = process.env.CHATWOOT_BASE_URL!;
const ACCOUNT_ID = process.env.CHATWOOT_ACCOUNT_ID!;

function headers() {
  return {
    "api-access-token": process.env.CHATWOOT_API_ACCESS_TOKEN!,
    "Content-Type": "application/json",
  };
}

export async function findInboxIdByName(name: string): Promise<string | null> {
  const res = await fetch(`${BASE_URL}/api/v1/accounts/${ACCOUNT_ID}/inboxes`, { headers: headers() });
  const body = await res.json();
  const inbox = (body.payload ?? []).find((i: { name: string }) => i.name === name);
  return inbox ? String(inbox.id) : null;
}
