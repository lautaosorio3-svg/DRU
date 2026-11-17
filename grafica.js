// ══ GRÁFICA ══
// Placas de redes de DRU dibujadas en <canvas> (sin functions ni base de datos).
// Medidas y tiempos en grafica-core.js. Se carga después del <script> principal de index.html
// y usa sus helpers globales: esc, showToast.
(function () {
  const G = window.GraficaCore;
  const Z = G.ZOCALO;
  const NARANJA = "#F7941D", NEGRO = "#121212", BLANCO = "#FFFFFF";

  let plantilla = "zocalo";
  let tPreview = 1.5;          // instante que muestra la vista previa (cuadro fijo = PNG)
  let reproduciendo = false;
  let exportando = false;

  // ── Fuentes ──
  let fuentesListas = null;
  function cargarFuentes() {
    if (!fuentesListas) {
      fuentesListas = Promise.all([
        document.fonts.load('700 50px "Barlow Condensed"'),
        document.fonts.load('600 30px "Barlow"')
      ]);
    }
    return fuentesListas;
  }

  // ── Zócalo de entrevistas ──
  function datosZocalo() {
    const v = (id) => (document.getElementById(id).value || "").trim();
    return {
      nombre: v("gra-z-nombre"),
      linea2: [v("gra-z-empresa"), v("gra-z-cargo")].filter(Boolean).join(" · ")
    };
  }

  // Ajusta la fuente para que la caja no pase del ancho máximo y devuelve la medida.
  function medir(ctx, texto, peso, familia, tamano) {
    ctx.font = `${peso} ${tamano}px "${familia}"`;
    const ancho = ctx.measureText(texto).width;
    const t = G.tamanoQueEntra(ancho, tamano, Z.ANCHO_MAX - 2 * Z.MARGEN);
    if (t !== tamano) { ctx.font = `${peso} ${t}px "${familia}"`; return { tamano: t, ancho: ctx.measureText(texto).width }; }
    return { tamano, ancho };
  }

  function dibujarZocalo(ctx, d, t) {
    ctx.clearRect(0, 0, Z.W, Z.H);
    const nombre = (d.nombre || "Nombre y apellido").toUpperCase();
    const linea2 = d.linea2 || "Empresa · Cargo";
    const m1 = medir(ctx, nombre, 700, "Barlow Condensed", Z.caja1.fuente);
    const m2 = medir(ctx, linea2, 600, "Barlow", Z.caja2.fuente);
    const L = G.zocaloLayout({ nombre: m1.ancho, empresa: m2.ancho }, { nombre: m1.tamano, empresa: m2.tamano });
    const est = G.zocaloEstado(t);
    // Cada caja se arma con su texto en una capa aparte y se funde como un solo grupo
    // (si se dibujaran por separado con transparencia, el texto quedaría más opaco que la caja).
    const caja = (c, e, fondo, color, fuente, texto) => {
      if (e.alpha <= 0) return;
      const capa = document.createElement("canvas");
      capa.width = c.w; capa.height = c.h;
      const k = capa.getContext("2d");
      k.fillStyle = fondo;
      k.fillRect(0, 0, c.w, c.h);
      k.fillStyle = color;
      k.font = fuente;
      k.textBaseline = "alphabetic";
      k.fillText(texto, c.textX - c.x, c.baseline - c.y);
      ctx.save();
      ctx.globalAlpha = e.alpha;
      ctx.drawImage(capa, c.x + e.dx, c.y);
      ctx.restore();
    };
    caja(L.empresa, est.empresa, NEGRO, BLANCO, `600 ${m2.tamano}px "Barlow"`, linea2);
    caja(L.nombre, est.nombre, NARANJA, NEGRO, `700 ${m1.tamano}px "Barlow Condensed"`, nombre);
  }

  // ── Registro de plantillas (fase 1: posteo, historia y reel se suman acá) ──
  const PLANTILLAS = {
    zocalo: { formato: "zocalo", w: Z.W, h: Z.H, animada: true, duracion: Z.DURACION, datos: datosZocalo, dibujar: dibujarZocalo, texto: (d) => d.nombre }
  };

  // ── Vista previa ──
  function canvasPreview() { return document.getElementById("gra-canvas"); }

  async function render() {
    await cargarFuentes();
    const p = PLANTILLAS[plantilla];
    const c = canvasPreview();
    if (c.width !== p.w) { c.width = p.w; c.height = p.h; }
    p.dibujar(c.getContext("2d"), p.datos(), tPreview);
    const slider = document.getElementById("gra-t");
    slider.value = tPreview;
    document.getElementById("gra-t-label").textContent = tPreview.toFixed(2) + " s";
  }

  function reproducir() {
    const p = PLANTILLAS[plantilla];
    if (!p.animada || reproduciendo) return;
    reproduciendo = true;
    const t0 = performance.now();
    const paso = () => {
      tPreview = Math.min((performance.now() - t0) / 1000, p.duracion);
      render();
      if (tPreview < p.duracion && reproduciendo) requestAnimationFrame(paso);
      else { reproduciendo = false; tPreview = 1.5; render(); }
    };
    requestAnimationFrame(paso);
  }

  function setT(v) { reproduciendo = false; tPreview = Number(v); render(); }

  // ── Exportar ──
  function descargar(blob, nombre) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nombre;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  async function exportarPNG() {
    await cargarFuentes();
    const p = PLANTILLAS[plantilla];
    const c = document.createElement("canvas"); c.width = p.w; c.height = p.h;
    const d = p.datos();
    p.dibujar(c.getContext("2d"), d, p.animada ? 1.5 : 0);
    c.toBlob((b) => { descargar(b, G.nombreArchivo(p.formato, p.texto(d), new Date(), "png")); showToast("✓ PNG descargado"); }, "image/png");
  }

  const MIME_WEBM = "video/webm;codecs=vp9";
  function webmSoportado() { return !!(window.MediaRecorder && MediaRecorder.isTypeSupported(MIME_WEBM)); }

  // Graba la animación cuadro por cuadro en tiempo real (captureStream + MediaRecorder).
  async function grabarWebM(p, d) {
    const c = document.createElement("canvas"); c.width = p.w; c.height = p.h;
    const ctx = c.getContext("2d");
    p.dibujar(ctx, d, 0);
    const stream = c.captureStream(0);
    const track = stream.getVideoTracks()[0];
    const rec = new MediaRecorder(stream, { mimeType: MIME_WEBM, videoBitsPerSecond: 8e6 });
    const partes = [];
    rec.ondataavailable = (e) => { if (e.data.size) partes.push(e.data); };
    const fin = new Promise((res) => { rec.onstop = res; });
    rec.start();
    const total = Math.round(p.duracion * Z.FPS);
    const t0 = performance.now();
    for (let k = 0; k <= total; k++) {
      const espera = t0 + (k * 1000) / Z.FPS - performance.now();
      if (espera > 0) await new Promise((r) => setTimeout(r, espera));
      p.dibujar(ctx, d, k / Z.FPS);
      track.requestFrame();
    }
    await new Promise((r) => setTimeout(r, 1000 / Z.FPS));
    rec.stop();
    await fin;
    return new Blob(partes, { type: "video/webm" });
  }

  async function exportarWebM() {
    if (exportando) return;
    if (!webmSoportado()) { showToast("⚠ Este navegador no graba video con transparencia. Usá Chrome."); return; }
    await cargarFuentes();
    const p = PLANTILLAS[plantilla];
    const btn = document.getElementById("gra-webm-btn");
    exportando = true; btn.disabled = true; btn.textContent = "Grabando animación…";
    try {
      const d = p.datos();
      const blob = await grabarWebM(p, d);
      descargar(blob, G.nombreArchivo(p.formato, p.texto(d), new Date(), "webm"));
      showToast("✓ Animación descargada (WebM con transparencia)");
    } catch (e) {
      showToast("⚠ No se pudo grabar la animación: " + e.message);
    } finally {
      exportando = false; btn.disabled = false; btn.textContent = "Descargar animación (WebM)";
    }
  }

  function abrirGrafica() {
    document.getElementById("gra-webm-aviso").style.display = webmSoportado() ? "none" : "block";
    render();
  }

  window.Grafica = { abrir: abrirGrafica, render, reproducir, setT, exportarPNG, exportarWebM, _dibujar: (id, ctx, d, t) => PLANTILLAS[id].dibujar(ctx, d, t), _cargarFuentes: cargarFuentes, _grabarWebM: (id, d) => grabarWebM(PLANTILLAS[id], d) };
})();
