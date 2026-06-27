import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// ponytail: pixel_id e measurement_id sao publicos por natureza (vao no
// HTML/network tab de qualquer site que usa Meta Pixel ou GA4) -- por isso
// essa rota nao exige auth, so devolve JS.
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = createServiceClient();

  const { data: client } = await supabase.from("clients").select("id").eq("slug", slug).maybeSingle();
  if (!client) return new NextResponse("// cliente não encontrado", { status: 404 });

  const [{ data: pixels }, { data: ga4Accounts }] = await Promise.all([
    supabase.from("meta_pixels").select("pixel_id").eq("client_id", client.id).eq("active", true),
    supabase.from("ga4_accounts").select("measurement_id").eq("client_id", client.id).eq("active", true),
  ]);

  const pixelIds = (pixels ?? []).map((p) => p.pixel_id);
  const measurementIds = (ga4Accounts ?? []).map((a) => a.measurement_id);

  const js = `
(function () {
  var CLIENT_SLUG = ${JSON.stringify(slug)};
  var PIXEL_IDS = ${JSON.stringify(pixelIds)};
  var MEASUREMENT_IDS = ${JSON.stringify(measurementIds)};

  function getParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }
  function getCookie(name) {
    var match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
    return match ? match[2] : null;
  }
  function uuid() {
    return crypto.randomUUID ? crypto.randomUUID() : Date.now() + "-" + Math.random().toString(16).slice(2);
  }

  var trckUserId = localStorage.getItem("mesus_trck_user_id");
  if (!trckUserId) {
    trckUserId = uuid();
    localStorage.setItem("mesus_trck_user_id", trckUserId);
  }
  window.mesusTrckUserId = trckUserId;

  // Meta Pixel base code
  if (PIXEL_IDS.length) {
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
    n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
    document,'script','https://connect.facebook.net/en_US/fbevents.js');
    PIXEL_IDS.forEach(function (id) { fbq("init", id); });
    fbq("track", "PageView");
  }

  // GA4 gtag.js
  if (MEASUREMENT_IDS.length) {
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + MEASUREMENT_IDS[0];
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    gtag("js", new Date());
    MEASUREMENT_IDS.forEach(function (id) { gtag("config", id); });
  }

  // identificacao: fbclid/gclid/ctwa_clid/utms da URL + fbp/fbc -- so dispara
  // se vier algum parametro novo (evita repetir POST em toda navegacao).
  var fbclid = getParam("fbclid");
  var gclid = getParam("gclid");
  var utmSource = getParam("utm_source");
  var utmMedium = getParam("utm_medium");
  var utmCampaign = getParam("utm_campaign");

  if (fbclid || gclid || utmSource) {
    var fbc = fbclid ? "fb.1." + Date.now() + "." + fbclid : getCookie("_fbc");
    fetch("/api/identify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_slug: CLIENT_SLUG,
        trck_user_id: trckUserId,
        fbp: getCookie("_fbp"),
        fbc: fbc,
        fbclid: fbclid,
        gclid: gclid,
        utm_source: utmSource,
        utm_medium: utmMedium,
        utm_campaign: utmCampaign,
        referrer: document.referrer,
      }),
    }).catch(function () {});
  }

  // window.mesusTrack("Lead", { value: 150, currency: "BRL" }) -- chamar no
  // clique do botao/form de conversao da landing page.
  window.mesusTrack = function (eventName, customData) {
    var eventId = uuid();
    if (PIXEL_IDS.length) fbq("track", eventName, customData || {}, { eventID: eventId });
    if (MEASUREMENT_IDS.length) gtag("event", eventName, customData || {});
    fetch("/api/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_slug: CLIENT_SLUG,
        trck_user_id: trckUserId,
        event_name: eventName,
        event_id: eventId,
        utm_source: utmSource,
        utm_medium: utmMedium,
        utm_campaign: utmCampaign,
        value: customData && customData.value,
        currency: customData && customData.currency,
        content_name: customData && customData.content_name,
      }),
    }).catch(function () {});
  };
})();
`.trim();

  return new NextResponse(js, {
    headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "no-store" },
  });
}
