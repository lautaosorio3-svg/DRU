const HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};

// Feeds verificados el 04/07/2026 — todos con notas del día.
// Los sitios WordPress bloquean user-agents no-navegador: UA de browser obligatorio.
const FEEDS = [
  { source: "Diario Junio", city: "Concordia", url: "https://www.diariojunio.com.ar/feed/" },
  { source: "7Páginas", city: "Concordia", url: "https://7paginas.com.ar/feed/" },
  { source: "El Heraldo", city: "Concordia", url: "https://elheraldoapiv3.eleco.com.ar/feed-notes" },
  { source: "La Calle", city: "C. del Uruguay", url: "https://lacalle.com.ar/feed/" },
  { source: "03442", city: "C. del Uruguay", url: "https://03442.com.ar/feed/" },
  { source: "El Día", city: "Gualeguaychú", url: "https://eldiaapiv3.eleco.com.ar/feed-notes" },
  { source: "Chajarí al Día", city: "Chajarí", url: "https://chajarialdia.com.ar/?feed=rss2" },
  { source: "Federación al Día", city: "Federación", url: "https://www.federacionaldia.com.ar/?feed=rss2" },
  { source: "Entre Ríos Ahora", city: "Paraná", url: "https://entreriosahora.com/feed/" }
];

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

function decodeEntities(s) {
  return (s || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'").replace(/&#8217;/g, "'").replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"').replace(/&#8211;/g, "–").replace(/&amp;/g, "&")
    .replace(/<[^>]+>/g, "").trim();
}

// Parsea RSS 2.0 (<item>) y Atom (<entry>) con regex — sin dependencias.
function parseFeed(xml, feedMeta) {
  const items = [];
  const isAtom = /<feed[\s>]/.test(xml) && !/<rss/.test(xml);
  const blockRe = isAtom ? /<entry[\s>][\s\S]*?<\/entry>/g : /<item[\s>]?[\s\S]*?<\/item>/g;
  const blocks = xml.match(blockRe) || [];
  for (const b of blocks.slice(0, 25)) {
    const title = decodeEntities((b.match(/<title[^>]*>([\s\S]*?)<\/title>/) || [])[1]);
    let link = "";
    if (isAtom) {
      link = (b.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"/) || b.match(/<link[^>]*href="([^"]+)"/) || [])[1] || "";
    } else {
      link = decodeEntities((b.match(/<link>([\s\S]*?)<\/link>/) || [])[1]);
    }
    const dateRaw = (b.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || b.match(/<updated>([\s\S]*?)<\/updated>/) || b.match(/<published>([\s\S]*?)<\/published>/) || [])[1] || "";
    const date = dateRaw ? new Date(dateRaw.trim()).toISOString() : null;
    if (title && link) items.push({ source: feedMeta.source, city: feedMeta.city, title, link: link.trim(), date });
  }
  return items;
}

async function fetchFeed(feedMeta) {
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(feedMeta.url, { headers: { "User-Agent": UA }, signal: ctrl.signal });
    clearTimeout(to);
    if (!res.ok) return [];
    const xml = await res.text();
    return parseFeed(xml, feedMeta);
  } catch {
    return [];
  }
}

async function fetchAllFeeds(hours = 48) {
  const results = await Promise.all(FEEDS.map(fetchFeed));
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  const items = results.flat().filter(i => !i.date || new Date(i.date).getTime() >= cutoff);
  items.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  return items;
}

// ── Supabase (opcional: solo para alertas por keyword) ──
function supaHeaders() {
  const key = process.env.SUPABASE_SERVICE_KEY;
  return { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` };
}
function supaConfigured() {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);
}

function normalize(s) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Matchea titulares contra keywords vigiladas y guarda alertas nuevas (dedupe por link).
async function checkAlertas(hours = 24) {
  if (!supaConfigured()) return { configured: false, alertas: [] };
  const base = process.env.SUPABASE_URL + "/rest/v1";

  const kwRes = await fetch(`${base}/keywords?select=palabra`, { headers: supaHeaders() });
  const keywords = (await kwRes.json() || []).map(k => k.palabra).filter(Boolean);
  if (!keywords.length) return { configured: true, alertas: [], keywords: 0 };

  const items = await fetchAllFeeds(hours);
  const matches = [];
  for (const it of items) {
    const t = normalize(it.title);
    const kw = keywords.find(k => t.includes(normalize(k)));
    if (kw) matches.push({ titulo: it.title.substring(0, 300), link: it.link, fuente: it.source, ciudad: it.city, keyword: kw, publicado: it.date });
  }
  if (!matches.length) return { configured: true, alertas: [], keywords: keywords.length };

  // Upsert ignorando duplicados por link → solo entran alertas nuevas
  const insRes = await fetch(`${base}/alertas?on_conflict=link`, {
    method: "POST",
    headers: { ...supaHeaders(), Prefer: "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify(matches)
  });
  const inserted = insRes.ok ? await insRes.json() : [];
  return { configured: true, alertas: inserted, matched: matches.length, keywords: keywords.length };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: HEADERS, body: "" };

  const qs = event.queryStringParameters || {};
  const action = qs.action || "titulares";
  const hours = Math.min(parseInt(qs.hours, 10) || 48, 168);

  try {
    if (action === "titulares") {
      const items = await fetchAllFeeds(hours);
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ items, sources: FEEDS.map(f => f.source), hours }) };
    }
    if (action === "check-alertas") {
      const result = await checkAlertas(hours);
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify(result) };
    }
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: "Acción no válida" }) };
  } catch (err) {
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: err.message }) };
  }
};

// Compartido con rss-alertas.js (función programada)
exports.checkAlertas = checkAlertas;
exports.fetchAllFeeds = fetchAllFeeds;
