// LUTs de color (.cube) para los reels del Carnaval: lectura, compresión en 16 bits para
// guardarlas en la base, y aplicación con la placa de video (WebGL2) cuadro por cuadro.
(function (root) {
  // ── Lectura de .cube (formato de Adobe/Resolve; rojo varía primero, después verde y azul) ──
  function leerCube(texto) {
    let tamano = 0, titulo = "", valores = [];
    for (const cruda of String(texto).split(/\r?\n/)) {
      const linea = cruda.trim();
      if (!linea || linea.startsWith("#")) continue;
      if (/^LUT_1D_SIZE/i.test(linea)) throw new Error("Es una LUT 1D; se necesita una LUT 3D (.cube con LUT_3D_SIZE).");
      if (/^LUT_3D_SIZE/i.test(linea)) { tamano = parseInt(linea.split(/\s+/)[1], 10); continue; }
      if (/^TITLE/i.test(linea)) { titulo = linea.replace(/^TITLE\s*/i, "").replace(/^"|"$/g, ""); continue; }
      if (/^DOMAIN_MIN/i.test(linea)) { if (linea.split(/\s+/).slice(1).some((v) => +v !== 0)) throw new Error("La LUT debe trabajar de 0 a 1 (DOMAIN_MIN distinto)."); continue; }
      if (/^DOMAIN_MAX/i.test(linea)) { if (linea.split(/\s+/).slice(1).some((v) => +v !== 1)) throw new Error("La LUT debe trabajar de 0 a 1 (DOMAIN_MAX distinto)."); continue; }
      if (/^[A-Z_]/i.test(linea)) continue;          // otras palabras clave que no usamos
      const p = linea.split(/\s+/);
      if (p.length >= 3) valores.push(+p[0], +p[1], +p[2]);
    }
    if (!tamano) throw new Error("El archivo no tiene LUT_3D_SIZE: no parece una LUT 3D .cube.");
    const esperado = tamano * tamano * tamano;
    if (valores.length !== esperado * 3) throw new Error(`La LUT dice tamaño ${tamano} y debería tener ${esperado} valores, pero tiene ${valores.length / 3}.`);
    return { tamano, titulo, datos: Float32Array.from(valores) };
  }

  // ── Compresión: 16 bits por canal, en base64 (≈ 290 KB para una LUT de 33) ──
  const aBase64 = (bytes) => {
    if (typeof Buffer !== "undefined") return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString("base64");
    let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  };
  const deBase64 = (texto) => {
    if (typeof Buffer !== "undefined") { const b = Buffer.from(texto, "base64"); return new Uint8Array(b.buffer, b.byteOffset, b.byteLength); }
    const s = atob(texto), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u;
  };
  function comprimir(lut) {
    const u16 = new Uint16Array(lut.datos.length);
    for (let i = 0; i < u16.length; i++) u16[i] = Math.round(Math.min(Math.max(lut.datos[i], 0), 1) * 65535);
    return aBase64(new Uint8Array(u16.buffer));
  }
  function descomprimir(texto, tamano) {
    const bytes = deBase64(texto);
    const u16 = new Uint16Array(bytes.slice().buffer);
    if (u16.length !== tamano * tamano * tamano * 3) throw new Error("La LUT guardada está incompleta.");
    const f = new Float32Array(u16.length);
    for (let i = 0; i < f.length; i++) f[i] = u16[i] / 65535;
    return f;
  }

  // ── Aplicación con WebGL2: la imagen se muestrea en una textura 3D con interpolación ──
  function crearAplicador(tamano, datos, ancho, alto) {
    const canvas = document.createElement("canvas");
    canvas.width = ancho; canvas.height = alto;
    const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true, premultipliedAlpha: false });
    if (!gl) throw new Error("Este navegador no tiene WebGL2: no se puede aplicar la LUT.");
    const vs = `#version 300 es
      in vec2 p; out vec2 uv;
      void main() { uv = vec2(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5); gl_Position = vec4(p, 0.0, 1.0); }`;
    const fs = `#version 300 es
      precision highp float; precision highp sampler3D;
      uniform sampler2D img; uniform sampler3D lut; uniform float n;
      in vec2 uv; out vec4 color;
      void main() {
        vec3 c = texture(img, uv).rgb;
        color = vec4(texture(lut, c * ((n - 1.0) / n) + 0.5 / n).rgb, 1.0);
      }`;
    const shader = (tipo, src) => { const s = gl.createShader(tipo); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, vs)); gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    // Textura 3D de la LUT (RGBA 16 bits flotante: filtrable en WebGL2)
    const rgba = new Float32Array(tamano * tamano * tamano * 4);
    for (let i = 0, j = 0; i < datos.length; i += 3, j += 4) { rgba[j] = datos[i]; rgba[j + 1] = datos[i + 1]; rgba[j + 2] = datos[i + 2]; rgba[j + 3] = 1; }
    const texLut = gl.createTexture();
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_3D, texLut);
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA16F, tamano, tamano, tamano, 0, gl.RGBA, gl.FLOAT, rgba);
    for (const p of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_3D, p, gl.LINEAR);
    for (const p of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T, gl.TEXTURE_WRAP_R]) gl.texParameteri(gl.TEXTURE_3D, p, gl.CLAMP_TO_EDGE);
    const texImg = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texImg);
    for (const p of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, p, gl.LINEAR);
    for (const p of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, p, gl.CLAMP_TO_EDGE);
    gl.uniform1i(gl.getUniformLocation(prog, "img"), 0);
    gl.uniform1i(gl.getUniformLocation(prog, "lut"), 1);
    gl.uniform1f(gl.getUniformLocation(prog, "n"), tamano);
    gl.viewport(0, 0, ancho, alto);

    return {
      canvas,
      // fuente: canvas, video o imagen del mismo tamaño. Devuelve el canvas WebGL con el color corregido.
      aplicar(fuente) {
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texImg);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, fuente);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        return canvas;
      }
    };
  }

  const api = { leerCube, comprimir, descomprimir, crearAplicador };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.CarnavalLUT = api;
})(this);
