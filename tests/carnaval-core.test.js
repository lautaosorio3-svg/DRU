const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../carnaval-core");

test("las cuatro comparsas con los colores del manual", () => {
  assert.deepEqual(C.COMPARSAS.map((c) => c.id), ["bella-samba", "rafaga", "emperatriz", "imperio"]);
  assert.deepEqual(C.comparsa("bella-samba").bandas, ["#8A1FD6", "#F2B705", "#3E4FE0"]);
  assert.deepEqual(C.comparsa("rafaga").bandas, ["#E3262D", "#1E7A3C", "#E3262D"]);
  assert.deepEqual(C.comparsa("emperatriz").bandas, ["#0A9A2A", "#FFF6E9", "#0A9A2A"]);
  assert.deepEqual(C.comparsa("imperio").bandas, ["#1B3A9E", "#C8102E", "#F2C200"]);
  assert.equal(C.comparsa("no-existe"), null);
});

test("medidas de la plantilla para dos nombres", () => {
  const m = C.medidas(2);
  assert.equal(m.bloqueY, 1130);
  assert.equal(m.franjasH, 232);
  assert.deepEqual(m.liston, { x: 70, y: 1140, w: 940, h: 162 });
  assert.deepEqual(m.lineas, [1212, 1274]);
  assert.equal(m.puestosBaseline, 1361);
  assert.equal(m.anchoTexto, 800);
  assert.deepEqual(m.auspiciante, { x: 390, y: 1400, w: 300, h: 90 });
  assert.deepEqual(m.carnaval, { x: 368, y: 1510, w: 344 });
  assert.deepEqual(m.lockup, { x: 64, y: 305, w: 300 });
});

test("medidas de la plantilla para un nombre", () => {
  const m = C.medidas(1);
  assert.equal(m.franjasH, 170);
  assert.deepEqual(m.liston, { x: 70, y: 1140, w: 940, h: 100 });
  assert.deepEqual(m.lineas, [1212]);
  assert.equal(m.puestosBaseline, 1299);
});

test("líneas del listón: mayúsculas, segunda con 'Y', espacios limpios", () => {
  assert.deepEqual(C.lineasListon(" Estela  Orcellet ", "Emilio Molina"), ["ESTELA ORCELLET", "Y EMILIO MOLINA"]);
  assert.deepEqual(C.lineasListon("María José Ñúñez", ""), ["MARÍA JOSÉ ÑÚÑEZ"]);
  assert.deepEqual(C.lineasListon("Ana", "   "), ["ANA"]);
});

test("puesto en mayúsculas", () => {
  assert.equal(C.textoPuesto("Porta bandera y maestro de ceremonia"), "PORTA BANDERA Y MAESTRO DE CEREMONIA");
});

test("animación: nada en t=0, todo completo desde 1,25 s, orden de entrada", () => {
  const cero = C.estadoAnim(0);
  for (const k of ["franjas", "liston", "nombres", "puestos", "logos"]) assert.equal(cero[k], 0, k);
  const fin = C.estadoAnim(C.DURACION_ENTRADA);
  for (const k of Object.keys(fin)) assert.equal(fin[k], 1, k);
  assert.deepEqual(C.estadoAnim(20), fin);
  const t = C.estadoAnim(0.5);
  assert.ok(t.franjas > t.liston && t.liston > t.nombres && t.puestos === 0, JSON.stringify(t));
});

test("nombre de archivo", () => {
  assert.equal(C.nombreArchivo("bella-samba", "Estela Orcellet", "Emilio Molina", new Date(2026, 10, 18)),
    "dru-carnaval-bella-samba-estela-orcellet-y-emilio-molina-20261118.mp4");
  assert.equal(C.nombreArchivo("rafaga", "Ana", "", new Date(2027, 1, 5)), "dru-carnaval-rafaga-ana-20270205.mp4");
});
