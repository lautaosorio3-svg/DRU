# Carnaval · Gráfica de cobertura — Plan de implementación (parte 1 de 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dibujar en un canvas transparente de 1080×1920 la gráfica "Cobertura 2027 · Figuras" (degradado, lockup DRU, franjas de la comparsa, listón con 1 o 2 nombres, puestos, auspiciante, Concordia Carnaval) para cualquier instante `t` de su animación de entrada, idéntica a la plantilla del lienzo.

**Architecture:** Lógica pura (comparsas, medidas, textos, tiempos) en `carnaval-core.js` con tests de Node; dibujo en `carnaval-grafica.js` (usa canvas, fuentes de Adobe Fonts y PNG); una página de prueba visual que la dibuja sobre la foto de la plantilla y mide posiciones contra las de la plantilla. La parte 2 (otro plan) suma el video y la pantalla.

**Tech Stack:** JavaScript sin build (UMD, como `grafica-core.js`), Canvas 2D + `Path2D`, `node --test`, Adobe Fonts (`afu7nsm`).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-11-18-carnaval-video-design.md`.
- Lienzo 1080×1920; medidas en px copiadas de la plantilla (sección "La gráfica" del spec).
- Fuentes: nombres `"manometer-sans"` 400; puestos `"acumin-pro-extra-condensed"` 800. Si no cargan, no se dibuja con otra letra: se avisa.
- Colores: noche `#120B1F`, crema `#FFF6E9`; bandas por comparsa según la tabla del spec.
- Animación de entrada ≤ 1,25 s y después fija; ease-out cúbica.
- Sin dependencias nuevas. Commits terminan con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Sin push hasta terminar la parte 2.

## File Structure

- Create `assets/carnaval/dru-lockup.png`, `assets/carnaval/concordia-carnaval.png` — imágenes de la plantilla.
- Create `assets/carnaval/franjas.json` — trazados SVG de las tres bandas, para alto 232 (dos nombres) y 170 (un nombre).
- Create `carnaval-core.js` — datos y cálculos puros. Test: `tests/carnaval-core.test.js`.
- Create `carnaval-grafica.js` — `cargarRecursos()` y `dibujarGrafica(ctx, datos, t, recursos)`.
- Create `tests/visual/carnaval-grafica.html` — prueba visual con medición automática.

---

### Task 1: Recursos de la plantilla

**Files:**
- Create: `assets/carnaval/dru-lockup.png`, `assets/carnaval/concordia-carnaval.png`, `assets/carnaval/franjas.json`

- [ ] **Step 1: Copiar las imágenes del lienzo** (bajadas del artifact de diseño a `scratchpad/artifact-files/06f53df7-…/`)

```bash
D=/private/tmp/claude-501/-Users-losorio-Documents-DRU-EDITORIAL-CLAUDE/51576f5a-3333-41f6-b6ad-b6687322282e/scratchpad/artifact-files/06f53df7-db56-434d-b679-3476cf036a0b
mkdir -p assets/carnaval
cp $D/44d8cc7ab0470db66756f9cb4fd4a65d.png assets/carnaval/dru-lockup.png
cp $D/529805d884e8b9f91999e153ea1cd2f5.png assets/carnaval/concordia-carnaval.png
```

- [ ] **Step 2: Extraer los trazados de las franjas** de `Reel27-Desfile-Comparsas.dc.html` (copia en `.ref-clip/comparsas.html`)

```bash
python3 -I - .ref-clip/comparsas.html assets/carnaval/franjas.json <<'EOF'
import sys,re,json
s=open(sys.argv[1],encoding='utf-8').read()
fr={}
for m in re.finditer(r'<svg viewBox="0 0 1080 (\d+)"[^>]*>(.*?)</svg>',s,re.S):
    fr.setdefault(m.group(1),[p for p in re.findall(r'<path d="([^"]+)" fill="#',m.group(2))])
assert set(fr)=={"232","170"} and all(len(v)==3 for v in fr.values()), fr.keys()
json.dump(fr,open(sys.argv[2],'w'))
print({k:len(v) for k,v in fr.items()})
EOF
```
Expected: `{'232': 3, '170': 3}`

- [ ] **Step 3: Verificar**

Run: `sips -g pixelWidth -g pixelHeight assets/carnaval/*.png`
Expected: lockup 1309×190, Concordia Carnaval 700×225.

- [ ] **Step 4: Commit** — `git add assets/carnaval && git commit -m "Carnaval: recursos de la plantilla de cobertura"`

---

### Task 2: Lógica pura (`carnaval-core.js`)

**Files:**
- Create: `carnaval-core.js`
- Test: `tests/carnaval-core.test.js`

**Interfaces:**
- Consumes: `grafica-core.js` → `slug(texto)`, `tamanoQueEntra(ancho, tamano, max)`.
- Produces (`window.CarnavalCore` / `module.exports`):
  - `COMPARSAS: Array<{id, nombre, bandas: [hex, hex, hex]}>`, `comparsa(id)`.
  - `COLOR = { noche: "#120B1F", crema: "#FFF6E9" }`, `LIENZO = { W: 1080, H: 1920 }`.
  - `FUENTE = { nombres: {familia, peso, tamano}, puestos: {familia, peso, tamano} }` (tamaños calibrados en la Task 3).
  - `medidas(nNombres: 1|2) → { bloqueY, franjasH, liston: {x,y,w,h}, lineas: number[] (baselines), puestosBaseline, anchoTexto, auspiciante: {x,y,w,h}, carnaval: {x,y,w}, lockup: {x,y,w} }`.
  - `lineasListon(nombre1, nombre2) → string[]` (1 o 2 líneas en mayúsculas; la segunda empieza con "Y ").
  - `textoPuesto(puesto) → string` en mayúsculas.
  - `estadoAnim(t) → { fondo, franjas, liston, nombres, puestos, logos }` (cada uno 0..1, ya con curva).
  - `DURACION_ENTRADA = 1.25`.
  - `nombreArchivo(comparsaId, nombre1, nombre2, fecha) → "dru-carnaval-<comparsa>-<nombres>-<AAAAMMDD>.mp4"`.

- [ ] **Step 1: Tests que fallan** — `tests/carnaval-core.test.js`:

```js
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
```

- [ ] **Step 2: Correr y ver que fallan** — `npm test` → `Cannot find module '../carnaval-core'`.

- [ ] **Step 3: Implementación** — `carnaval-core.js`:

```js
// Lógica pura de la gráfica de cobertura del Carnaval 2027 (sin DOM ni canvas).
// Medidas copiadas de la plantilla "Cobertura 2027 · Figuras" del lienzo de diseño.
(function (root) {
  const G = typeof module !== "undefined" && module.exports ? require("./grafica-core") : root.GraficaCore;

  const LIENZO = { W: 1080, H: 1920 };
  const COLOR = { noche: "#120B1F", crema: "#FFF6E9" };
  const COMPARSAS = [
    { id: "bella-samba", nombre: "Bella Samba", bandas: ["#8A1FD6", "#F2B705", "#3E4FE0"] },
    { id: "rafaga", nombre: "Ráfaga", bandas: ["#E3262D", "#1E7A3C", "#E3262D"] },
    { id: "emperatriz", nombre: "Emperatriz", bandas: ["#0A9A2A", "#FFF6E9", "#0A9A2A"] },
    { id: "imperio", nombre: "Imperio", bandas: ["#1B3A9E", "#C8102E", "#F2C200"] }
  ];
  const comparsa = (id) => COMPARSAS.find((c) => c.id === id) || null;

  // Tamaños calibrados contra los anchos de la plantilla (Task 3).
  const FUENTE = {
    nombres: { familia: "manometer-sans", peso: 400, tamano: 66 },
    puestos: { familia: "acumin-pro-extra-condensed", peso: 800, tamano: 35 }
  };

  function medidas(n) {
    const dos = n === 2;
    const bloqueY = 1130;
    return {
      bloqueY,
      franjasH: dos ? 232 : 170,
      liston: { x: 70, y: bloqueY + 10, w: 940, h: dos ? 162 : 100 },
      lineas: dos ? [1212, 1274] : [1212],          // baselines de los nombres
      puestosBaseline: bloqueY + (dos ? 198 : 136) + 33,
      anchoTexto: 800,                               // 940 − 2 × 70 de margen del listón
      auspiciante: { x: 390, y: 1400, w: 300, h: 90 },
      carnaval: { x: 368, y: 1510, w: 344 },
      lockup: { x: 64, y: 305, w: 300 }
    };
  }

  const limpio = (s) => String(s || "").trim().replace(/\s+/g, " ");
  function lineasListon(n1, n2) {
    const a = limpio(n1).toUpperCase(), b = limpio(n2).toUpperCase();
    return b ? [a, "Y " + b] : [a];
  }
  const textoPuesto = (p) => limpio(p).toUpperCase();

  // Entrada: [desde, duración] en segundos (tabla del spec).
  const ENTRADA = { fondo: [0, 0.4], franjas: [0.1, 0.5], liston: [0.25, 0.45], nombres: [0.45, 0.5], puestos: [0.7, 0.4], logos: [0.85, 0.4] };
  const DURACION_ENTRADA = 1.25;
  const easeOut = (p) => 1 - Math.pow(1 - p, 3);
  function estadoAnim(t) {
    const r = {};
    for (const [k, [desde, dur]] of Object.entries(ENTRADA)) {
      const p = Math.min(Math.max((t - desde) / dur, 0), 1);
      r[k] = p === 1 ? 1 : easeOut(p);
    }
    return r;
  }

  function nombreArchivo(comparsaId, n1, n2, fecha) {
    const nombres = [limpio(n1), limpio(n2)].filter(Boolean).join(" y ");
    const f = fecha.getFullYear() + String(fecha.getMonth() + 1).padStart(2, "0") + String(fecha.getDate()).padStart(2, "0");
    return `dru-carnaval-${comparsaId}-${G.slug(nombres)}-${f}.mp4`;
  }

  const api = { LIENZO, COLOR, COMPARSAS, comparsa, FUENTE, medidas, lineasListon, textoPuesto, estadoAnim, DURACION_ENTRADA, nombreArchivo, tamanoQueEntra: G.tamanoQueEntra };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.CarnavalCore = api;
})(this);
```

Nota: `slug` corta en 40 caracteres; para dos nombres largos el archivo queda abreviado, lo cual está bien.

- [ ] **Step 4: Correr y ver que pasan** — `npm test` → `fail 0`.
- [ ] **Step 5: Commit** — `git add carnaval-core.js tests/carnaval-core.test.js && git commit -m "Carnaval: lógica de la gráfica (comparsas, medidas, animación) + tests"`

---

### Task 3: Dibujo (`carnaval-grafica.js`) + prueba visual con calibración

**Files:**
- Create: `carnaval-grafica.js`, `tests/visual/carnaval-grafica.html`
- Modify: `carnaval-core.js` (solo los dos `tamano` de `FUENTE`, si la calibración da otro valor)

**Interfaces:**
- Consumes: todo `CarnavalCore` (Task 2), `assets/carnaval/*` (Task 1).
- Produces (`window.CarnavalGrafica`):
  - `cargarRecursos(base = "") → Promise<{ lockup: HTMLImageElement, carnaval: HTMLImageElement, franjas: {"232": Path2D[], "170": Path2D[]} }>`; rechaza con `Error("Faltan las fuentes de Adobe…")` si las fuentes no cargan.
  - `dibujarGrafica(ctx, datos, t, recursos)` con `datos = { comparsa: id, nombre1, nombre2, puesto, auspiciante: HTMLImageElement|null }`. Limpia el canvas y dibuja la gráfica transparente.
  - `calibrar() → { nombres: number, puestos: number }`: tamaño de fuente que reproduce los anchos de la plantilla (643 px "ESTELA ORCELLET", 653 px "PORTA BANDERA Y MAESTRO DE CEREMONIA").

- [ ] **Step 1: `carnaval-grafica.js`**

```js
// Dibuja la gráfica de cobertura del Carnaval 2027 en un canvas 1080×1920 transparente.
// Necesita: carnaval-core.js, el proyecto de Adobe Fonts "afu7nsm" y assets/carnaval/.
(function () {
  const C = window.CarnavalCore;

  function imagen(src) {
    return new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => mal(new Error("No cargó " + src)); i.src = src; });
  }
  const fuente = (f, tam) => `${f.peso} ${tam}px "${f.familia}"`;

  async function cargarRecursos(base = "") {
    await Promise.all([document.fonts.load(fuente(C.FUENTE.nombres, 60), "AÑÍ"), document.fonts.load(fuente(C.FUENTE.puestos, 30), "AÑÍ")]);
    if (!document.fonts.check(fuente(C.FUENTE.nombres, 60)) || !document.fonts.check(fuente(C.FUENTE.puestos, 30))) {
      throw new Error("Faltan las fuentes de Adobe (Manometer Sans y Acumin Extra Condensed Black). Revisá la conexión y recargá.");
    }
    const [lockup, carnaval, franjasJson] = await Promise.all([
      imagen(base + "assets/carnaval/dru-lockup.png"),
      imagen(base + "assets/carnaval/concordia-carnaval.png"),
      fetch(base + "assets/carnaval/franjas.json").then((r) => r.json())
    ]);
    const franjas = {};
    for (const [h, paths] of Object.entries(franjasJson)) franjas[h] = paths.map((d) => new Path2D(d));
    return { lockup, carnaval, franjas };
  }

  // Tamaño de fuente que reproduce un ancho de la plantilla.
  function tamanoPara(ctx, f, texto, anchoPlantilla) {
    ctx.font = fuente(f, 100);
    return +(100 * anchoPlantilla / ctx.measureText(texto).width).toFixed(2);
  }
  function calibrar() {
    const ctx = document.createElement("canvas").getContext("2d");
    return {
      nombres: tamanoPara(ctx, C.FUENTE.nombres, "ESTELA ORCELLET", 643),
      puestos: tamanoPara(ctx, C.FUENTE.puestos, "PORTA BANDERA Y MAESTRO DE CEREMONIA", 653)
    };
  }

  // Texto centrado en x 540; achica la letra si no entra en `max`.
  function textoCentrado(ctx, f, texto, baseline, max) {
    ctx.font = fuente(f, f.tamano);
    const t = C.tamanoQueEntra(ctx.measureText(texto).width, f.tamano, max);
    if (t !== f.tamano) ctx.font = fuente(f, t);
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(texto, C.LIENZO.W / 2, baseline);
  }

  function listonPath(l) {
    const p = new Path2D();
    p.moveTo(l.x, l.y); p.lineTo(l.x + l.w, l.y); p.lineTo(l.x + l.w - 30, l.y + l.h / 2);
    p.lineTo(l.x + l.w, l.y + l.h); p.lineTo(l.x, l.y + l.h); p.lineTo(l.x + 30, l.y + l.h / 2); p.closePath();
    return p;
  }

  function dibujarGrafica(ctx, datos, t, r) {
    const { W, H } = C.LIENZO;
    const lineas = C.lineasListon(datos.nombre1, datos.nombre2);
    const m = C.medidas(lineas.length);
    const a = C.estadoAnim(t);
    const comp = C.comparsa(datos.comparsa) || C.COMPARSAS[0];
    ctx.clearRect(0, 0, W, H);

    // Degradado noche y lockup DRU
    ctx.save();
    ctx.globalAlpha = a.fondo;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    [[0, 0.7], [0.2, 0.15], [0.32, 0], [0.5, 0], [0.72, 0.8], [1, 0.95]].forEach(([s, o]) => g.addColorStop(s, `rgba(18,11,31,${o})`));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const lk = m.lockup;
    ctx.drawImage(r.lockup, lk.x, lk.y, lk.w, lk.w * r.lockup.height / r.lockup.width);
    ctx.restore();

    // Franjas: crecen desde el centro hacia los bordes
    if (a.franjas > 0) {
      ctx.save();
      const ancho = W * a.franjas;
      ctx.beginPath(); ctx.rect((W - ancho) / 2, m.bloqueY, ancho, m.franjasH); ctx.clip();
      ctx.translate(0, m.bloqueY);
      r.franjas[String(m.franjasH)].forEach((p, i) => { ctx.fillStyle = comp.bandas[i]; ctx.fill(p); });
      ctx.restore();
    }

    // Listón: barrido de izquierda a derecha; nombres que suben desde su máscara
    if (a.liston > 0) {
      const l = m.liston, forma = listonPath(l);
      ctx.save();
      ctx.beginPath(); ctx.rect(l.x, l.y, l.w * a.liston, l.h); ctx.clip();
      ctx.fillStyle = C.COLOR.crema;
      ctx.fill(forma);
      if (a.nombres > 0) {
        ctx.clip(forma);
        ctx.fillStyle = C.COLOR.noche;
        lineas.forEach((txt, i) => {
          const sube = (1 - a.nombres) * (l.h * 0.8) + i * (1 - a.nombres) * 20;
          textoCentrado(ctx, C.FUENTE.nombres, txt, m.lineas[i] + sube, m.anchoTexto);
        });
      }
      ctx.restore();
    }

    // Puestos: fundido y suben 16 px
    if (a.puestos > 0 && datos.puesto) {
      ctx.save();
      ctx.globalAlpha = a.puestos;
      ctx.shadowColor = "rgba(18,11,31,0.9)"; ctx.shadowBlur = 10; ctx.shadowOffsetY = 2;
      ctx.fillStyle = C.COLOR.crema;
      textoCentrado(ctx, C.FUENTE.puestos, C.textoPuesto(datos.puesto), m.puestosBaseline + (1 - a.puestos) * 16, 900);
      ctx.restore();
    }

    // Auspiciante (contenido en su recuadro) y Concordia Carnaval
    if (a.logos > 0) {
      ctx.save();
      ctx.globalAlpha = a.logos;
      const s = m.auspiciante, img = datos.auspiciante;
      if (img) {
        const k = Math.min(s.w / img.width, s.h / img.height);
        const w = img.width * k, h = img.height * k;
        ctx.drawImage(img, s.x + (s.w - w) / 2, s.y + (s.h - h) / 2, w, h);
      }
      const c = m.carnaval;
      ctx.drawImage(r.carnaval, c.x, c.y, c.w, c.w * r.carnaval.height / r.carnaval.width);
      ctx.restore();
    }
  }

  window.CarnavalGrafica = { cargarRecursos, dibujarGrafica, calibrar };
})();
```

- [ ] **Step 2: Página de prueba** — `tests/visual/carnaval-grafica.html`: carga Typekit, `grafica-core.js`, `carnaval-core.js`, `carnaval-grafica.js` (rutas `../../`), dibuja sobre la foto de la plantilla (`.ref-clip/_blob/d6e77a4d18d1c6b258c3a419e8e43969`, local, no se commitea) los casos: 2 nombres (Bella Samba, "Estela Orcellet" + "Emilio Molina", "Porta bandera y maestro de ceremonia"), 1 nombre (Imperio, "Nombre Apellido", "Reina de la comparsa"), Emperatriz (banda crema), nombre muy largo, y una tira de cuadros en t = 0.2 / 0.4 / 0.6 / 0.9 / 1.3. Expone `window.resultados` con: calibración, y para el caso de 2 nombres los bordes medidos del texto oscuro de cada línea y del texto crema de los puestos.

```html
<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>Prueba · gráfica Carnaval</title>
<link rel="stylesheet" href="https://use.typekit.net/afu7nsm.css">
<style>body{margin:0;background:#222;color:#eee;font:14px sans-serif;padding:16px}canvas{width:270px;height:480px;margin:4px;background:#333}.fila{display:flex;flex-wrap:wrap}</style>
</head><body>
<div id="estado">Cargando…</div><div class="fila" id="casos"></div><div class="fila" id="tira"></div>
<script src="../../grafica-core.js"></script><script src="../../carnaval-core.js"></script><script src="../../carnaval-grafica.js"></script>
<script>
(async () => {
  const est = document.getElementById("estado");
  try {
    const r = await CarnavalGrafica.cargarRecursos("../../");
    const foto = await new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = "../../.ref-clip/_blob/d6e77a4d18d1c6b258c3a419e8e43969"; });
    const lienzo = (datos, t, dest) => {
      const c = document.createElement("canvas"); c.width = 1080; c.height = 1920;
      const x = c.getContext("2d"); const capa = document.createElement("canvas"); capa.width = 1080; capa.height = 1920;
      CarnavalGrafica.dibujarGrafica(capa.getContext("2d"), datos, t, r);
      if (foto) x.drawImage(foto, 0, 0, 1080, 1920);
      x.drawImage(capa, 0, 0); dest.appendChild(c); return { c, capa };
    };
    const casos = document.getElementById("casos"), tira = document.getElementById("tira");
    const dos = { comparsa: "bella-samba", nombre1: "Estela Orcellet", nombre2: "Emilio Molina", puesto: "Porta bandera y maestro de ceremonia", auspiciante: null };
    const { capa } = lienzo(dos, 2, casos);
    lienzo({ comparsa: "imperio", nombre1: "Nombre Apellido", nombre2: "", puesto: "Reina de la comparsa", auspiciante: null }, 2, casos);
    lienzo({ comparsa: "emperatriz", nombre1: "Valentina Fernández", nombre2: "", puesto: "Figura central", auspiciante: null }, 2, casos);
    lienzo({ comparsa: "rafaga", nombre1: "María Fernanda de los Ángeles", nombre2: "Juan Ignacio Etchegaray", puesto: "Pareja de baile", auspiciante: null }, 2, casos);
    for (const t of [0.2, 0.4, 0.6, 0.9, 1.3]) lienzo(dos, t, tira);
    // Medir: bordes del texto oscuro en cada línea del listón y del texto crema de los puestos
    const d = capa.getContext("2d").getImageData(0, 0, 1080, 1920).data;
    const caja = (y0, y1, cond) => { let a = [1e9, -1, 1e9, -1]; for (let y = y0; y < y1; y++) for (let x = 0; x < 1080; x++) { const i = (y * 1080 + x) * 4; if (cond(d[i], d[i + 1], d[i + 2], d[i + 3])) { a[0] = Math.min(a[0], x); a[1] = Math.max(a[1], x); a[2] = Math.min(a[2], y); a[3] = Math.max(a[3], y); } } return a; };
    const oscuro = (r_, g, b, al) => al > 200 && r_ < 60 && b < 70;
    const crema = (r_, g, b, al) => al > 200 && r_ > 230 && g > 225;
    window.resultados = {
      calibracion: CarnavalGrafica.calibrar(),
      linea1: caja(1150, 1220, oscuro), linea2: caja(1222, 1290, oscuro),
      puestos: caja(1320, 1370, crema)
    };
    est.textContent = "Listo · " + JSON.stringify(window.resultados);
  } catch (e) { est.textContent = "Error: " + e.message; window.resultados = { error: e.message }; }
})();
</script></body></html>
```

- [ ] **Step 3: Calibrar las fuentes** — abrir `http://localhost:3001/tests/visual/carnaval-grafica.html` (servidor `dru-preview`) y leer `window.resultados.calibracion`. Si difieren de 66 / 35, escribir esos valores (redondeados a 0,1) en `FUENTE` de `carnaval-core.js` y recargar.

- [ ] **Step 4: Verificar contra la plantilla** — con la calibración aplicada, `window.resultados` debe dar (±4 px): línea 1 ancho 643 centrado en 540 (x ≈ 219–861), base en y ≈ 1212; línea 2 ancho 609 (x ≈ 236–844), base ≈ 1274; puestos ancho 653 (x ≈ 214–866), base ≈ 1361. Revisar a ojo la tira de animación y los casos (1 nombre, banda crema de Emperatriz, nombre largo achicado dentro del listón).

- [ ] **Step 5: Tests y commit** — `npm test` en verde; `git add carnaval-grafica.js carnaval-core.js tests/visual/carnaval-grafica.html && git commit -m "Carnaval: dibujo de la gráfica de cobertura + prueba visual calibrada"`

---

## Parte 2 (plan aparte, después de aprobar la gráfica)
Proceso del video con Mediabunny copiado al repo, pantalla "15 · Carnaval", plantel y marcas en Supabase, exportación MP4 y pruebas con `log.mp4` en la M1.
