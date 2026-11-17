// QuickTime Animation ('rle ', 32 bits con alfa) en JavaScript puro, sin librerías.
// Sin pérdida: cada píxel del .mov es exactamente el del canvas, transparencia incluida.
// Lo leen Premiere, After Effects, Final Cut, DaVinci y QuickTime.
// Se usa en el navegador (window.MovAnimation) y en los tests de Node (`npm test`).
(function (root) {
  let tmp = null; // buffer de trabajo reutilizado entre cuadros

  // Escribe un píxel ARGB (el orden del códec) leyendo RGBA del canvas.
  function pon(b, p, rgba, i) {
    b[p] = rgba[i + 3]; b[p + 1] = rgba[i]; b[p + 2] = rgba[i + 1]; b[p + 3] = rgba[i + 2];
    return p + 4;
  }

  // Un cuadro completo (cuadro clave): todas las líneas, corridas de hasta 128 píxeles
  // iguales y tramos literales de hasta 127. rgba = ImageData.data (w × h × 4).
  function codificarCuadro(rgba, w, h) {
    const max = 7 + h * (3 + w * 5);
    if (!tmp || tmp.length < max) tmp = new Uint8Array(max);
    const b = tmp;
    const v = new Uint32Array(rgba.buffer, rgba.byteOffset, w * h); // para comparar píxeles enteros
    let p = 4;                 // los 4 primeros bytes son el tamaño, se escriben al final
    b[p++] = 0; b[p++] = 0;    // encabezado 0: el cuadro trae todas las líneas
    for (let y = 0; y < h; y++) {
      const fila = y * w;
      b[p++] = 1;              // 1 = no saltear píxeles al empezar la línea
      let x = 0;
      while (x < w) {
        const c = v[fila + x];
        let corrida = 1;
        while (x + corrida < w && corrida < 128 && v[fila + x + corrida] === c) corrida++;
        if (corrida >= 2) {
          b[p++] = 256 - corrida;                  // código negativo: repetir el próximo píxel
          p = pon(b, p, rgba, (fila + x) * 4);
          x += corrida;
          continue;
        }
        const ini = x;
        let n = 0;
        do { x++; n++; } while (x < w && n < 127 && !(x + 1 < w && v[fila + x] === v[fila + x + 1]));
        b[p++] = n;                                 // código positivo: n píxeles literales
        for (let k = ini; k < ini + n; k++) p = pon(b, p, rgba, (fila + k) * 4);
      }
      b[p++] = 0xff;           // -1: fin de línea
    }
    b[p++] = 0;                // fin de cuadro
    b[0] = (p >>> 24) & 0xff; b[1] = (p >>> 16) & 0xff; b[2] = (p >>> 8) & 0xff; b[3] = p & 0xff;
    return b.slice(0, p);
  }

  // ── Contenedor QuickTime ──
  const u16 = (v) => [(v >>> 8) & 0xff, v & 0xff];
  const u32 = (v) => [(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff];
  const s4 = (s) => [...s].map((c) => c.charCodeAt(0));
  const ceros = (n) => new Array(n).fill(0);
  const pascal = (s, largo) => { const a = [s.length, ...s4(s)]; return largo ? a.concat(ceros(largo - a.length)) : a; };
  const MATRIZ = [...u32(0x10000), ...u32(0), ...u32(0), ...u32(0), ...u32(0x10000), ...u32(0), ...u32(0), ...u32(0), ...u32(0x40000000)];

  function atomo(tipo, ...partes) {
    const cuerpo = partes.flat(Infinity);
    return [...u32(8 + cuerpo.length), ...s4(tipo), ...cuerpo];
  }

  // cuadros = salidas de codificarCuadro. Devuelve las partes del archivo, en orden
  // (para armar un Blob sin copiar todo de nuevo; en Node se unen con unirPartes).
  function crearMov({ ancho, alto, fps, cuadros }) {
    const n = cuadros.length;
    const ESCALA_PELICULA = 600;
    const durPelicula = Math.round((n / fps) * ESCALA_PELICULA);
    const ftyp = Uint8Array.from(atomo("ftyp", s4("qt  "), u32(0x20050300), s4("qt  ")));
    const datos = cuadros.reduce((s, c) => s + c.length, 0);
    const mdatEnc = Uint8Array.from([...u32(8 + datos), ...s4("mdat")]);
    const offsets = [];
    let off = ftyp.length + 8;
    for (const c of cuadros) { offsets.push(off); off += c.length; }

    const stsd = atomo("stsd", u32(0), u32(1),
      atomo("rle ", ceros(6), u16(1), u16(0), u16(0), s4("appl"), u32(0), u32(0x400),
        u16(ancho), u16(alto), u32(72 << 16), u32(72 << 16), u32(0), u16(1),
        pascal("Animation", 32), u16(32), u16(0xffff)));
    const stbl = atomo("stbl", stsd,
      atomo("stts", u32(0), u32(1), u32(n), u32(1)),
      atomo("stsc", u32(0), u32(1), u32(1), u32(1), u32(1)),
      atomo("stsz", u32(0), u32(0), u32(n), cuadros.map((c) => u32(c.length))),
      atomo("stco", u32(0), u32(n), offsets.map(u32)));
    const minf = atomo("minf",
      atomo("vmhd", u32(1), u16(0x40), u16(0x8000), u16(0x8000), u16(0x8000)),
      atomo("hdlr", u32(0), s4("dhlr"), s4("alis"), u32(0), u32(0), u32(0), pascal("DataHandler")),
      atomo("dinf", atomo("dref", u32(0), u32(1), atomo("alis", u32(1)))),
      stbl);
    const mdia = atomo("mdia",
      atomo("mdhd", u32(0), u32(0), u32(0), u32(fps), u32(n), u16(0), u16(0)),
      atomo("hdlr", u32(0), s4("mhlr"), s4("vide"), u32(0), u32(0), u32(0), pascal("VideoHandler")),
      minf);
    const trak = atomo("trak",
      atomo("tkhd", u32(3), u32(0), u32(0), u32(1), u32(0), u32(durPelicula), ceros(8),
        u16(0), u16(0), u16(0), u16(0), MATRIZ, u32(ancho << 16), u32(alto << 16)),
      mdia);
    const moov = Uint8Array.from(atomo("moov",
      atomo("mvhd", u32(0), u32(0), u32(0), u32(ESCALA_PELICULA), u32(durPelicula), u32(0x10000), u16(0x100),
        ceros(10), MATRIZ, u32(0), u32(0), u32(0), u32(0), u32(0), u32(0), u32(2)),
      trak));
    return [ftyp, mdatEnc, ...cuadros, moov];
  }

  function unirPartes(partes) {
    const total = partes.reduce((s, p) => s + p.length, 0);
    const out = new Uint8Array(total);
    let p = 0;
    for (const x of partes) { out.set(x, p); p += x.length; }
    return out;
  }

  const api = { codificarCuadro, crearMov, unirPartes };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MovAnimation = api;
})(this);
