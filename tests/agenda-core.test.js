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

test("buildClassifyPrompt usa ids T# para titulares y #id para temas", () => {
  const p = core.buildClassifyPrompt([{ titulo: "Paro docente", fuente: "UNO" }], [{ id: 7, titulo: "Temporal", categoria: "clima y servicios" }]);
  assert.match(p, /#7 \| Temporal \(clima y servicios\)/);
  assert.match(p, /T0 \| Paro docente — UNO/);
  assert.match(p, /rutina/);
});

test("CLASSIFY_TOOL restringe categorías e ids de titulares", () => {
  const g = core.CLASSIFY_TOOL.input_schema.properties.grupos.items.properties;
  assert.deepEqual(g.categoria.enum, core.CATEGORIAS);
  assert.equal(g.titulares.items.pattern, "^T\\d+$");
});

test("parseClassification convierte grupos en asignaciones y temas nuevos", () => {
  const input = { grupos: [
    { tema_id: 7, titulo: "Temporal", categoria: "clima y servicios", titulares: ["T0", "T4"] },
    { tema_id: null, titulo: "Paro docente", categoria: "educación", titulares: ["T1", "T0", "T9"] },
    { tema_id: 99, titulo: "Id inexistente → nuevo", categoria: "inventada", titulares: ["T2"] },
    { tema_id: null, titulo: "Vacío", categoria: "cultura", titulares: ["T8"] }
  ] };
  const r = core.parseClassification(input, 5, [7]);
  assert.deepEqual(r.asignaciones, [{ t: 0, temaId: 7 }, { t: 4, temaId: 7 }, { t: 1, ref: "N1" }, { t: 2, ref: "N2" }]);
  assert.deepEqual(r.nuevos, [
    { ref: "N1", titulo: "Paro docente", categoria: "educación" },
    { ref: "N2", titulo: "Id inexistente → nuevo", categoria: "sociedad" }
  ]);
});

test("parseClassification tira error si no hay grupos", () => {
  assert.throws(() => core.parseClassification({}, 1, []), /grupos/);
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
