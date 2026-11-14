// IO de "Agenda ahora": lee fuentes, guarda en Supabase y clasifica con Haiku.
// La lógica pura vive en agenda-core.js.
const core = require("./agenda-core");
const { FEEDS, parseFeed } = require("../functions/rss-trends");

const MODELO = "claude-haiku-5-5";
const LOTE = 60;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

// Verificados el 13/11/2026.
const EXTRA_RSS = [
  { source: "El Argentino", city: "Gualeguaychú", url: "https://www.elargentino.com.ar/feed/" },
  { source: "El Diario", city: "Paraná", url: "https://www.eldiario.com.ar/feed/" },
  { source: "Concordia Hoy", city: "Concordia", url: "https://www.concordiahoy.com/feed/" }
];
const SITEMAPS = [
  { source: "El Once", city: "Paraná", url: "https://elonce.com/sitemap-news.xml" },
  { source: "Análisis", city: "Paraná", url: "https://www.analisisdigital.com.ar/news-sitemap.xml" },
  { source: "UNO Entre Ríos", city: "Paraná", url: "https://www.unoentrerios.com.ar/sitemap-news.xml" },
  { source: "Máxima Online", city: "Entre Ríos", url: "https://www.maximaonline.com.ar/sitemap-news.xml" },
  { source: "El Entre Ríos", city: "Entre Ríos", url: "https://www.elentrerios.com/sitemap-news.xml" }
];
const DRU = { source: "DRU", city: "Concordia", url: "https://www.diarioriouruguay.com/sitemap-news.xml" };

const enc = encodeURIComponent;
const isoAgo = (now, horas) => new Date(now - horas * 3600e3).toISOString();

async function fetchSource(meta, parser) {
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(meta.url, { headers: { "User-Agent": UA }, signal: ctrl.signal });
    clearTimeout(to);
    if (!res.ok) throw new Error("HTTP " + res.status);
    return { ok: true, source: meta.source, items: parser(await res.text(), meta) };
  } catch (e) {
    return { ok: false, source: meta.source, error: e.message, items: [] };
  }
}

async function fetchAll() {
  const jobs = [
    ...FEEDS.map(m => [m, parseFeed]),
    ...EXTRA_RSS.map(m => [m, parseFeed]),
    ...SITEMAPS.map(m => [m, core.parseSitemapNews]),
    [DRU, core.parseSitemapNews]
  ];
  const res = await Promise.all(jobs.map(([m, p]) => fetchSource(m, p)));
  return {
    fuentes: jobs.length,
    fallidas: res.filter(r => !r.ok).map(r => `${r.source} (${r.error})`),
    items: res.flatMap(r => r.items.map(i => ({ ...i, es_dru: i.source === DRU.source })))
  };
}

function supa() {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  const base = url.trim().replace(/\/+$/, "").replace(/\/rest\/v1$/, "") + "/rest/v1";
  const headers = { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` };
  return async function req(path, opts = {}) {
    const r = await fetch(base + path, { ...opts, headers: { ...headers, ...(opts.headers || {}) } });
    const txt = await r.text();
    const data = txt ? JSON.parse(txt) : null;
    if (!r.ok) throw new Error(`Supabase ${r.status}: ${(data && data.message) || txt.slice(0, 200)}`);
    return data;
  };
}

async function clasificar(titulares, temas) {
  const key = process.env.ANTHROPIC_API_KEY_drudigital || process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("API key de Anthropic no configurada");
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: MODELO,
      max_tokens: 4000,
      thinking: { type: "disabled" },
      messages: [{ role: "user", content: core.buildClassifyPrompt(titulares, temas) }]
    })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`Anthropic ${r.status}: ${JSON.stringify(data.error || data).slice(0, 200)}`);
  const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
  return core.parseClassification(text, titulares.length, temas.map(t => t.id));
}

async function aplicarClasificacion(req, pendientes, { asignaciones, nuevos }) {
  const grupos = new Map(); // "id:123" | "ref:N1" → titulares
  for (const a of asignaciones) {
    const key = a.temaId != null ? "id:" + a.temaId : "ref:" + a.ref;
    if (!grupos.has(key)) grupos.set(key, []);
    grupos.get(key).push(pendientes[a.t]);
  }
  const fechas = (ts) => ts.map(t => new Date(t.publicado).toISOString()).sort();
  const refToId = new Map();
  const usados = nuevos.filter(n => grupos.has("ref:" + n.ref));
  if (usados.length) {
    const filas = usados.map(n => {
      const f = fechas(grupos.get("ref:" + n.ref));
      return { titulo: n.titulo, categoria: n.categoria, primer_visto: f[0], ultimo_visto: f[f.length - 1] };
    });
    const creados = await req("/agenda_temas", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(filas) });
    usados.forEach((n, i) => refToId.set(n.ref, creados[i].id));
  }
  const ops = [];
  for (const [key, ts] of grupos) {
    const temaId = key.startsWith("id:") ? Number(key.slice(3)) : refToId.get(key.slice(4));
    if (temaId == null) continue;
    ops.push(req(`/agenda_titulares?id=in.(${ts.map(t => t.id).join(",")})`, { method: "PATCH", body: JSON.stringify({ tema_id: temaId }) }));
    if (key.startsWith("id:")) {
      const max = fechas(ts).pop();
      ops.push(req(`/agenda_temas?id=eq.${temaId}&ultimo_visto=lt.${enc(max)}`, { method: "PATCH", body: JSON.stringify({ ultimo_visto: max }) }));
    }
  }
  await Promise.all(ops);
  return asignaciones.length;
}

async function leerAgenda(req, now, horas) {
  const d24 = enc(isoAgo(now, 24));
  const [titulares, temas] = await Promise.all([
    req(`/agenda_titulares?select=tema_id,titulo,fuente,ciudad,link,publicado,es_dru&tema_id=not.is.null&publicado=gte.${d24}&order=publicado.desc&limit=1000`),
    req(`/agenda_temas?select=id,titulo,categoria,aviso_enviado&ultimo_visto=gte.${d24}&order=ultimo_visto.desc&limit=1000`)
  ]);
  return core.computeAgenda(titulares, temas, now, horas);
}

async function runRecolector(now = Date.now()) {
  const req = supa();
  if (!req) return { configured: false };
  const t0 = Date.now();
  const d24 = enc(isoAgo(now, 24));

  const { fuentes, fallidas, items } = await fetchAll();
  const existentes = await req(`/agenda_titulares?select=link&publicado=gte.${d24}&order=publicado.desc&limit=1000`);
  const nuevos = core.selectNew(items, new Set(existentes.map(x => x.link)), now, 24);
  if (nuevos.length) {
    await req("/agenda_titulares?on_conflict=link", {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates" },
      body: JSON.stringify(nuevos.map(i => ({ link: i.link, titulo: i.title.slice(0, 300), fuente: i.source, ciudad: i.city, publicado: i.date, es_dru: !!i.es_dru })))
    });
  }

  let clasificados = 0, errorIA = null;
  const pendientes = await req(`/agenda_titulares?select=id,titulo,fuente,publicado&tema_id=is.null&publicado=gte.${d24}&order=publicado.desc&limit=${LOTE}`);
  if (pendientes.length) {
    try {
      const temas = await req(`/agenda_temas?select=id,titulo,categoria&ultimo_visto=gte.${d24}&order=ultimo_visto.desc&limit=300`);
      clasificados = await aplicarClasificacion(req, pendientes, await clasificar(pendientes, temas));
    } catch (e) {
      errorIA = e.message; // quedan sin tema y se reintentan en la próxima corrida
    }
  }

  const avisoIds = core.temasParaAviso(await leerAgenda(req, now, core.VENTANA_CALIENTE_H));
  if (avisoIds.length) await req(`/agenda_temas?id=in.(${avisoIds.join(",")})`, { method: "PATCH", body: JSON.stringify({ aviso_enviado: true }) });

  const d7 = enc(isoAgo(now, 24 * 7));
  await req(`/agenda_titulares?publicado=lt.${d7}`, { method: "DELETE" });
  await req(`/agenda_temas?ultimo_visto=lt.${d7}`, { method: "DELETE" });

  return { configured: true, fuentes, fallidas, nuevos: nuevos.length, pendientes: pendientes.length, clasificados, avisos: avisoIds.length, errorIA, ms: Date.now() - t0 };
}

async function obtenerAgenda(horas) {
  const req = supa();
  if (!req) return { configured: false };
  return { configured: true, temas: await leerAgenda(req, Date.now(), horas) };
}

module.exports = { runRecolector, obtenerAgenda };
