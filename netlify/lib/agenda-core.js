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

// Tool use forzado: la API garantiza JSON válido con este schema.
// La salida es por GRUPOS (tema → lista de titulares): agrupar así es más natural
// para el modelo y evita los corrimientos de índice de "titular i → tema".
const CLASSIFY_TOOL = {
  name: "agrupar_titulares",
  description: "Registra cómo se agrupan los titulares nuevos en temas de agenda.",
  input_schema: {
    type: "object",
    properties: {
      grupos: {
        type: "array",
        items: {
          type: "object",
          properties: {
            tema_id: { type: ["integer", "null"], description: "Número del tema activo (#123 → 123) o null si es un tema nuevo." },
            titulo: { type: "string", description: "Para temas nuevos: título neutro y descriptivo del hecho, máx 80 caracteres. Para temas activos: repetí el título." },
            categoria: { type: "string", enum: CATEGORIAS },
            titulares: { type: "array", items: { type: "string", pattern: "^T\\d+$" }, description: "Ids de los titulares nuevos de este tema (T0, T5…)." }
          },
          required: ["tema_id", "titulo", "categoria", "titulares"]
        }
      }
    },
    required: ["grupos"]
  }
};

function buildClassifyPrompt(titulares, temas) {
  const activos = temas.length ? temas.map(x => `#${x.id} | ${x.titulo} (${x.categoria})`).join("\n") : "(ninguno)";
  const nuevos = titulares.map((x, i) => `T${i} | ${x.titulo} — ${x.fuente}`).join("\n");
  return `Sos editor de agenda de un diario de Entre Ríos. Agrupá los titulares nuevos de medios regionales en TEMAS: un tema es un mismo hecho o asunto concreto de agenda, no una categoría general. Dos titulares van al mismo tema solo si hablan del mismo hecho; ante la duda, temas separados.

TEMAS ACTIVOS (últimas 24 h):
${activos}

TITULARES NUEVOS:
${nuevos}

Reglas:
- Cada titular nuevo (T0, T1…) va en exactamente un grupo. Leé el texto de cada titular antes de ubicarlo; no lo ubiques por cercanía en la lista.
- Si el hecho ya es un tema activo, usá su número como tema_id (#123 → 123) y copiá su título EXACTO en "titulo". No crees un tema nuevo que repita uno activo.
- Si no, creá un grupo con tema_id null. Varios titulares nuevos del mismo hecho van en el mismo grupo nuevo.
- Título de tema nuevo: neutro y descriptivo, máx 80 caracteres, sin datos que no estén en los titulares.
- Categoría "rutina": información de servicio repetitiva (pronóstico diario, loterías, cronogramas de pago, farmacias de turno).

Respondé usando la herramienta agrupar_titulares.`;
}

// Coincidencia de palabras (>2 letras, sin tildes) sobre el título más corto: 0..1.
function palabras(s) {
  return new Set((s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ]+/g, " ").split(" ").filter(w => w.length > 2));
}
function similitud(a, b) {
  const A = palabras(a), B = palabras(b);
  if (!A.size || !B.size) return 0;
  let comunes = 0;
  for (const w of A) if (B.has(w)) comunes++;
  return comunes / Math.min(A.size, B.size);
}

// El modelo a veces pone el número de tema equivocado, pero el título que repite
// refleja su intención. Se verifica el id contra el título; si no coincide, se busca
// el tema por título; si tampoco aparece, es un tema nuevo.
function resolverTema(g, temas) {
  const elegido = temas.find(t => t.id === Number(g.tema_id));
  if (elegido && similitud(g.titulo, elegido.titulo) >= 0.6) return elegido.id;
  let mejor = null, sim = 0;
  for (const t of temas) {
    const s = similitud(g.titulo, t.titulo);
    if (s > sim) { sim = s; mejor = t; }
  }
  return mejor && sim >= 0.8 ? mejor.id : null;
}

function parseClassification(input, n, temas) {
  let grupos = input && input.grupos;
  if (typeof grupos === "string") { try { grupos = JSON.parse(grupos); } catch { grupos = null; } }
  if (!Array.isArray(grupos)) throw new Error("Respuesta de clasificación sin grupos");
  const usados = new Set();
  const asignaciones = [], nuevos = [];
  for (const g of grupos) {
    const ts = (g && Array.isArray(g.titulares) ? g.titulares : [])
      .map(x => /^T(\d+)$/.exec(String(x)))
      .map(m => (m ? Number(m[1]) : -1))
      .filter(t => {
        if (t < 0 || t >= n || usados.has(t)) return false;
        usados.add(t); // también descarta repetidos dentro del mismo grupo
        return true;
      });
    if (!ts.length) continue;
    const temaId = resolverTema(g, temas);
    if (temaId !== null) {
      ts.forEach(t => asignaciones.push({ t, temaId }));
    } else {
      const ref = "N" + (nuevos.length + 1);
      const categoria = CATEGORIAS.includes(g.categoria) ? g.categoria : "sociedad";
      nuevos.push({ ref, titulo: String(g.titulo || "Tema sin título").slice(0, 120), categoria });
      ts.forEach(t => asignaciones.push({ t, ref }));
    }
  }
  return { asignaciones, nuevos };
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

module.exports = { CATEGORIAS, UMBRAL_MEDIOS, VENTANA_CALIENTE_H, CLASSIFY_TOOL, parseSitemapNews, selectNew, buildClassifyPrompt, parseClassification, computeAgenda, temasParaAviso };
