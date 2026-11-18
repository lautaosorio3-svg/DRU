const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../carnaval-lut");

// LUT identidad de 2×2×2 en formato .cube (rojo varía primero, después verde, después azul)
const IDENTIDAD = `# comentario
TITLE "Identidad"
LUT_3D_SIZE 2
DOMAIN_MIN 0 0 0
DOMAIN_MAX 1 1 1
0 0 0
1 0 0
0 1 0
1 1 0
0 0 1
1 0 1
0 1 1
1 1 1
`;

test("leerCube: tamaño, título y valores en orden", () => {
  const lut = L.leerCube(IDENTIDAD);
  assert.equal(lut.tamano, 2);
  assert.equal(lut.titulo, "Identidad");
  assert.equal(lut.datos.length, 2 * 2 * 2 * 3);
  assert.deepEqual(Array.from(lut.datos.slice(3, 6)), [1, 0, 0]);   // segunda entrada: rojo
  assert.deepEqual(Array.from(lut.datos.slice(21, 24)), [1, 1, 1]); // última: blanco
});

test("leerCube acepta tabuladores, líneas en blanco y finales \\r\\n", () => {
  const txt = IDENTIDAD.replace("TITLE \"Identidad\"", "TITLE \t\"Con tab\"").replace(/\n/g, "\r\n") + "\r\n\r\n";
  assert.equal(L.leerCube(txt).titulo, "Con tab");
});

test("leerCube rechaza archivos que no son una LUT 3D válida", () => {
  assert.throws(() => L.leerCube("0 0 0\n1 1 1\n"), /LUT_3D_SIZE/);
  assert.throws(() => L.leerCube("LUT_3D_SIZE 2\n0 0 0\n"), /8 valores/);
  assert.throws(() => L.leerCube("LUT_1D_SIZE 4\n0 0 0\n"), /3D/);
  assert.throws(() => L.leerCube(IDENTIDAD.replace("DOMAIN_MAX 1 1 1", "DOMAIN_MAX 2 2 2")), /0 a 1/);
});

test("comprimir y descomprimir conservan los valores en 16 bits", () => {
  const i = IDENTIDAD.lastIndexOf("1 1 1\n");          // el último valor, no la línea DOMAIN_MAX
  const lut = L.leerCube(IDENTIDAD.slice(0, i) + "0.123456 0.5 0.999\n");
  const texto = L.comprimir(lut);
  assert.equal(typeof texto, "string");
  const vuelta = L.descomprimir(texto, lut.tamano);
  assert.equal(vuelta.length, lut.datos.length);
  for (let i = 0; i < vuelta.length; i++) assert.ok(Math.abs(vuelta[i] - lut.datos[i]) <= 1 / 65535, i);
});
