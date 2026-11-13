# Agenda ahora — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sección "Agenda ahora": cada 15 min se recolectan titulares de 17 medios entrerrianos + DRU, Haiku los agrupa en temas y el panel muestra qué está en agenda, cuántos medios lo cubren y si DRU ya lo publicó.

**Architecture:** Lógica pura en `netlify/lib/agenda-core.js` (testeada con `node --test`). IO (fuentes, Supabase, Anthropic) en `netlify/lib/agenda-run.js`. Dos functions finas: `agenda-recolector.js` (programada) y `agenda.js` (HTTP: leer agenda y forzar corrida). UI en `index.html` siguiendo el patrón de Alertas.

**Tech Stack:** Node 24 (sin dependencias nuevas), Netlify Functions (esbuild) + Scheduled Functions, Supabase REST (PostgREST), Anthropic Messages API, SPA vanilla JS.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-11-13-agenda-ahora-design.md`.
- Modelo de clasificación: `claude-haiku-5-5` (verificado en vivo el 2026-11-13), `thinking: {type: "disabled"}`.
- Umbral caliente: ≥3 fuentes distintas no-DRU en 2 h. Ventanas de la pantalla: 2 h / 24 h.
- Categorías exactas: política, economía, policiales, judiciales, salud, educación, clima y servicios, sociedad, deportes, cultura, rutina. "rutina" oculta por defecto.
- Titulares de >7 días se borran. Lote máximo por corrida de clasificación: 60 titulares.
- Toda corrida debe terminar en <26 s (límite HTTP; scheduled = 30 s). Fetch por fuente con timeout de 8 s.
- Todo contenido externo que vaya a `innerHTML` pasa por `esc()`; links por `encodeURI()`.
- Nada de "generar nota completa" desde titulares (riesgo de inventar datos).
- Pushes agrupados (créditos Netlify): un push al terminar el backend (Task 3) y otro al terminar la UI (Task 4).
- Commits terminan con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## File Structure

- Create `netlify/lib/agenda-core.js` — funciones puras: parseo de sitemaps News, filtrado de nuevos, prompt y parseo de clasificación, cálculo de agenda y avisos.
- Create `tests/agenda-core.test.js` — tests `node:test`.
- Create `netlify/lib/agenda-run.js` — fuentes, fetch, Supabase, Anthropic; exporta `runRecolector()` y `obtenerAgenda(horas)`.
- Create `netlify/functions/agenda-recolector.js` — handler programado.
- Create `netlify/functions/agenda.js` — handler HTTP.
- Modify `netlify/functions/rss-trends.js` — exportar `FEEDS` y `parseFeed`.
- Modify `netlify.toml` — schedule del recolector.
- Modify `package.json` — script `test`.
- Modify `SUPABASE_SETUP.md`, `DOCUMENTACION.md`, spec — SQL y documentación.
- Modify `index.html` — menú, página, JS.

---

### Task 1: Lógica pura (`agenda-core.js`) con tests

**Files:**
- Create: `netlify/lib/agenda-core.js`
- Create: `tests/agenda-core.test.js`
- Modify: `package.json`

**Interfaces:**
- Produces:
  - `CATEGORIAS: string[]`, `UMBRAL_MEDIOS = 3`, `VENTANA_CALIENTE_H = 2`
  - `parseSitemapNews(xml: string, meta: {source, city}) → Array<{source, city, title, link, date: ISOString}>`
  - `selectNew(items, existingLinks: Set<string>, now: number, horas: number) → items` (con fecha, dentro de la ventana, link no existente, sin duplicados)
  - `buildClassifyPrompt(titulares: Array<{titulo, fuente}>, temas: Array<{id, titulo, categoria}>) → string`
  - `parseClassification(text: string, n: number, activeIds: number[]) → {asignaciones: Array<{t, temaId}|{t, ref}>, nuevos: Array<{ref, titulo, categoria}>}`
  - `computeAgenda(titulares, temas, now, horas) → Array<Tema>` donde Tema = `{id, titulo, categoria, aviso_enviado, medios_ventana, medios_total, cubierto_dru, caliente, primer_visto, primera_fuente, titulares: [{titulo, fuente, ciudad, link, publicado, es_dru}]}` (titulares del más nuevo al más viejo)
  - `temasParaAviso(agenda) → number[]`

- [ ] **Step 1: Script de test**

`package.json`:
```json
{
  "name": "dru-editorial",
  "private": true,
  "scripts": {
    "test": "node --test tests/"
  },
  "dependencies": {
    "@netlify/blobs": "^8.1.0"
  }
}
```

- [ ] **Step 2: Tests que fallan** — `tests/agenda-core.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../netlify/lib/agenda-core");

const H = 3600e3;
const NOW = Date.parse("2026-11-13T15:00:00Z");
const iso = (msAgo) => new Date(NOW - msAgo).toISOString();

test("parseSitemapNews extrae link, título y fecha", () => {
  const xml = `<urlset><url><loc>https://elonce.com/a</loc><news:news><news:publication_date>2026-11-13T14:00:00-03:00</news:publication_date><news:title><![CDATA[Corte de luz en Paraná &amp; alrededores]]></news:title></news:news></url>
  <url><loc>https://elonce.com/sin-titulo</loc></url></urlset>`;
  const items = core.parseSitemapNews(xml, { source: "El Once", city: "Paraná" });
  assert.equal(items.length, 1);
  assert.deepEqual(items[0], { source: "El Once", city: "Paraná", title: "Corte de luz en Paraná & alrededores", link: "https://elonce.com/a", date: "2026-11-13T17:00:00.000Z" });
});

test("selectNew filtra viejos, sin fecha, existentes y duplicados", () => {
  const items = [
    { link: "a", date: iso(1 * H) },
    { link: "a", date: iso(1 * H) },
    { link: "b", date: iso(30 * H) },
    { link: "c", date: null },
    { link: "d", date: iso(2 * H) }
  ];
  const out = core.selectNew(items, new Set(["d"]), NOW, 24);
  assert.deepEqual(out.map(i => i.link), ["a"]);
});

test("buildClassifyPrompt incluye temas activos, titulares y categorías", () => {
  const p = core.buildClassifyPrompt([{ titulo: "Paro docente", fuente: "UNO" }], [{ id: 7, titulo: "Temporal", categoria: "clima y servicios" }]);
  assert.match(p, /\[7\] Temporal \(clima y servicios\)/);
  assert.match(p, /0\. Paro docente — UNO/);
  assert.match(p, /rutina/);
});

test("parseClassification valida ids, refs y categorías", () => {
  const text = 'Acá va:\n```json\n{"asignaciones":[{"t":0,"tema":7},{"t":1,"tema":"N1"},{"t":2,"tema":"99"},{"t":5,"tema":7},{"t":3,"tema":"N9"},{"t":4,"tema":"7"}],"nuevos":[{"ref":"N1","titulo":"Paro docente","categoria":"educación"},{"ref":"N2","titulo":"X","categoria":"inventada"}]}\n```';
  const r = core.parseClassification(text, 5, [7]);
  assert.deepEqual(r.asignaciones, [{ t: 0, temaId: 7 }, { t: 1, ref: "N1" }, { t: 4, temaId: 7 }]);
  assert.deepEqual(r.nuevos, [{ ref: "N1", titulo: "Paro docente", categoria: "educación" }, { ref: "N2", titulo: "X", categoria: "sociedad" }]);
});

test("parseClassification tira error si no hay JSON", () => {
  assert.throws(() => core.parseClassification("no sé", 1, []), /JSON/);
});

test("computeAgenda cuenta medios, cobertura DRU y caliente", () => {
  const temas = [
    { id: 1, titulo: "Temporal", categoria: "clima y servicios", aviso_enviado: false },
    { id: 2, titulo: "Paro", categoria: "educación", aviso_enviado: false },
    { id: 3, titulo: "Viejo", categoria: "sociedad", aviso_enviado: false }
  ];
  const t = (tema_id, fuente, hAgo, es_dru = false) => ({ tema_id, fuente, ciudad: "x", titulo: fuente + tema_id, link: fuente + tema_id + hAgo, publicado: iso(hAgo * H), es_dru });
  const titulares = [
    t(1, "UNO", 0.5), t(1, "El Once", 1), t(1, "Análisis", 1.5), t(1, "UNO", 1.6),
    t(2, "UNO", 1), t(2, "El Once", 5), t(2, "DRU", 0.2, true),
    t(3, "UNO", 10)
  ];
  const ag = core.computeAgenda(titulares, temas, NOW, 2);
  assert.deepEqual(ag.map(x => x.id), [1, 2]);
  const [temporal, paro] = ag;
  assert.equal(temporal.medios_ventana, 3);
  assert.equal(temporal.medios_total, 3);
  assert.equal(temporal.caliente, true);
  assert.equal(temporal.cubierto_dru, false);
  assert.equal(temporal.primera_fuente, "UNO");
  assert.equal(temporal.primer_visto, iso(1.6 * H));
  assert.equal(temporal.titulares[0].publicado, iso(0.5 * H));
  assert.equal(paro.medios_ventana, 1);
  assert.equal(paro.medios_total, 2);
  assert.equal(paro.caliente, false);
  assert.equal(paro.cubierto_dru, true);
  assert.deepEqual(core.computeAgenda(titulares, temas, NOW, 24).map(x => x.id), [1, 2, 3]);
});

test("temasParaAviso: caliente, sin DRU y sin aviso previo", () => {
  const ag = [
    { id: 1, caliente: true, cubierto_dru: false, aviso_enviado: false },
    { id: 2, caliente: true, cubierto_dru: true, aviso_enviado: false },
    { id: 3, caliente: true, cubierto_dru: false, aviso_enviado: true },
    { id: 4, caliente: false, cubierto_dru: false, aviso_enviado: false }
  ];
  assert.deepEqual(core.temasParaAviso(ag), [1]);
});
```

- [ ] **Step 3: Correr y ver que fallan**

Run: `npm test`
Expected: FAIL — `Cannot find module '../netlify/lib/agenda-core'`.

- [ ] **Step 4: Implementación** — `netlify/lib/agenda-core.js`:

```js
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
```

- [ ] **Step 5: Correr y ver que pasan**

Run: `npm test`
Expected: 7 tests, `# pass 7`, `# fail 0`.

- [ ] **Step 6: Commit**

```bash
git add package.json netlify/lib/agenda-core.js tests/agenda-core.test.js
git commit -m "Agenda ahora: lógica pura de agrupado y cálculo de agenda + tests"
```

---

### Task 2: Recolector, endpoint y SQL

**Files:**
- Create: `netlify/lib/agenda-run.js`
- Create: `netlify/functions/agenda-recolector.js`
- Create: `netlify/functions/agenda.js`
- Modify: `netlify/functions/rss-trends.js` (final del archivo)
- Modify: `netlify.toml`
- Modify: `SUPABASE_SETUP.md`, `docs/superpowers/specs/2026-11-13-agenda-ahora-design.md`

**Interfaces:**
- Consumes: todo `agenda-core.js` (Task 1); `FEEDS`, `parseFeed` de `rss-trends.js`.
- Produces:
  - `runRecolector(now?: number) → {configured, fuentes, fallidas: string[], nuevos, pendientes, clasificados, avisos, errorIA, ms}`
  - `obtenerAgenda(horas: 2|24) → {configured, temas: Tema[]}`
  - HTTP `GET /.netlify/functions/agenda?horas=2|24` → `{configured, temas}` o `{configured:true, error, faltanTablas}`
  - HTTP `POST /.netlify/functions/agenda` body `{"action":"run"}` → resultado de `runRecolector`

- [ ] **Step 1: Exportar FEEDS y parseFeed** — al final de `netlify/functions/rss-trends.js`, después de `exports.fetchAllFeeds = fetchAllFeeds;`:

```js
// Compartido con netlify/lib/agenda-run.js (Agenda ahora)
exports.FEEDS = FEEDS;
exports.parseFeed = parseFeed;
```

- [ ] **Step 2: `netlify/lib/agenda-run.js`**

```js
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
```

- [ ] **Step 3: `netlify/functions/agenda-recolector.js`**

```js
// Función programada (cada 15 min, ver netlify.toml): recolecta titulares
// de los medios entrerrianos y los agrupa en temas para "Agenda ahora".
const { runRecolector } = require("../lib/agenda-run");

exports.handler = async () => {
  try {
    const r = await runRecolector();
    console.log("agenda-recolector:", JSON.stringify(r));
    return { statusCode: 200, body: JSON.stringify(r) };
  } catch (err) {
    console.error("agenda-recolector error:", err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
```

- [ ] **Step 4: `netlify/functions/agenda.js`**

```js
// HTTP de "Agenda ahora": GET lee la agenda, POST {action:"run"} fuerza una corrida
// (las funciones programadas no se pueden llamar por URL en producción).
const { runRecolector, obtenerAgenda } = require("../lib/agenda-run");

const CORS_ORIGIN = process.env.URL || "https://dru-plataforma.netlify.app";
const HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": CORS_ORIGIN,
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};
const reply = (body) => ({ statusCode: 200, headers: HEADERS, body: JSON.stringify(body) });

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: HEADERS, body: "" };
  try {
    if (event.httpMethod === "GET") {
      const horas = (event.queryStringParameters || {}).horas === "24" ? 24 : 2;
      return reply(await obtenerAgenda(horas));
    }
    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      if (body.action === "run") return reply(await runRecolector());
      return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: "Acción no válida" }) };
    }
    return { statusCode: 405, headers: HEADERS, body: "Method not allowed" };
  } catch (err) {
    const faltanTablas = /agenda_(temas|titulares)/.test(err.message) && /does not exist|schema cache|404/.test(err.message);
    return reply({ configured: true, error: err.message, faltanTablas });
  }
};
```

- [ ] **Step 5: Schedule** — agregar en `netlify.toml` debajo del bloque de `rss-alertas`:

```toml
# Agenda ahora: recolecta titulares regionales y los agrupa en temas
[functions."agenda-recolector"]
  schedule = "*/15 * * * *"
```

- [ ] **Step 6: SQL en `SUPABASE_SETUP.md`** — agregar antes de `## Preguntas frecuentes` una sección `## Agenda ahora` con el bloque SQL del spec (sección "Datos") y la instrucción: "Supabase → SQL Editor → New query → pegar → Run".

- [ ] **Step 7: Actualizar spec** — en la sección "Lectura", reemplazar `db.js, GET ?action=agenda&horas=2|24` por `netlify/functions/agenda.js, GET ?horas=2|24` y agregar: "`POST {action:"run"}` fuerza una corrida (las scheduled functions no son invocables por URL en producción)."

- [ ] **Step 8: Chequeos locales**

Run: `npm test && node -e "require('./netlify/functions/agenda.js');require('./netlify/functions/agenda-recolector.js');console.log('carga OK')"`
Expected: tests en verde y `carga OK`.

- [ ] **Step 9: Commit**

```bash
git add netlify/lib/agenda-run.js netlify/functions/agenda.js netlify/functions/agenda-recolector.js netlify/functions/rss-trends.js netlify.toml SUPABASE_SETUP.md docs/superpowers/specs/2026-11-13-agenda-ahora-design.md
git commit -m "Agenda ahora: recolector programado, endpoint y SQL"
```

---

### Task 3: Tablas en Supabase, deploy y verificación del backend

**Files:** ninguno (operación).

- [ ] **Step 1: El usuario corre el SQL** de `SUPABASE_SETUP.md` → "Agenda ahora" en el SQL Editor de Supabase. Esperar confirmación.
- [ ] **Step 2: Push**

```bash
git push origin main
```

- [ ] **Step 3: Esperar el deploy y forzar una corrida**

Run: `curl -s -X POST https://dru-plataforma.netlify.app/.netlify/functions/agenda -H "Content-Type: application/json" -d '{"action":"run"}'`
Expected: JSON con `configured: true`, `fuentes: 18`, `nuevos` > 0, `clasificados` > 0 (máx 60), `errorIA: null`, `ms` < 26000. Si `fallidas` no está vacío, anotar cuáles.

- [ ] **Step 4: Vaciar el backlog inicial** — repetir el POST hasta que `pendientes` < 60 (la primera carga trae ~24 h de titulares).
- [ ] **Step 5: Leer la agenda**

Run: `curl -s "https://dru-plataforma.netlify.app/.netlify/functions/agenda?horas=24" | python3 -c "import json,sys;d=json.load(sys.stdin);[print(t['medios_ventana'],t['caliente'],t['cubierto_dru'],t['categoria'],'|',t['titulo']) for t in d['temas'][:15]]"`
Expected: temas coherentes (titulares del mismo hecho agrupados), categorías válidas, algunos con `cubierto_dru: True`.

- [ ] **Step 6: Revisión de calidad del agrupado** — leer 5 temas con sus titulares; si hay temas partidos o mezclados, ajustar el prompt en `agenda-core.js`, correr `npm test`, commitear (el push va con la Task 4).

---

### Task 4: Pantalla "Agenda ahora"

**Files:**
- Modify: `index.html` (menú ~línea 113, página antes de `<!-- ═══ BORRADORES ═══ -->`, `PAGE_TITLE` y `showPage` ~línea 1547, `syncFromDB` ~línea 2267, JS nuevo antes de `// ══ TENDENCIAS REGIONALES`)
- Modify: `DOCUMENTACION.md`

**Interfaces:**
- Consumes: `GET/POST /.netlify/functions/agenda` (Task 2); helpers existentes `esc`, `showToast`, `showPage`, `loadDrafts`, `saveDrafts`, `dbPost`, `searchAngle`, `currentUser`.
- Produces: `renderAgenda()`, `updateAgendaBadge()`.

- [ ] **Step 1: Ítem de menú** — insertar antes del ítem de Alertas y renumerar Alertas→11, Borradores→12, Sugerencias→13:

```html
      <div class="sb-item" onclick="showPage('agenda',this)">
        <span class="sb-item-num">10</span><span class="sb-item-name">Agenda ahora</span>
        <span class="sb-item-badge is-count" id="agenda-cnt">0</span><span class="sb-item-arrow">→</span>
      </div>
```

- [ ] **Step 2: Página** — insertar antes de `<!-- ═══ BORRADORES ═══ -->`:

```html
    <!-- ═══ AGENDA AHORA ═══ -->
    <div class="page" id="page-agenda">
      <div class="hero">
        <div class="hero-row">
          <div class="hero-num">№ 10 · Agenda en tiempo real</div>
          <div class="hero-rule"></div>
          <div class="hero-num">17 medios + DRU · cada 15 min</div>
        </div>
        <h1 class="hero-title">Agenda <span class="accent">ahora</span></h1>
        <div class="hero-sub">Qué temas están levantando los medios de Entre Ríos en este momento, cuántos los cubren y si DRU ya los publicó. 🔥 = 3 o más medios en las últimas 2 horas.</div>
        <div class="hero-gradient"></div>
      </div>

      <div class="section" id="agenda-not-configured" style="display:none">
        <div class="step">
          <div class="step-head"><span class="step-num step-num--peach">!</span><div class="step-title">Falta configurar la base de datos</div></div>
          <div class="step-help" style="line-height:1.8" id="agenda-not-configured-msg"></div>
        </div>
      </div>

      <div class="section" id="agenda-dashboard" style="display:none">
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px">
          <div class="chips" style="margin:0">
            <button class="chip active" data-h="2" onclick="setAgendaVentana(2)">Últimas 2 h</button>
            <button class="chip" data-h="24" onclick="setAgendaVentana(24)">Últimas 24 h</button>
          </div>
          <button class="btn btn--peach btn--sm" id="agenda-run-btn" onclick="actualizarAgendaAhora()" style="margin-left:auto">Actualizar ahora <span class="font-mono" style="font-size:11px">→</span></button>
        </div>
        <div class="chips" id="agenda-cats"></div>
        <div class="font-mono" id="agenda-status" style="font-size:11px;color:var(--ink-4);margin:8px 0 14px"></div>
        <div id="agenda-list"><div class="empty">Cargando agenda…</div></div>
      </div>
    </div>
```

- [ ] **Step 3: Navegación** — en `PAGE_TITLE` agregar `agenda:"Agenda ahora",`; en `showPage` agregar `if(id==="agenda")renderAgenda();` debajo de la línea de `alertas`.

- [ ] **Step 4: Badge al iniciar** — en `syncFromDB`, después de `updateAlertasBadge();` agregar `updateAgendaBadge();`.

- [ ] **Step 5: JS** — insertar antes de `// ══ TENDENCIAS REGIONALES (SEO del día) ══`:

```js
// ══ AGENDA AHORA ══
// Temas que agrupa el recolector (netlify/lib/agenda-run.js) cada 15 min.
const AGENDA_CATS=["política","economía","policiales","judiciales","salud","educación","clima y servicios","sociedad","deportes","cultura","rutina"];
let agendaTemas=[],agendaHoras=2,agendaTimer=null;
const agendaCatsOff=new Set(["rutina"]);
async function fetchAgenda(horas){
  try{const res=await fetch("/.netlify/functions/agenda?horas="+horas);return await res.json();}
  catch(e){return{configured:true,error:"Error de conexión"};}
}
function agendaHace(iso){
  const min=Math.max(0,Math.round((Date.now()-new Date(iso).getTime())/60000));
  if(min<60)return"hace "+min+" min";
  const h=Math.floor(min/60);return"hace "+h+" h"+(min%60?" "+(min%60)+" min":"");
}
function agendaSinCubrir(){return agendaTemas.filter(t=>t.caliente&&!t.cubierto_dru).length;}
async function updateAgendaBadge(){
  const data=await fetchAgenda(2);
  if(!data.temas)return;
  document.getElementById("agenda-cnt").textContent=data.temas.filter(t=>t.caliente&&!t.cubierto_dru).length;
}
async function renderAgenda(){
  const dash=document.getElementById("agenda-dashboard"),notCfg=document.getElementById("agenda-not-configured");
  const status=document.getElementById("agenda-status");
  const data=await fetchAgenda(agendaHoras);
  if(data.configured===false||data.faltanTablas){
    notCfg.style.display="block";dash.style.display="none";
    document.getElementById("agenda-not-configured-msg").innerHTML=data.faltanTablas
      ?'Faltan las tablas <code>agenda_temas</code> y <code>agenda_titulares</code>. Corré el SQL de la sección «Agenda ahora» de <code>SUPABASE_SETUP.md</code> en el SQL Editor de Supabase.'
      :'Agenda ahora necesita la base de datos del equipo (Supabase). Seguí la guía de <code>SUPABASE_SETUP.md</code>.';
    return;
  }
  notCfg.style.display="none";dash.style.display="block";
  if(!agendaTimer)agendaTimer=setInterval(()=>{if(document.getElementById("page-agenda").classList.contains("active"))renderAgenda();},120000);
  if(data.error){status.textContent="⚠ "+data.error;return;}
  agendaTemas=data.temas||[];
  status.textContent=`Actualizado ${new Date().toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"})} · ${agendaTemas.length} temas · ${agendaSinCubrir()} caliente${agendaSinCubrir()!==1?"s":""} sin cubrir`;
  document.getElementById("agenda-cnt").textContent=agendaSinCubrir();
  renderAgendaCats();renderAgendaList();
}
function setAgendaVentana(h){
  agendaHoras=h;
  document.querySelectorAll("#agenda-dashboard [data-h]").forEach(b=>b.classList.toggle("active",Number(b.dataset.h)===h));
  renderAgenda();
}
function toggleAgendaCat(i){
  const c=AGENDA_CATS[i];
  agendaCatsOff.has(c)?agendaCatsOff.delete(c):agendaCatsOff.add(c);
  renderAgendaCats();renderAgendaList();
}
function renderAgendaCats(){
  const cnt={};agendaTemas.forEach(t=>{cnt[t.categoria]=(cnt[t.categoria]||0)+1;});
  document.getElementById("agenda-cats").innerHTML=AGENDA_CATS.map((c,i)=>cnt[c]
    ?`<button class="chip ${agendaCatsOff.has(c)?"":"active"}" onclick="toggleAgendaCat(${i})">${esc(c)} · ${cnt[c]}</button>`:"").join("");
}
function renderAgendaList(){
  const list=document.getElementById("agenda-list");
  const temas=agendaTemas.filter(t=>!agendaCatsOff.has(t.categoria));
  if(!temas.length){
    list.innerHTML=`<div class="empty">${agendaTemas.length?"No hay temas en las categorías elegidas.":"Todavía no hay temas en esta ventana. El recolector corre cada 15 minutos; podés forzarlo con «Actualizar ahora»."}</div>`;
    return;
  }
  list.innerHTML=temas.map(t=>{
    const alerta=t.caliente&&!t.cubierto_dru;
    return`<div class="step" style="margin-bottom:10px;${alerta?"border-left:3px solid var(--peach-deep)":""}">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px">
        ${t.caliente?'<span class="tag tag--peach">🔥 Caliente</span>':""}
        <span class="tag tag--sky">${esc(t.categoria)}</span>
        ${t.cubierto_dru?'<span class="tag tag--ghost">DRU ✓ cubierto</span>':'<span class="tag tag--ghost" style="color:var(--peach-deep)">Sin cubrir</span>'}
        <span class="font-mono" style="font-size:11px;color:var(--ink-4)">${t.medios_ventana} medio${t.medios_ventana!==1?"s":""} en ${agendaHoras} h · ${t.medios_total} en total · primer titular ${agendaHace(t.primer_visto)} (${esc(t.primera_fuente)})</span>
      </div>
      <div style="font-weight:600;font-size:15px;line-height:1.4;margin-bottom:8px">${esc(t.titulo)}</div>
      <details style="margin-bottom:8px">
        <summary class="font-mono" style="font-size:12px;cursor:pointer">${t.titulares.length} titular${t.titulares.length!==1?"es":""}</summary>
        <ul style="margin:8px 0 0 18px;font-size:13px;line-height:1.6">${t.titulares.map(h=>`<li><a href="${encodeURI(h.link||"#")}" target="_blank" rel="noreferrer">${esc(h.titulo)}</a> <span class="font-mono" style="font-size:11px;color:var(--ink-4)">${esc(h.fuente)} · ${agendaHace(h.publicado)}</span></li>`).join("")}</ul>
      </details>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn--ghost btn--sm" onclick="agendaAngulo(${t.id})">Buscar ángulo DRU</button>
        <button class="btn btn--ghost btn--sm" onclick="agendaBorrador(${t.id})">Guardar en borradores</button>
      </div>
    </div>`;
  }).join("");
}
function agendaAngulo(id){
  const t=agendaTemas.find(x=>x.id===id);if(!t)return;
  showPage("seo",document.querySelectorAll(".sb-item")[3]);
  setTimeout(()=>{document.getElementById("seo-topic").value=t.titulo;searchAngle();},150);
}
function agendaBorrador(id){
  const t=agendaTemas.find(x=>x.id===id);if(!t)return;
  const content=`TEMA: ${t.titulo}\nCategoría: ${t.categoria} · ${t.medios_total} medios · ${t.cubierto_dru?"DRU ya lo cubrió":"DRU todavía no lo cubrió"}\n\nTITULARES:\n`+t.titulares.map(h=>`- ${h.titulo} (${h.fuente}) ${h.link}`).join("\n");
  const drafts=loadDrafts();
  const nuevo={id:Date.now(),section:"agenda",label:"Agenda",title:t.titulo.substring(0,80),format:"tema",content,date:new Date().toISOString()};
  drafts.unshift(nuevo);saveDrafts(drafts);
  dbPost("insert","borradores",{row:{client_id:nuevo.id,seccion:"agenda",etiqueta:"Agenda",titulo:nuevo.title,formato:"tema",contenido:content,autor:currentUser?.name||""}});
  showToast("✓ Tema guardado en borradores");
}
async function actualizarAgendaAhora(){
  const btn=document.getElementById("agenda-run-btn"),status=document.getElementById("agenda-status");
  btn.disabled=true;btn.innerHTML=`Leyendo 18 fuentes<span class="dots"><span></span><span></span><span></span></span>`;
  try{
    const res=await fetch("/.netlify/functions/agenda",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"run"})});
    const r=await res.json();
    if(r.error)status.textContent="⚠ "+r.error;
    else{
      showToast(`✓ ${r.nuevos} titulares nuevos · ${r.clasificados} clasificados`);
      await renderAgenda();
      if(r.fallidas&&r.fallidas.length)status.textContent+=` · sin respuesta: ${r.fallidas.length} fuente${r.fallidas.length>1?"s":""}`;
      if(r.errorIA)status.textContent+=" · ⚠ la IA no pudo clasificar (se reintenta sola)";
    }
  }catch(e){status.textContent="⚠ Error de conexión.";}
  btn.disabled=false;btn.innerHTML=`Actualizar ahora <span class="font-mono" style="font-size:11px">→</span>`;
}
```

- [ ] **Step 6: Documentación** — en `DOCUMENTACION.md`, tabla de secciones: insertar fila `| 10 | Agenda ahora | Temas en agenda de 17 medios + DRU cada 15 min, velocidad de cobertura y si DRU lo cubrió | Haiku (agrupado) |`, renumerar Alertas 11, Borradores 12, Sugerencias 13; en el diagrama de functions agregar `agenda.js` y `agenda-recolector.js`.

- [ ] **Step 7: Commit y push**

```bash
git add index.html DOCUMENTACION.md
git commit -m "Agenda ahora: pantalla, filtros, badge y acciones"
git push origin main
```

- [ ] **Step 8: Verificación en el navegador** (sitio en vivo, con sesión del usuario): abrir "Agenda ahora"; confirmar sin errores de consola; que aparezcan temas; que alternar 2 h/24 h cambie la lista; que el chip "rutina" arranque apagado y los chips filtren; que "Buscar ángulo DRU" lleve a SEO del día con el tema cargado; que "Guardar en borradores" sume uno; que el badge coincida con los temas 🔥 sin cubrir. Captura como evidencia.
