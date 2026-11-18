// ══ CARNAVAL ══ Pantalla de reels de cobertura: plantel, auspiciantes, vista previa y exportación.
// El proceso del video vive en carnaval-video.js; la gráfica en carnaval-grafica.js.
(function () {
  const C = window.CarnavalCore, Gr = window.CarnavalGrafica;
  const SK = { figuras: "dru_carnaval_figuras", marcas: "dru_carnaval_marcas", ultimaMarca: "dru_carnaval_marca", luts: "dru_carnaval_luts", ultimaLut: "dru_carnaval_lut" };
  const L = window.CarnavalLUT;
  let luts = [], lutActual = null, colorPreview = null;   // lutActual: { tamano, datos }
  let figuras = [], marcas = [], archivo = null, recursos = null, logo = null, exportando = false, animando = false;
  // Sin clip, la vista previa reproduce la gráfica sola en un bucle (entrada + oleaje del río).
  const BUCLE_SIN_VIDEO = 6;
  let relojInicio = performance.now();
  const $ = (id) => document.getElementById(id);
  const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const leer = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch (e) { return def; } };

  async function cargarDatos() {
    figuras = leer(SK.figuras, []); marcas = leer(SK.marcas, []); luts = leer(SK.luts, []);
    const [f, m, l] = await Promise.all([dbGet("carnaval_figuras"), dbGet("carnaval_marcas"), dbGet("carnaval_luts")]);
    if (f) { figuras = f; guardar(SK.figuras, f); }    // sin conexión queda la última copia
    if (m) { marcas = m; guardar(SK.marcas, m); }
    if (l) { luts = l; guardar(SK.luts, l); }
  }

  function opcionesComparsas(sel) {
    $(sel).innerHTML = C.COMPARSAS.map((c) => `<option value="${c.id}">${esc(c.nombre)}</option>`).join("");
  }
  function cambioComparsa() {
    const comp = $("car-comparsa").value;
    const lista = figuras.filter((f) => f.comparsa === comp);
    $("car-figura").innerHTML = `<option value="">— Elegí del plantel o escribí abajo —</option>` +
      lista.map((f) => `<option value="${f.id}">${esc(f.puesto)} · ${esc([f.nombre1, f.nombre2].filter(Boolean).join(" y "))}</option>`).join("");
    refrescar();
  }
  function elegirFigura() {
    const f = figuras.find((x) => String(x.id) === $("car-figura").value);
    if (f) { $("car-n1").value = f.nombre1; $("car-n2").value = f.nombre2 || ""; $("car-puesto").value = f.puesto; }
    refrescar();
  }
  function opcionesMarcas() {
    const ultima = leer(SK.ultimaMarca, "");
    $("car-marca").innerHTML = `<option value="">Ninguno</option>` + marcas.map((m) => `<option value="${m.id}">${esc(m.nombre)}</option>`).join("");
    $("car-marca").value = marcas.some((m) => String(m.id) === String(ultima)) ? String(ultima) : "";
    elegirMarca();
  }
  function elegirMarca() {
    const id = $("car-marca").value; guardar(SK.ultimaMarca, id);
    const m = marcas.find((x) => String(x.id) === id);
    logo = null;
    if (m) { const i = new Image(); i.onload = () => { logo = i; refrescar(); }; i.src = m.logo; }
    refrescar();
  }

  function opcionesLuts() {
    const ultima = leer(SK.ultimaLut, "");
    $("car-lut").innerHTML = `<option value="">Sin corrección (color del clip)</option>` + luts.map((x) => `<option value="${x.id}">${esc(x.nombre)}</option>`).join("");
    $("car-lut").value = luts.some((x) => String(x.id) === String(ultima)) ? String(ultima) : "";
    elegirLut();
  }
  function elegirLut() {
    const id = $("car-lut").value; guardar(SK.ultimaLut, id);
    const x = luts.find((y) => String(y.id) === id);
    lutActual = null; colorPreview = null;
    if (x) {
      try {
        lutActual = { tamano: x.tamano, datos: L.descomprimir(x.datos, x.tamano) };
        colorPreview = L.crearAplicador(lutActual.tamano, lutActual.datos, 540, 960);
      } catch (e) { showToast("⚠ " + e.message); lutActual = null; }
    }
    $("car-color").hidden = !colorPreview;
    refrescar();
  }

  function datos() {
    return { comparsa: $("car-comparsa").value, nombre1: $("car-n1").value, nombre2: $("car-n2").value, puesto: $("car-puesto").value, auspiciante: logo };
  }
  function listoParaExportar() { return !!(archivo && recursos && $("car-n1").value.trim() && !exportando); }

  // Vista previa: el <video> se reproduce y la gráfica se dibuja encima según su tiempo.
  function dibujarPreview() {
    if (!recursos) return;
    const v = $("car-video");
    const t = archivo ? v.currentTime : ((performance.now() - relojInicio) / 1000) % BUCLE_SIN_VIDEO;
    if (colorPreview && archivo && v.readyState >= 2) {   // el video con la LUT, a media resolución
      if (!dibujarPreview.tmp) { dibujarPreview.tmp = document.createElement("canvas"); dibujarPreview.tmp.width = 540; dibujarPreview.tmp.height = 960; }
      const tmp = dibujarPreview.tmp, k = tmp.getContext("2d");
      const esc_ = Math.max(540 / v.videoWidth, 960 / v.videoHeight), w = v.videoWidth * esc_, h = v.videoHeight * esc_;
      k.drawImage(v, (540 - w) / 2, (960 - h) / 2, w, h);
      $("car-color").getContext("2d").drawImage(colorPreview.aplicar(tmp), 0, 0);
    }
    Gr.dibujarGrafica($("car-capa").getContext("2d"), datos(), t, recursos);
  }
  function bucle() {
    if (!document.getElementById("page-carnaval").classList.contains("active")) { animando = false; return; }
    dibujarPreview(); requestAnimationFrame(bucle);
  }
  function refrescar() { $("car-exportar").disabled = !listoParaExportar(); if (!animando) dibujarPreview(); }
  function reproducir() {
    if (!archivo) { relojInicio = performance.now(); return; }   // reinicia el bucle de la gráfica sola
    const v = $("car-video"); v.currentTime = 0; v.play();
  }

  async function elegirArchivo(f) {
    if (!f) return;
    archivo = f;
    $("car-file-txt").textContent = f.name;
    $("car-file-info").textContent = "Analizando…";
    const v = $("car-video"); v.src = URL.createObjectURL(f); v.play().catch(() => {});
    try {
      const i = await window.CarnavalVideo.inspeccionar(f);
      const avisos = [];
      if (!i.decodificable) avisos.push("⚠ Este navegador no puede leer el video: exportalo como MP4 H.264 o HEVC.");
      if (!i.vertical) avisos.push("⚠ El clip no es vertical: se va a recortar al centro.");
      if (i.duracion > 60) avisos.push("⚠ Dura más de un minuto: la exportación va a tardar.");
      $("car-file-info").textContent = `${i.ancho}×${i.alto} · ${i.duracion.toFixed(1)} s · ${i.codec}${i.audio ? " + " + i.audio : " · sin audio"}. ${avisos.join(" ")}`;
      if (!i.decodificable) archivo = null;
    } catch (e) { $("car-file-info").textContent = "⚠ " + e.message; archivo = null; }
    refrescar();
  }

  async function exportar() {
    if (!listoParaExportar()) return;
    exportando = true; refrescar();
    const barra = $("car-barra"), est = $("car-estado");
    $("car-progreso").hidden = false; barra.style.width = "0";
    const t0 = performance.now();
    try {
      const d = datos();
      const mp4 = await window.CarnavalVideo.exportar(archivo, d, recursos, {
        lut: lutActual,
        alAvanzar: (p) => { barra.style.width = Math.round(p * 100) + "%"; est.textContent = `Exportando… ${Math.round(p * 100)} %`; }
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(mp4); a.download = C.nombreArchivo(d.comparsa, d.nombre1, d.nombre2, new Date());
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 10000);
      est.textContent = `Listo en ${((performance.now() - t0) / 1000).toFixed(0)} s · ${(mp4.size / 1e6).toFixed(1)} MB`;
      showToast("✓ Reel exportado");
    } catch (e) {
      est.textContent = "⚠ " + e.message;
    } finally { exportando = false; refrescar(); }
  }

  // ── Plantel y marcas ──
  function pintarListas() {
    const color = (id) => (C.comparsa(id) || C.COMPARSAS[0]).bandas[0];
    $("pl-lista").innerHTML = figuras.length ? figuras.map((f) => `<div class="car-fila"><span><span class="car-punto" style="background:${color(f.comparsa)}"></span><b>${esc([f.nombre1, f.nombre2].filter(Boolean).join(" y "))}</b> · ${esc(f.puesto)}</span><button class="btn btn--ghost btn--sm" onclick="Carnaval.borrar('carnaval_figuras',${f.id})">Quitar</button></div>`).join("")
      : `<div class="empty">Todavía no hay figuras cargadas.</div>`;
    $("mk-lista").innerHTML = marcas.length ? marcas.map((m) => `<div class="car-fila"><span><img src="${m.logo}" alt=""> ${esc(m.nombre)}</span><button class="btn btn--ghost btn--sm" onclick="Carnaval.borrar('carnaval_marcas',${m.id})">Quitar</button></div>`).join("")
      : `<div class="empty">Todavía no hay auspiciantes.</div>`;
    $("lut-lista").innerHTML = luts.length ? luts.map((x) => `<div class="car-fila"><span><b>${esc(x.nombre)}</b> · LUT ${x.tamano}³</span><button class="btn btn--ghost btn--sm" onclick="Carnaval.borrar('carnaval_luts',${x.id})">Quitar</button></div>`).join("")
      : `<div class="empty">Todavía no hay LUTs. Sin LUT, el video sale con el color del clip.</div>`;
  }
  async function agregarLut() {
    const nombre = $("lut-nombre").value.trim(), f = $("lut-archivo").files[0];
    if (!nombre || !f) { showToast("⚠ Completá nombre y archivo .cube"); return; }
    let lut;
    try { lut = L.leerCube(await f.text()); } catch (e) { showToast("⚠ " + e.message); return; }
    if (lut.tamano > 65) { showToast("⚠ La LUT es demasiado grande (máx. 65³)"); return; }
    const r = await dbPost("insert", "carnaval_luts", { row: { nombre, tamano: lut.tamano, datos: L.comprimir(lut) } });
    if (!r || r.error) { showToast("⚠ No se pudo guardar: " + ((r && r.error) || "sin conexión con la base")); return; }
    $("lut-nombre").value = ""; $("lut-archivo").value = "";
    await cargarDatos(); pintarListas(); opcionesLuts(); showToast("✓ LUT agregada");
  }
  async function agregarFigura() {
    const fila = { comparsa: $("pl-comparsa").value, puesto: $("pl-puesto").value.trim(), nombre1: $("pl-n1").value.trim(), nombre2: $("pl-n2").value.trim() || null, orden: figuras.length };
    if (!fila.puesto || !fila.nombre1) { showToast("⚠ Completá puesto y nombre"); return; }
    const r = await dbPost("insert", "carnaval_figuras", { row: fila });
    if (!r || r.error) { showToast("⚠ No se pudo guardar: " + ((r && r.error) || "sin conexión con la base")); return; }
    ["pl-puesto", "pl-n1", "pl-n2"].forEach((id) => ($(id).value = ""));
    await cargarDatos(); pintarListas(); cambioComparsa(); showToast("✓ Figura agregada");
  }
  function logoComoDataURL(file) {   // reduce a máx. 600 px de ancho, PNG
    return new Promise((ok, mal) => {
      const i = new Image();
      i.onload = () => { const k = Math.min(1, 600 / i.width); const c = document.createElement("canvas"); c.width = Math.round(i.width * k); c.height = Math.round(i.height * k); c.getContext("2d").drawImage(i, 0, 0, c.width, c.height); ok(c.toDataURL("image/png")); };
      i.onerror = () => mal(new Error("No se pudo leer la imagen"));
      i.src = URL.createObjectURL(file);
    });
  }
  async function agregarMarca() {
    const nombre = $("mk-nombre").value.trim(), f = $("mk-logo").files[0];
    if (!nombre || !f) { showToast("⚠ Completá marca y logo"); return; }
    const logoUrl = await logoComoDataURL(f);
    if (logoUrl.length > 400000) { showToast("⚠ El logo es muy pesado: usá uno más simple"); return; }
    const r = await dbPost("insert", "carnaval_marcas", { row: { nombre, logo: logoUrl } });
    if (!r || r.error) { showToast("⚠ No se pudo guardar: " + ((r && r.error) || "sin conexión con la base")); return; }
    $("mk-nombre").value = ""; $("mk-logo").value = "";
    await cargarDatos(); pintarListas(); opcionesMarcas(); showToast("✓ Auspiciante agregado");
  }
  async function borrar(tabla, id) {
    await dbPost("delete", tabla, { id });
    await cargarDatos(); pintarListas(); cambioComparsa(); opcionesMarcas(); opcionesLuts();
  }

  function tab(cual) {
    document.querySelectorAll("[data-car-tab]").forEach((b) => b.classList.toggle("active", b.dataset.carTab === cual));
    $("car-reel").hidden = cual !== "reel"; $("car-plantel").hidden = cual !== "plantel";
    if (cual === "plantel") pintarListas();
  }

  let iniciado = false;
  async function abrir() {
    if (!iniciado) {
      iniciado = true;
      opcionesComparsas("car-comparsa"); opcionesComparsas("pl-comparsa");
      const drop = $("car-drop");
      drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("sobre"); });
      drop.addEventListener("dragleave", () => drop.classList.remove("sobre"));
      drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("sobre"); elegirArchivo(e.dataTransfer.files[0]); });
    }
    if (!recursos) {   // se reintenta cada vez que se abre la sección
      try { recursos = await Gr.cargarRecursos(); $("car-estado").textContent = "Dejá la pestaña abierta mientras se exporta."; }
      catch (e) { $("car-estado").textContent = "⚠ " + e.message; }
    }
    await cargarDatos();
    cambioComparsa(); opcionesMarcas(); opcionesLuts(); pintarListas();
    if (!animando) { animando = true; requestAnimationFrame(bucle); }
  }

  window.Carnaval = { abrir, tab, cambioComparsa, elegirFigura, elegirMarca, elegirLut, refrescar, reproducir, elegirArchivo, exportar, agregarFigura, agregarMarca, agregarLut, borrar };
})();
