# Carnaval · Video con gráfica — Plan de implementación (parte 2 de 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Desde la sección "15 · Carnaval", elegir un clip, la figura del plantel y el auspiciante, ver la vista previa y exportar un MP4 1080×1920 con la gráfica de cobertura animada (franjas con efecto "río": entran como ola y quedan con oleaje sutil), todo en el navegador.

**Architecture:** `carnaval-core.js` suma la onda del río (pura, con tests). `carnaval-grafica.js` dibuja las franjas desplazadas por columnas según esa onda. `carnaval-video.js` (módulo ES) usa Mediabunny copiado en `vendor/`: `Conversion` con `process` compone cada cuadro (video a 1080×1920 + gráfica en `sample.timestamp`). `carnaval.js` arma la pantalla, el plantel y las marcas (Supabase vía `db.js`, con copia local para trabajar sin conexión).

**Tech Stack:** Mediabunny 1.65.1 (MPL-2.0, publicado 2026-11-03), WebCodecs, Canvas 2D, Supabase REST, `node --test`.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-11-18-carnaval-video-design.md`; parte 1: `docs/superpowers/plans/2026-11-18-carnaval-grafica.md`.
- Salida: MP4, H.264, 1080×1920, fps del original, 16 Mbps, cuadro clave cada 2 s; audio AAC 192 kbps (se copia si ya es AAC).
- Sin LUT ni corrección de color.
- Mediabunny local (`vendor/mediabunny-1.65.1.min.mjs`), nunca desde un CDN.
- El video nunca sale de la compu; plantel y marcas funcionan sin conexión con la última copia.
- Río: las franjas entran fluyendo de izquierda a derecha con una ola y siguen con oleaje sutil todo el video; el listón con los nombres queda firme.
- Commits con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; un solo push al final.

---

### Task 4: Efecto río (onda de las franjas)

**Files:**
- Modify: `carnaval-core.js`, `carnaval-grafica.js`, `tests/carnaval-core.test.js`, spec (sección animación)

**Interfaces:**
- Produces: `CarnavalCore.ondaRio(x: number, t: number) → number` (desplazamiento vertical en px de la columna `x` en el instante `t`), `CarnavalCore.RIO = { amplitudEntrada: 14, amplitudOleaje: 3, longitud: 720, periodo: 3.2 }`.
- `estadoAnim(t).franjas` pasa a ser el avance del frente del río de izquierda a derecha (0..1).

- [ ] **Step 1: Tests que fallan** — agregar a `tests/carnaval-core.test.js`:

```js
test("río: ola marcada al entrar y oleaje sutil después", () => {
  const max = (t) => Math.max(...Array.from({ length: 1081 }, (_, x) => Math.abs(C.ondaRio(x, t))));
  assert.ok(max(0.3) > 8, "ola de entrada visible: " + max(0.3));
  for (const t of [1.25, 2, 7.3, 29]) assert.ok(max(t) <= C.RIO.amplitudOleaje + 1e-9 && max(t) > 2, "oleaje sutil en t=" + t + ": " + max(t));
});

test("río: se mueve con el tiempo y es continuo", () => {
  assert.notEqual(C.ondaRio(300, 5), C.ondaRio(300, 5.5));
  assert.ok(Math.abs(C.ondaRio(300, 5) - C.ondaRio(300, 5 + 1 / 30)) < 1, "sin saltos entre cuadros");
  assert.ok(Math.abs(C.ondaRio(300, 5) - C.ondaRio(304, 5)) < 0.2, "sin escalones entre columnas");
});
```

- [ ] **Step 2: Correr** — `npm test` → falla con `C.ondaRio is not a function`.

- [ ] **Step 3: Implementación en `carnaval-core.js`** — antes de `function nombreArchivo` agregar:

```js
  // El río: las franjas ondulan como agua. Entran con una ola marcada que se calma
  // hasta un oleaje sutil y siguen así todo el video.
  const RIO = { amplitudEntrada: 14, amplitudOleaje: 3, longitud: 720, periodo: 3.2 };
  function ondaRio(x, t) {
    const calma = Math.min(Math.max((t - 0.1) / (DURACION_ENTRADA - 0.1), 0), 1);
    const amp = RIO.amplitudEntrada + (RIO.amplitudOleaje - RIO.amplitudEntrada) * easeOut(calma);
    return amp * Math.sin((2 * Math.PI * x) / RIO.longitud - (2 * Math.PI * t) / RIO.periodo);
  }
```

y exportar `RIO, ondaRio` en `api`.

- [ ] **Step 4: Dibujo en `carnaval-grafica.js`** — reemplazar el bloque `// Franjas: …` por:

```js
    // Franjas = el río: entran fluyendo de izquierda a derecha y ondulan siempre
    if (a.franjas > 0) {
      const h = m.franjasH, margen = 24;
      const clave = comp.id + "-" + h;
      if (!r._rios) r._rios = {};
      if (!r._rios[clave]) {                       // franjas planas, dibujadas una vez por comparsa
        const c = document.createElement("canvas");
        c.width = W; c.height = h + 2 * margen;
        const x = c.getContext("2d");
        x.translate(0, margen);
        r.franjas[String(h)].forEach((p, i) => { x.fillStyle = comp.bandas[i]; x.fill(p); });
        r._rios[clave] = c;
      }
      const rio = r._rios[clave], paso = 4, frente = W * a.franjas;
      for (let x = 0; x < frente; x += paso) {
        const dy = C.ondaRio(x + paso / 2, t);
        ctx.drawImage(rio, x, 0, paso, rio.height, x, m.bloqueY - margen + dy, paso, rio.height);
      }
    }
```

- [ ] **Step 5: Spec** — en "Animación de entrada", fila Franjas: "0,1 s · 0,5 s · el río entra fluyendo de izquierda a derecha con una ola (14 px) que se calma a un oleaje de 3 px y sigue todo el video". Debajo de la tabla: "La gráfica ya no queda quieta: las franjas ondulan siempre (onda de 720 px, período 3,2 s). Se redibuja en cada cuadro."

- [ ] **Step 6: Verificar** — `npm test` en verde; en `tests/visual/carnaval-grafica.html` la tira de animación muestra el frente del río avanzando con ola y los casos finales con una ondulación leve.

- [ ] **Step 7: Commit** — `git commit -m "Carnaval: las franjas son el río (ola de entrada y oleaje)"`

---

### Task 5: Proceso del video (`carnaval-video.js`)

**Files:**
- Create: `vendor/mediabunny-1.65.1.min.mjs`, `vendor/MEDIABUNNY-LICENSE.txt`, `carnaval-video.js`, `tests/visual/carnaval-video.html`

**Interfaces:**
- Consumes: `CarnavalGrafica.dibujarGrafica`, `CarnavalGrafica.cargarRecursos`.
- Produces (`window.CarnavalVideo`, cargado como `<script type="module">`):
  - `inspeccionar(file: Blob) → Promise<{ ancho, alto, duracion, codec, audio: string|null, decodificable: boolean, vertical: boolean }>`
  - `exportar(file: Blob, datos, recursos, { alAvanzar?: (p: 0..1) => void }) → Promise<Blob>` (MP4) — `datos` como en `dibujarGrafica`.
  - `cancelar()` — cancela la exportación en curso.

- [ ] **Step 1: Copiar Mediabunny**

```bash
S=/private/tmp/claude-501/-Users-losorio-Documents-DRU-EDITORIAL-CLAUDE/51576f5a-3333-41f6-b6ad-b6687322282e/scratchpad/mb/package
mkdir -p vendor && cp $S/dist/bundles/mediabunny.min.mjs vendor/mediabunny-1.65.1.min.mjs && cp $S/LICENSE vendor/MEDIABUNNY-LICENSE.txt
```

- [ ] **Step 2: `carnaval-video.js`**

```js
// Proceso del video del Carnaval, todo en la notebook: lee el clip, compone cada cuadro
// (video a 1080×1920 + gráfica animada) y exporta un MP4 listo para redes.
// Mediabunny va copiado en vendor/ para funcionar sin internet en el corsódromo.
import * as MB from "./vendor/mediabunny-1.65.1.min.mjs";

const W = 1080, H = 1920;
let conversionActual = null;

async function abrir(file) {
  return new MB.Input({ formats: MB.ALL_FORMATS, source: new MB.BlobSource(file) });
}

async function inspeccionar(file) {
  const input = await abrir(file);
  const v = await input.getPrimaryVideoTrack();
  if (!v) throw new Error("El archivo no tiene video.");
  const a = await input.getPrimaryAudioTrack();
  return {
    ancho: v.displayWidth, alto: v.displayHeight,
    duracion: await input.computeDuration(),
    codec: v.codec, audio: a ? a.codec : null,
    decodificable: await v.canDecode(),
    vertical: v.displayHeight > v.displayWidth
  };
}

async function exportar(file, datos, recursos, { alAvanzar } = {}) {
  const input = await abrir(file);
  const output = new MB.Output({ format: new MB.Mp4OutputFormat({ fastStart: "in-memory" }), target: new MB.BufferTarget() });
  const lienzo = document.createElement("canvas"); lienzo.width = W; lienzo.height = H;
  const ctx = lienzo.getContext("2d", { alpha: false });
  const capa = document.createElement("canvas"); capa.width = W; capa.height = H;
  const capaCtx = capa.getContext("2d");
  let inicio = null;

  const conversion = await MB.Conversion.init({
    input, output,
    video: {
      codec: "avc", bitrate: 16e6, keyFrameInterval: 2, forceTranscode: true,
      processedWidth: W, processedHeight: H,
      process: (sample) => {
        if (inicio === null) inicio = sample.timestamp;
        ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
        sample.drawWithFit(ctx, { fit: "cover" });
        window.CarnavalGrafica.dibujarGrafica(capaCtx, datos, sample.timestamp - inicio, recursos);
        ctx.drawImage(capa, 0, 0);
        return lienzo;
      }
    },
    audio: { codec: "aac", bitrate: 192e3 }
  });
  if (!conversion.isValid) {
    const motivos = conversion.discardedTracks.map((d) => `${d.track.type}: ${d.reason}`).join(", ");
    throw new Error("No se puede procesar este archivo (" + motivos + "). Exportalo como MP4 H.264 o HEVC.");
  }
  if (alAvanzar) conversion.onProgress = alAvanzar;
  conversionActual = conversion;
  try { await conversion.execute(); } finally { conversionActual = null; }
  return new Blob([output.target.buffer], { type: "video/mp4" });
}

function cancelar() { if (conversionActual) conversionActual.cancel(); }

window.CarnavalVideo = { inspeccionar, exportar, cancelar };
window.dispatchEvent(new Event("carnaval-video-listo"));
```

- [ ] **Step 3: Página de prueba** — `tests/visual/carnaval-video.html`: carga Typekit, `grafica-core.js`, `carnaval-core.js`, `carnaval-grafica.js` y `../../carnaval-video.js` (módulo); botón "Exportar prueba" que toma `../../.ref-clip/log.mp4`, exporta con Bella Samba / "Estela Orcellet" + "Emilio Molina" / "Porta bandera y maestro de ceremonia", mide el tiempo y muestra el resultado en un `<video>`; además deja en `window.prueba` = `{ segundos, MB, salida: inspeccionar(blob) }` y el color medido en el centro del listón (y 1170) del cuadro en t = 2 s.

```html
<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>Prueba · video Carnaval</title>
<link rel="stylesheet" href="https://use.typekit.net/afu7nsm.css">
<style>body{margin:0;background:#222;color:#eee;font:14px sans-serif;padding:16px}video{height:640px;background:#000}</style></head>
<body><p id="estado">Cargando…</p><button id="ir" disabled>Exportar prueba</button><br><video id="vid" controls muted playsinline></video>
<script src="../../grafica-core.js"></script><script src="../../carnaval-core.js"></script><script src="../../carnaval-grafica.js"></script>
<script type="module" src="../../carnaval-video.js"></script>
<script>
const est = document.getElementById("estado"), btn = document.getElementById("ir");
const listo = () => { est.textContent = "Listo para exportar"; btn.disabled = false; };
window.CarnavalVideo ? listo() : window.addEventListener("carnaval-video-listo", listo);
btn.onclick = async () => {
  btn.disabled = true;
  try {
    const recursos = await CarnavalGrafica.cargarRecursos("../../");
    const clip = await (await fetch("../../.ref-clip/log.mp4")).blob();
    const entrada = await CarnavalVideo.inspeccionar(clip);
    const datos = { comparsa: "bella-samba", nombre1: "Estela Orcellet", nombre2: "Emilio Molina", puesto: "Porta bandera y maestro de ceremonia", auspiciante: null };
    const t0 = performance.now();
    const mp4 = await CarnavalVideo.exportar(clip, datos, recursos, { alAvanzar: (p) => est.textContent = "Exportando… " + Math.round(p * 100) + " %" });
    const segundos = +((performance.now() - t0) / 1000).toFixed(1);
    const salida = await CarnavalVideo.inspeccionar(mp4);
    const v = document.getElementById("vid"); v.src = URL.createObjectURL(mp4);
    await new Promise((ok) => v.onloadeddata = ok); v.currentTime = 2; await new Promise((ok) => v.onseeked = ok);
    const c = document.createElement("canvas"); c.width = 1080; c.height = 1920; const x = c.getContext("2d"); x.drawImage(v, 0, 0, 1080, 1920);
    const listonCentro = Array.from(x.getImageData(540, 1150, 1, 1).data).join("/");
    window.prueba = { entrada, segundos, MB: +(mp4.size / 1e6).toFixed(1), salida, listonCentro };
    est.textContent = "Listo · " + JSON.stringify(window.prueba);
  } catch (e) { est.textContent = "Error: " + e.message; window.prueba = { error: e.message }; }
};
</script></body></html>
```

- [ ] **Step 4: Verificar** — abrir `http://localhost:3001/tests/visual/carnaval-video.html`, exportar y leer `window.prueba`: `salida` 1080×1920, codec `avc`, audio `aac`, duración ≈ 31,5 s; `listonCentro` crema (≈ 255/246/233); anotar `segundos` (objetivo < 60 s en la M1; en la M4 debería ser bastante menos). Mirar el video: gráfica animada, río ondulando, audio presente.

- [ ] **Step 5: Commit** — `git add vendor carnaval-video.js tests/visual/carnaval-video.html && git commit -m "Carnaval: proceso del video en el navegador (Mediabunny local)"`

---

### Task 6: Plantel y marcas en Supabase

**Files:**
- Modify: `netlify/functions/db.js` (TABLES), `SUPABASE_SETUP.md`

- [ ] **Step 1: `db.js`** — agregar a `TABLES`:

```js
  carnaval_figuras: { order: "comparsa.asc,orden.asc", limit: 500 },
  carnaval_marcas: { order: "creado.asc", limit: 50 },
```

- [ ] **Step 2: SQL en `SUPABASE_SETUP.md`** — sección "Carnaval — plantel y marcas":

```sql
create table carnaval_figuras (
  id bigint primary key generated always as identity,
  comparsa text not null,          -- bella-samba | rafaga | emperatriz | imperio
  puesto text not null,
  nombre1 text not null,
  nombre2 text,
  orden int default 0,
  creado timestamptz default now()
);
create table carnaval_marcas (
  id bigint primary key generated always as identity,
  nombre text not null,
  logo text not null,              -- PNG en data URL, máx. 300 KB
  creado timestamptz default now()
);
alter table carnaval_figuras enable row level security;
alter table carnaval_marcas enable row level security;
```

- [ ] **Step 3: Commit** — `git commit -m "Carnaval: tablas de plantel y marcas"`

---

### Task 7: Pantalla "15 · Carnaval" (`carnaval.js`)

**Files:**
- Create: `carnaval.js`
- Modify: `index.html` (menú, página, scripts), `estetica-2027.css` (estilos de la sección)

**Interfaces:**
- Consumes: `CarnavalCore`, `CarnavalGrafica`, `CarnavalVideo`, `dbGet(table)`, `dbPost(action, table, payload)`, `showToast`, `esc`, `currentUser` (globales del panel).
- Produces: `window.Carnaval = { abrir }` (lo llama `showPage("carnaval")`).

- [ ] **Step 1: Menú** — en el bloque "/ Diseño" de `index.html`, debajo de Gráfica:

```html
      <div class="sb-item" onclick="showPage('carnaval',this)">
        <span class="sb-item-num">15</span><span class="sb-item-name">Carnaval</span>
        <span class="sb-item-arrow">→</span>
      </div>
```

y en `PAGE_TITLE` → `carnaval:"Carnaval · cobertura"`; en `showPage` → `if(id==="carnaval")Carnaval.abrir();`.

- [ ] **Step 2: Página** — antes de `<!-- ═══ BORRADORES ═══ -->`:

```html
    <!-- ═══ CARNAVAL ═══ -->
    <div class="page" id="page-carnaval">
      <div class="hero">
        <div class="hero-row"><div class="hero-num">№ 15 · El Alma de la Fiesta</div><div class="hero-rule"></div><div class="hero-num">Cobertura 2027</div></div>
        <h1 class="hero-title">Reels del <span class="accent">carnaval</span></h1>
        <div class="hero-sub">Elegí el clip y la figura: el panel le suma la gráfica de cobertura y exporta el reel listo para redes. El video no sale de esta compu.</div>
        <div class="hero-gradient"></div>
      </div>
      <div class="chips" style="margin-bottom:1rem">
        <button class="chip active" data-car-tab="reel" onclick="Carnaval.tab('reel')">Armar reel</button>
        <button class="chip" data-car-tab="plantel" onclick="Carnaval.tab('plantel')">Plantel y marcas</button>
      </div>
      <div class="section" id="car-reel">
        <div class="wflow">
          <div class="wcol">
            <div class="step">
              <div class="step-head"><span class="step-num">1</span><div class="step-title">Clip</div></div>
              <label class="car-drop" id="car-drop">
                <input type="file" id="car-file" accept="video/mp4,video/quicktime,.mp4,.mov" hidden onchange="Carnaval.elegirArchivo(this.files[0])">
                <span id="car-file-txt">Arrastrá el clip acá o hacé clic para elegirlo</span>
              </label>
              <div class="step-help" id="car-file-info"></div>
            </div>
            <div class="step">
              <div class="step-head"><span class="step-num">2</span><div class="step-title">Figura</div></div>
              <div class="fgrid" style="margin-bottom:10px">
                <div class="ff ff--3"><label class="flbl" for="car-comparsa">Comparsa</label><select class="fi" id="car-comparsa" onchange="Carnaval.cambioComparsa()"></select></div>
                <div class="ff ff--3"><label class="flbl" for="car-figura">Del plantel</label><select class="fi" id="car-figura" onchange="Carnaval.elegirFigura()"></select></div>
              </div>
              <div class="fgrid" style="margin-bottom:10px">
                <div class="ff ff--3"><label class="flbl" for="car-n1">Nombre</label><input class="fi" id="car-n1" maxlength="40" oninput="Carnaval.refrescar()"></div>
                <div class="ff ff--3"><label class="flbl" for="car-n2">Segundo nombre (opcional)</label><input class="fi" id="car-n2" maxlength="40" oninput="Carnaval.refrescar()"></div>
              </div>
              <div class="ff"><label class="flbl" for="car-puesto">Puesto</label><input class="fi" id="car-puesto" maxlength="60" oninput="Carnaval.refrescar()"></div>
            </div>
            <div class="step">
              <div class="step-head"><span class="step-num">3</span><div class="step-title">Auspiciante</div></div>
              <select class="fi" id="car-marca" onchange="Carnaval.elegirMarca()"></select>
            </div>
            <div class="step">
              <div class="step-head"><span class="step-num">4</span><div class="step-title">Exportar</div></div>
              <button class="btn btn--peach" id="car-exportar" onclick="Carnaval.exportar()" disabled style="width:100%">Exportar reel (MP4 1080×1920)</button>
              <div class="car-progreso" id="car-progreso" hidden><div id="car-barra"></div></div>
              <div class="step-help" id="car-estado">Dejá la pestaña abierta mientras se exporta.</div>
            </div>
          </div>
          <div class="wcol">
            <div class="step">
              <div class="step-head"><span class="step-num">→</span><div class="step-title">Vista previa</div></div>
              <div class="car-preview"><video id="car-video" playsinline muted loop></video><canvas id="car-capa" width="1080" height="1920"></canvas></div>
              <div style="display:flex;gap:8px;margin-top:10px"><button class="btn btn--ghost btn--sm" onclick="Carnaval.reproducir()">▶ Reproducir desde el inicio</button></div>
            </div>
          </div>
        </div>
      </div>
      <div class="section" id="car-plantel" hidden>
        <div class="wflow">
          <div class="wcol">
            <div class="step">
              <div class="step-head"><span class="step-num">+</span><div class="step-title">Agregar figura</div></div>
              <div class="fgrid" style="margin-bottom:10px">
                <div class="ff ff--3"><label class="flbl" for="pl-comparsa">Comparsa</label><select class="fi" id="pl-comparsa"></select></div>
                <div class="ff ff--3"><label class="flbl" for="pl-puesto">Puesto</label><input class="fi" id="pl-puesto" maxlength="60" placeholder="Ej: Porta bandera y maestro de ceremonia"></div>
              </div>
              <div class="fgrid" style="margin-bottom:10px">
                <div class="ff ff--3"><label class="flbl" for="pl-n1">Nombre</label><input class="fi" id="pl-n1" maxlength="40"></div>
                <div class="ff ff--3"><label class="flbl" for="pl-n2">Segundo nombre (opcional)</label><input class="fi" id="pl-n2" maxlength="40"></div>
              </div>
              <button class="btn btn--primary btn--sm" onclick="Carnaval.agregarFigura()">Agregar al plantel</button>
            </div>
            <div class="step">
              <div class="step-head"><span class="step-num">+</span><div class="step-title">Agregar auspiciante</div></div>
              <div class="fgrid" style="margin-bottom:10px">
                <div class="ff ff--3"><label class="flbl" for="mk-nombre">Marca</label><input class="fi" id="mk-nombre" maxlength="40"></div>
                <div class="ff ff--3"><label class="flbl" for="mk-logo">Logo (PNG con fondo transparente)</label><input class="fi" type="file" id="mk-logo" accept="image/png,image/svg+xml,image/jpeg"></div>
              </div>
              <button class="btn btn--primary btn--sm" onclick="Carnaval.agregarMarca()">Agregar auspiciante</button>
            </div>
          </div>
          <div class="wcol">
            <div class="step"><div class="step-head"><div class="step-title">Plantel</div></div><div id="pl-lista"></div></div>
            <div class="step"><div class="step-head"><div class="step-title">Auspiciantes</div></div><div id="mk-lista"></div></div>
          </div>
        </div>
      </div>
    </div>
```

- [ ] **Step 3: Scripts** — al final de `index.html`, después de `grafica.js`:

```html
<script src="carnaval-core.js"></script>
<script src="carnaval-grafica.js"></script>
<script type="module" src="carnaval-video.js"></script>
<script src="carnaval.js"></script>
```

- [ ] **Step 4: Estilos** — agregar a `estetica-2027.css`:

```css
/* ===== Carnaval ===== */
.car-drop { display: flex; align-items: center; justify-content: center; min-height: 110px; padding: 1rem; border: 1.5px dashed var(--line); border-radius: var(--r-lg); text-align: center; cursor: pointer; color: var(--ink-3); }
.car-drop.sobre, .car-drop:hover { border-color: var(--naranja); color: var(--ink); }
.car-preview { position: relative; width: 100%; max-width: 360px; aspect-ratio: 9 / 16; margin: 0 auto; background: #120B1F; border-radius: var(--r-lg); overflow: hidden; }
.car-preview video, .car-preview canvas { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.car-progreso { height: 6px; margin-top: 12px; background: var(--surface-alt); overflow: hidden; }
.car-progreso > div { height: 100%; width: 0; background: var(--naranja); transition: width .2s; }
.car-fila { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 0; border-top: 1px solid var(--line-hair); }
.car-fila img { height: 32px; max-width: 120px; object-fit: contain; background: #2a2235; padding: 4px; }
.car-punto { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; vertical-align: middle; }
```

- [ ] **Step 5: `carnaval.js`**

```js
// ══ CARNAVAL ══ Pantalla de reels de cobertura: plantel, auspiciantes, vista previa y exportación.
// El proceso del video vive en carnaval-video.js; la gráfica en carnaval-grafica.js.
(function () {
  const C = window.CarnavalCore, Gr = window.CarnavalGrafica;
  const SK = { figuras: "dru_carnaval_figuras", marcas: "dru_carnaval_marcas", ultimaMarca: "dru_carnaval_marca" };
  let figuras = [], marcas = [], archivo = null, recursos = null, logo = null, exportando = false, animando = false;
  const $ = (id) => document.getElementById(id);
  const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const leer = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch (e) { return def; } };

  async function cargarDatos() {
    figuras = leer(SK.figuras, []); marcas = leer(SK.marcas, []);
    const [f, m] = await Promise.all([dbGet("carnaval_figuras"), dbGet("carnaval_marcas")]);
    if (f) { figuras = f; guardar(SK.figuras, f); }    // sin conexión queda la última copia
    if (m) { marcas = m; guardar(SK.marcas, m); }
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

  function datos() {
    return { comparsa: $("car-comparsa").value, nombre1: $("car-n1").value, nombre2: $("car-n2").value, puesto: $("car-puesto").value, auspiciante: logo };
  }
  function listoParaExportar() { return !!(archivo && recursos && $("car-n1").value.trim() && !exportando); }

  // Vista previa: el <video> se reproduce y la gráfica se dibuja encima según su tiempo.
  function dibujarPreview() {
    if (!recursos) return;
    const v = $("car-video");
    Gr.dibujarGrafica($("car-capa").getContext("2d"), datos(), archivo ? v.currentTime : 3, recursos);
  }
  function bucle() {
    if (!document.getElementById("page-carnaval").classList.contains("active")) { animando = false; return; }
    dibujarPreview(); requestAnimationFrame(bucle);
  }
  function refrescar() { $("car-exportar").disabled = !listoParaExportar(); if (!animando) dibujarPreview(); }
  function reproducir() { const v = $("car-video"); if (!archivo) return; v.currentTime = 0; v.play(); }

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
    await cargarDatos(); pintarListas(); cambioComparsa(); opcionesMarcas();
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
      try { recursos = await Gr.cargarRecursos(); } catch (e) { $("car-estado").textContent = "⚠ " + e.message; }
    }
    await cargarDatos();
    cambioComparsa(); opcionesMarcas(); pintarListas();
    if (!animando) { animando = true; requestAnimationFrame(bucle); }
  }

  window.Carnaval = { abrir, tab, cambioComparsa, elegirFigura, elegirMarca, refrescar, reproducir, elegirArchivo, exportar, agregarFigura, agregarMarca, borrar };
})();
```

- [ ] **Step 6: Verificar** — sintaxis de los scripts de `index.html`; en el panel local: abrir "15 · Carnaval", cargar `log.mp4` (con `javascript_tool` se puede pasar el archivo con `Carnaval.elegirArchivo(new File([blob], "log.mp4"))`), elegir comparsa y escribir nombres; la vista previa muestra el video con la gráfica animada y el río; el botón exportar se habilita. Medidas a 375 px: sin desbordes.

- [ ] **Step 7: Commit** — `git commit -m "Carnaval: sección 15 con plantel, auspiciantes, vista previa y exportación"`

---

### Task 8: Cierre

- [ ] **Step 1:** El usuario corre el SQL de "Carnaval — plantel y marcas" en Supabase.
- [ ] **Step 2:** `DOCUMENTACION.md`: fila "15 · Carnaval" en la tabla de secciones y archivos nuevos.
- [ ] **Step 3:** `npm test`, sintaxis, commit y un solo `git push origin main`.
- [ ] **Step 4:** En el sitio publicado: abrir la sección, cargar una figura y un auspiciante de prueba, exportar `log.mp4` y verificar el MP4 (resolución, audio, gráfica). Borrar los datos de prueba.
