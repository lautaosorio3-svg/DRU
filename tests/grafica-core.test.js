const test = require("node:test");
const assert = require("node:assert/strict");
const G = require("../grafica-core");

// Valores esperados medidos cuadro a cuadro en Zocalo_Entrevistas_DRU_ejemplo.mov
// (ProRes 4444, 1080×1920, 30 fps). alfa en 0-255, tolerancia ±3.
const cerca = (real, esperado, tol, msg) => assert.ok(Math.abs(real - esperado) <= tol, `${msg}: ${real} vs ${esperado}`);
const a255 = (x) => Math.round(x * 255);

test("zócalo: nada visible en t=0 y desde 3,3 s", () => {
  for (const t of [0, 3.3, 3.5, 4.49]) {
    const e = G.zocaloEstado(t);
    assert.equal(e.nombre.alpha, 0, "nombre t=" + t);
    assert.equal(e.empresa.alpha, 0, "empresa t=" + t);
  }
});

test("zócalo: entrada del nombre (ease-out cúbico desde −140)", () => {
  const f1 = G.zocaloEstado(1 / 30).nombre;           // cuadro 1: borde derecho 316 → dx −112, alfa 47
  cerca(428 + f1.dx, 316, 3, "borde f1");
  cerca(a255(f1.alpha), 47, 3, "alfa f1");
  const f6 = G.zocaloEstado(6 / 30).nombre;           // cuadro 6: borde 398, alfa 200
  cerca(428 + f6.dx, 398, 3, "borde f6");
  cerca(a255(f6.alpha), 200, 3, "alfa f6");
  assert.deepEqual(G.zocaloEstado(0.5).nombre, { dx: 0, alpha: 1 });
});

test("zócalo: la empresa entra 0,3 s después", () => {
  assert.equal(G.zocaloEstado(9 / 30).empresa.alpha, 0); // cuadro 9: todavía no
  const f10 = G.zocaloEstado(10 / 30).empresa;           // cuadro 10: alfa 47
  cerca(a255(f10.alpha), 47, 3, "alfa f10");
  const f15 = G.zocaloEstado(15 / 30).empresa;           // cuadro 15: borde 391, alfa 200
  cerca(422 + f15.dx, 391, 3, "borde f15");
  cerca(a255(f15.alpha), 200, 3, "alfa f15");
});

test("zócalo: quieto entre 0,8 y 2,8 s", () => {
  for (const t of [0.8, 1.5, 2.8]) assert.deepEqual(G.zocaloEstado(t), { nombre: { dx: 0, alpha: 1 }, empresa: { dx: 0, alpha: 1 } });
});

test("zócalo: salida ease-in, empresa a los 2,8 s y nombre a los 2,9 s", () => {
  const e = G.zocaloEstado(3.0);                        // cuadro 90
  cerca(422 + e.empresa.dx, 404, 3, "borde empresa f90");
  cerca(a255(e.empresa.alpha), 224, 3, "alfa empresa f90");
  cerca(428 + e.nombre.dx, 426, 3, "borde nombre f90");
  cerca(a255(e.nombre.alpha), 252, 3, "alfa nombre f90");
  assert.equal(G.zocaloEstado(3.2).empresa.alpha, 0);   // cuadro 96: empresa ya no está
  assert.ok(G.zocaloEstado(3.2).nombre.alpha > 0);
});

test("zócalo: cajas siguen al texto con margen 18", () => {
  const L = G.zocaloLayout({ nombre: 333, empresa: 327 });
  assert.deepEqual(
    { x: L.nombre.x, y: L.nombre.y, w: L.nombre.w, h: L.nombre.h },
    { x: 60, y: 1280, w: 369, h: 66 });
  assert.deepEqual(
    { x: L.empresa.x, y: L.empresa.y, w: L.empresa.w, h: L.empresa.h },
    { x: 60, y: 1356, w: 363, h: 48 });
  assert.equal(L.nombre.textX, 78);
  assert.equal(L.nombre.baseline, 1335);   // base de las mayúsculas en y 1334 en la referencia
  assert.equal(L.empresa.baseline, 1388);  // texto de la referencia en y 1366-1393
  assert.ok(G.zocaloLayout({ nombre: 900, empresa: 300 }, { nombre: 40 }).nombre.baseline < 1335, "fuente chica → baseline sube");
});

test("tamanoQueEntra achica la fuente solo si el texto no entra", () => {
  assert.equal(G.tamanoQueEntra(333, 50, 960), 50);
  assert.equal(G.tamanoQueEntra(1200, 50, 960), 40);
});

test("nombreArchivo: formato, slug sin tildes y fecha AAAAMMDD", () => {
  assert.equal(G.nombreArchivo("zocalo", "Morena Martínez", new Date(2026, 10, 17), "png"), "dru-zocalo-morena-martinez-20261117.png");
  assert.equal(G.nombreArchivo("posteo", "¡Año récord en Salto Grande! *Ñandú*", new Date(2026, 0, 5), "png"), "dru-posteo-ano-record-en-salto-grande-nandu-20260105.png");
  assert.equal(G.nombreArchivo("zocalo", "", new Date(2026, 10, 17), "webm"), "dru-zocalo-placa-20261117.webm");
});
