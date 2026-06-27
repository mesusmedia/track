// ponytail: campos abaixo seguem o formato publicamente documentado de cada
// plataforma (Hotmart webhook v2, Kiwify "order.paid", Eduzz webhook v3) a
// partir de conhecimento geral -- a doc oficial estava bloqueada (CloudFront
// 403) no momento da implementacao. CONFERIR com um payload real de cada
// plataforma antes de ligar em produção; ajustar os caminhos abaixo se
// necessário. O adapter "generic" aceita nomes de campo nossos diretamente
// e serve tanto de fallback quanto pra testar o webhook sem uma conta real.

export type NormalizedPurchase = {
  transactionId: string;
  value: number | null;
  currency: string;
  status: string;
  email: string | null;
  phone: string | null;
  productName: string | null;
  trckUserId: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
};

type Body = Record<string, any>;

function get(obj: Body, path: string): any {
  return path.split(".").reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function normalizeHotmart(body: Body): NormalizedPurchase {
  const purchase = get(body, "data.purchase") ?? {};
  return {
    transactionId: purchase.transaction ?? get(body, "data.purchase.transaction"),
    value: purchase.price?.value ?? null,
    currency: purchase.price?.currency_value ?? "BRL",
    status: purchase.status ?? body.event ?? "unknown",
    email: get(body, "data.buyer.email") ?? null,
    phone: get(body, "data.buyer.checkout_phone") ?? null,
    productName: get(body, "data.product.name") ?? null,
    trckUserId: purchase.tracking?.source_sck ?? purchase.tracking?.source ?? null,
    utmSource: purchase.tracking?.source ?? null,
    utmMedium: null,
    utmCampaign: null,
  };
}

function normalizeKiwify(body: Body): NormalizedPurchase {
  return {
    transactionId: body.order_id ?? body.order?.id,
    value: body.order?.payment?.amount ? body.order.payment.amount / 100 : null,
    currency: body.order?.payment?.currency ?? "BRL",
    status: body.order_status ?? body.status ?? "unknown",
    email: body.Customer?.email ?? body.customer?.email ?? null,
    phone: body.Customer?.mobile ?? body.customer?.mobile ?? null,
    productName: body.Product?.name ?? body.product?.name ?? null,
    trckUserId: body.TrackingParameters?.src ?? body.tracking_parameters?.src ?? null,
    utmSource: body.TrackingParameters?.utm_source ?? null,
    utmMedium: body.TrackingParameters?.utm_medium ?? null,
    utmCampaign: body.TrackingParameters?.utm_campaign ?? null,
  };
}

function normalizeEduzz(body: Body): NormalizedPurchase {
  return {
    transactionId: body.trans_cod ?? body.id,
    value: body.trans_valor ?? body.amount ?? null,
    currency: "BRL",
    status: body.trans_status ?? body.status ?? "unknown",
    email: body.cus_email ?? body.customer?.email ?? null,
    phone: body.cus_cel ?? body.customer?.phone ?? null,
    productName: body.product_name ?? null,
    trckUserId: body.trans_sck ?? null,
    utmSource: body.utm_source ?? null,
    utmMedium: body.utm_medium ?? null,
    utmCampaign: body.utm_campaign ?? null,
  };
}

function normalizeGeneric(body: Body): NormalizedPurchase {
  return {
    transactionId: body.transaction_id,
    value: typeof body.value === "number" ? body.value : null,
    currency: body.currency ?? "BRL",
    status: body.status ?? "paid",
    email: body.email ?? null,
    phone: body.phone ?? null,
    productName: body.product_name ?? null,
    trckUserId: body.trck_user_id ?? null,
    utmSource: body.utm_source ?? null,
    utmMedium: body.utm_medium ?? null,
    utmCampaign: body.utm_campaign ?? null,
  };
}

export function normalizePurchase(platform: string, body: Body): NormalizedPurchase {
  switch (platform) {
    case "hotmart":
      return normalizeHotmart(body);
    case "kiwify":
      return normalizeKiwify(body);
    case "eduzz":
      return normalizeEduzz(body);
    default:
      return normalizeGeneric(body);
  }
}
