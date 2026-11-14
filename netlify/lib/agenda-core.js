// Lógica pura de "Agenda ahora": sin red ni base de datos, testeable con `npm test`.

const CATEGORIAS = ["política", "economía", "policiales", "judiciales", "salud", "educación", "clima y servicios", "sociedad", "deportes", "cultura", "rutina"];
const UMBRAL_MEDIOS = 3;      // fuentes distintas (no DRU) para considerar un tema "caliente"
const VENTANA_CALIENTE_H = 2; // en cuántas horas

function decodeXml(s) {
  return (s || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'").replace(/&amp;/g, "&").trim();
}

// Sitemap de Google News: <url><loc>…</loc><news:title>…</news:title><news:publication_date>…
function parseSitemapNews(xml, meta) {
  const out = [];
  for (const b of xml.match(/<url>[\s\S]*?<\/url>/g) || []) {
    const link = decodeXml((b.match(/<loc>([\s\S]*?)<\/loc>/) || [])[1]);
    const title = decodeXml((b.match(/<news:title>([\s\S]*?)<\/news:title>/) || [])[1]);
    const raw = (b.match(/<news:publication_date>([\s\S]*?)<\/news:publication_date>/) || [])[1];
    const d = raw ? new Date(raw.trim()) : null;
    if (link && title && d && !isNaN(d)) out.push({ source: meta.source, city: meta.city, title, link, date: d.toISOString() });
  }
  return out;
}

function selectNew(items, existingLinks, now, horas) {
  const desde = now - horas * 3600e3;
  const vistos = new Set(existingLinks);
  const out = [];
  for (const i of items) {
    if (!i.date || !i.link || vistos.has(i.link)) continue;
    const t = new Date(i.date).getTime();
    if (isNaN(t) || t < desde) continue;
    vistos.add(i.link);
    out.push(i);
  }
  return out;
}

function buildClassifyPrompt(titulares, temas) {
  const activos = temas.length ? temas.map(x => `[${x.id}] ${x.titulo} (${x.categoria})`).join("\n") : "(ninguno)";
  const nuevos = titulares.map((x, i) => `${i}. ${x.titulo} — ${x.fuente}`).join("\n");
  return `Sos editor de agenda de un diario de Entre Ríos. Agrupá titulares de medios regionales en TEMAS: un tema es un mismo hecho o asunto concreto de agenda, no una categoría general. Dos titulares van al mismo tema solo si hablan del mismo hecho.

TEMAS ACTIVOS (últimas 24 h):
${activos}

TITULARES NUEVOS:
${nuevos}

Para cada titular nuevo: si corresponde a un tema activo, usá su id numérico. Si no, creá un tema nuevo con una referencia "N1", "N2", etc. Varios titulares nuevos pueden compartir un tema nuevo.
Para cada tema nuevo: título neutro y descriptivo del hecho (máx 80 caracteres, sin inventar datos que no estén en los titulares) y una categoría de esta lista exacta: ${CATEGORIAS.join(", ")}.
"rutina" es para información de servicio repetitiva: pronóstico diario, loterías, cronogramas de pago, farmacias de turno.

Respondé SOLO con JSON válido, sin texto extra:
{"asignaciones":[{"t":0,"tema":123},{"t":1,"tema":"N1"}],"nuevos":[{"ref":"N1","titulo":"...","categoria":"..."}]}`;
}

function parseClassification(text, n, activeIds) {
  const m = String(text || "").match(/\{[\s\S]*\}/);
  if (!m) throw new Error("Respuesta de clasificación sin JSON");
  const data = JSON.parse(m[0]);
  const ids = new Set(activeIds.map(Number));
  const nuevos = new Map();
  for (const x of data.nuevos || []) {
    if (!x || typeof x.ref !== "string" || !x.titulo) continue;
    const categoria = CATEGORIAS.includes(x.categoria) ? x.categoria : "sociedad";
    nuevos.set(x.ref, { ref: x.ref, titulo: String(x.titulo).slice(0, 120), categoria });
  }
  const asignaciones = [];
  for (const a of data.asignaciones || []) {
    const t = Number(a && a.t);
    if (!Number.isInteger(t) || t < 0 || t >= n) continue;
    const tema = a.tema;
    const asNum = typeof tema === "number" ? tema : (typeof tema === "string" && /^\d+$/.test(tema) ? Number(tema) : null);
    if (asNum !== null && ids.has(asNum)) asignaciones.push({ t, temaId: asNum });
    else if (typeof tema === "string" && nuevos.has(tema)) asignaciones.push({ t, ref: tema });
  }
  return { asignaciones, nuevos: [...nuevos.values()] };
}

function computeAgenda(titulares, temas, now, horas) {
  const ms = (x) => new Date(x).getTime();
  const desde = now - horas * 3600e3;
  const desdeCaliente = now - VENTANA_CALIENTE_H * 3600e3;
  const porTema = new Map();
  for (const t of titulares) {
    if (t.tema_id == null) continue;
    if (!porTema.has(t.tema_id)) porTema.set(t.tema_id, []);
    porTema.get(t.tema_id).push(t);
  }
  const out = [];
  for (const tema of temas) {
    const ts = (porTema.get(tema.id) || []).slice().sort((a, b) => ms(a.publicado) - ms(b.publicado));
    if (!ts.length || ms(ts[ts.length - 1].publicado) < desde) continue;
    const ajenos = ts.filter(t => !t.es_dru);
    const fuentes = (arr) => new Set(arr.map(t => t.fuente)).size;
    out.push({
      id: tema.id,
      titulo: tema.titulo,
      categoria: tema.categoria,
      aviso_enviado: !!tema.aviso_enviado,
      medios_ventana: fuentes(ajenos.filter(t => ms(t.publicado) >= desde)),
      medios_total: fuentes(ajenos),
      cubierto_dru: ts.some(t => t.es_dru),
      caliente: fuentes(ajenos.filter(t => ms(t.publicado) >= desdeCaliente)) >= UMBRAL_MEDIOS,
      primer_visto: ts[0].publicado,
      primera_fuente: ts[0].fuente,
      titulares: ts.slice().reverse().map(t => ({ titulo: t.titulo, fuente: t.fuente, ciudad: t.ciudad, link: t.link, publicado: t.publicado, es_dru: !!t.es_dru }))
    });
  }
  out.sort((a, b) => b.medios_ventana - a.medios_ventana || ms(b.titulares[0].publicado) - ms(a.titulares[0].publicado));
  return out;
}

function temasParaAviso(agenda) {
  return agenda.filter(t => t.caliente && !t.cubierto_dru && !t.aviso_enviado).map(t => t.id);
}

module.exports = { CATEGORIAS, UMBRAL_MEDIOS, VENTANA_CALIENTE_H, parseSitemapNews, selectNew, buildClassifyPrompt, parseClassification, computeAgenda, temasParaAviso };
