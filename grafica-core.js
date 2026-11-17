// Lógica pura de la sección Gráfica (sin DOM ni canvas): tiempos de animación,
// medidas de las plantillas y nombres de archivo. Se usa en el navegador
// (window.GraficaCore) y en los tests de Node (`npm test`).
(function (root) {
  // ── Zócalo de entrevistas (calibrado contra Zocalo_Entrevistas_DRU_ejemplo.mov) ──
  const ZOCALO = {
    W: 1080, H: 1920, FPS: 30, DURACION: 4.5,
    DESPLAZAMIENTO: 140,   // px desde donde entra / hacia donde sale cada caja
    ENTRADA: 0.5,          // s, ease-out cúbico
    SALIDA: 0.4,           // s, ease-in cúbico
    nombre: { entra: 0, sale: 2.9 },
    empresa: { entra: 0.3, sale: 2.8 },
    MARGEN: 18,
    // baseline = centro de la caja + k × tamaño de fuente (k calibrado contra la referencia)
    caja1: { x: 60, y: 1280, h: 66, fuente: 50, k: 0.44 },   // naranja, nombre → baseline 1335
    caja2: { x: 60, y: 1356, h: 48, fuente: 30, k: 0.2667 }, // negra, empresa · cargo → baseline 1388
    ANCHO_MAX: 960         // ninguna caja pasa de x 60 + 960
  };

  const easeOutCubic = (p) => 1 - Math.pow(1 - p, 3);
  const easeInCubic = (p) => p * p * p;

  function cajaEstado(t, entra, sale) {
    const { DESPLAZAMIENTO: D, ENTRADA, SALIDA } = ZOCALO;
    if (t < entra || t >= sale + SALIDA) return { dx: -D, alpha: 0 };
    if (t < entra + ENTRADA) {
      const e = easeOutCubic((t - entra) / ENTRADA);
      return { dx: -D * (1 - e), alpha: e };
    }
    if (t <= sale) return { dx: 0, alpha: 1 };
    const e = easeInCubic((t - sale) / SALIDA);
    return { dx: -D * e, alpha: 1 - e };
  }

  function zocaloEstado(t) {
    return {
      nombre: cajaEstado(t, ZOCALO.nombre.entra, ZOCALO.nombre.sale),
      empresa: cajaEstado(t, ZOCALO.empresa.entra, ZOCALO.empresa.sale)
    };
  }

  // anchos = ancho medido del texto de cada caja (px); fuentes = tamaño usado (si se achicó)
  function zocaloLayout(anchos, fuentes = {}) {
    const caja = (c, ancho, f = c.fuente) => ({
      x: c.x, y: c.y, w: Math.round(ancho) + 2 * ZOCALO.MARGEN, h: c.h,
      textX: c.x + ZOCALO.MARGEN, baseline: Math.round(c.y + c.h / 2 + c.k * f)
    });
    return { nombre: caja(ZOCALO.caja1, anchos.nombre, fuentes.nombre), empresa: caja(ZOCALO.caja2, anchos.empresa, fuentes.empresa) };
  }

  // Tamaño de fuente para que un texto que mide `ancho` con `tamano` entre en `max`.
  function tamanoQueEntra(ancho, tamano, max) {
    return ancho <= max ? tamano : Math.floor(tamano * max / ancho);
  }

  function slug(texto) {
    const s = String(texto || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const corto = s.length > 40 ? s.slice(0, 40).replace(/-[^-]*$/, "") : s;
    return corto || "placa";
  }

  function nombreArchivo(formato, texto, fecha, ext) {
    const f = fecha.getFullYear() + String(fecha.getMonth() + 1).padStart(2, "0") + String(fecha.getDate()).padStart(2, "0");
    return `dru-${formato}-${slug(texto)}-${f}.${ext}`;
  }

  const api = { ZOCALO, easeOutCubic, easeInCubic, zocaloEstado, zocaloLayout, tamanoQueEntra, slug, nombreArchivo };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.GraficaCore = api;
})(this);
