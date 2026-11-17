const test = require("node:test");
const assert = require("node:assert/strict");
const M = require("../mov-animation");

// Decodificador QuickTime Animation 32 bits: réplica de qtrle_decode_32bpp de ffmpeg.
// Devuelve RGBA. `previo` es el cuadro anterior (el códec puede saltear píxeles).
function decodificar(buf, w, h, previo) {
  const out = previo ? Uint8Array.from(previo) : new Uint8Array(w * h * 4);
  let p = 0;
  const u8 = () => buf[p++];
  const be16 = () => { const v = (buf[p] << 8) | buf[p + 1]; p += 2; return v; };
  const be32 = () => { const v = ((buf[p] << 24) >>> 0) + (buf[p + 1] << 16) + (buf[p + 2] << 8) + buf[p + 3]; p += 4; return v; };
  const tam = be32() & 0x3fffffff;
  assert.equal(tam, buf.length, "el tamaño declarado coincide con el del cuadro");
  const header = be16();
  let inicio = 0, lineas = h;
  if (header & 0x0008) { inicio = be16(); p += 2; lineas = be16(); p += 2; }
  for (let y = inicio; y < inicio + lineas; y++) {
    let x = u8() - 1;
    for (;;) {
      const c = (u8() << 24) >> 24; // int8
      if (c === -1) break;
      if (c === 0) { x += u8() - 1; continue; }
      const poner = (a, r, g, b) => { const i = (y * w + x) * 4; out[i] = r; out[i + 1] = g; out[i + 2] = b; out[i + 3] = a; x++; };
      if (c < 0) { const a = u8(), r = u8(), g = u8(), b = u8(); for (let k = 0; k < -c; k++) poner(a, r, g, b); }
      else for (let k = 0; k < c; k++) poner(u8(), u8(), u8(), u8());
    }
    assert.ok(x <= w, "la línea no se pasa del ancho");
  }
  return out;
}

// Cuadro de prueba: fondo transparente, una caja naranja, texto "ruidoso" y semitransparencia.
function cuadro(w, h, semilla) {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (y >= 2 && y < 6 && x >= 3 && x < 3 + 150) { px[i] = 247; px[i + 1] = 148; px[i + 2] = 29; px[i + 3] = 255; }
    if (y === 4 && x % 3 === semilla % 3) { px[i] = 18; px[i + 1] = 18; px[i + 2] = 18; px[i + 3] = 255; }
    if (y === 7 && x < 300) { px[i] = 10; px[i + 1] = 20; px[i + 2] = 30; px[i + 3] = (x * 7 + semilla) % 256; }
  }
  return px;
}

test("codificarCuadro + decodificar devuelve exactamente los mismos píxeles (sin pérdida)", () => {
  const w = 300, h = 9;
  for (const s of [0, 1, 2]) {
    const rgba = cuadro(w, h, s);
    const enc = M.codificarCuadro(rgba, w, h);
    assert.deepEqual(Array.from(decodificar(enc, w, h)), Array.from(rgba));
  }
});

test("un cuadro totalmente transparente se comprime mucho", () => {
  const w = 1080, h = 1920;
  const enc = M.codificarCuadro(new Uint8ClampedArray(w * h * 4), w, h);
  assert.ok(enc.length < 100_000, "bytes: " + enc.length);
  const dec = decodificar(enc, w, h, new Uint8Array(w * h * 4).fill(99)); // aunque el anterior tuviera basura
  assert.ok(dec.every((v) => v === 0), "todo transparente");
});

test("corridas y literales respetan los límites del códec (128 y 127)", () => {
  const w = 1000, h = 1;
  const rgba = new Uint8ClampedArray(w * 4);
  for (let x = 0; x < w; x++) { const i = x * 4; rgba[i] = x < 500 ? 5 : x % 256; rgba[i + 3] = 255; }
  const enc = M.codificarCuadro(rgba, w, h);
  assert.deepEqual(Array.from(decodificar(enc, w, h)), Array.from(rgba));
});

// Lector mínimo de átomos QuickTime para verificar el contenedor.
function atomos(buf, ini = 0, fin = buf.length) {
  const res = [];
  for (let p = ini; p < fin;) {
    const tam = ((buf[p] << 24) >>> 0) + (buf[p + 1] << 16) + (buf[p + 2] << 8) + buf[p + 3];
    res.push({ tipo: String.fromCharCode(...buf.slice(p + 4, p + 8)), ini: p, tam });
    p += tam;
  }
  return res;
}
const be32 = (b, p) => ((b[p] << 24) >>> 0) + (b[p + 1] << 16) + (b[p + 2] << 8) + b[p + 3];
function buscar(buf, ruta) {
  let ini = 0, fin = buf.length, a = null;
  for (const t of ruta) {
    a = atomos(buf, ini, fin).find((x) => x.tipo === t);
    assert.ok(a, "falta el átomo " + ruta.join("/"));
    const salto = t === "stsd" ? 16 : 8;   // stsd tiene versión + cantidad antes de las entradas
    ini = a.ini + salto; fin = a.ini + a.tam;
  }
  return a;
}

test("crearMov arma un QuickTime válido: ftyp, mdat, moov con códec 'rle ' de 32 bits y 1 muestra por cuadro", () => {
  const w = 300, h = 9, fps = 30;
  const cuadros = [0, 1, 2, 3].map((s) => M.codificarCuadro(cuadro(w, h, s), w, h));
  const mov = M.unirPartes(M.crearMov({ ancho: w, alto: h, fps, cuadros }));
  assert.deepEqual(atomos(mov).map((a) => a.tipo), ["ftyp", "mdat", "moov"]);
  assert.equal(String.fromCharCode(...mov.slice(8, 12)), "qt  ");

  const stsd = buscar(mov, ["moov", "trak", "mdia", "minf", "stbl", "stsd"]);
  const entrada = stsd.ini + 16;
  assert.equal(String.fromCharCode(...mov.slice(entrada + 4, entrada + 8)), "rle ");
  assert.equal((mov[entrada + 32] << 8) | mov[entrada + 33], w);
  assert.equal((mov[entrada + 34] << 8) | mov[entrada + 35], h);
  assert.equal((mov[entrada + 82] << 8) | mov[entrada + 83], 32, "profundidad 32 = con canal alfa");

  const mdhd = buscar(mov, ["moov", "trak", "mdia", "mdhd"]);
  assert.equal(be32(mov, mdhd.ini + 20), fps, "escala de tiempo = fps");
  assert.equal(be32(mov, mdhd.ini + 24), cuadros.length, "duración en cuadros");

  const stsz = buscar(mov, ["moov", "trak", "mdia", "minf", "stbl", "stsz"]);
  const stco = buscar(mov, ["moov", "trak", "mdia", "minf", "stbl", "stco"]);
  assert.equal(be32(mov, stsz.ini + 16), cuadros.length);
  cuadros.forEach((c, i) => {
    const tam = be32(mov, stsz.ini + 20 + i * 4);
    const off = be32(mov, stco.ini + 16 + i * 4);
    assert.equal(tam, c.length);
    assert.deepEqual(Array.from(mov.slice(off, off + tam)), Array.from(c), "la muestra " + i + " está donde dice stco");
  });
});
