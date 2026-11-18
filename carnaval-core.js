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
    nombres: { familia: "manometer-sans", peso: 400, tamano: 67.7 },
    puestos: { familia: "acumin-pro-extra-condensed", peso: 800, tamano: 51.5 }
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

  // El río: las franjas ondulan como agua. Entran con una ola marcada que se calma
  // hasta un oleaje sutil y siguen así todo el video.
  const RIO = { amplitudEntrada: 14, amplitudOleaje: 3, longitud: 720, periodo: 3.2 };
  function ondaRio(x, t) {
    const calma = Math.min(Math.max((t - 0.1) / (DURACION_ENTRADA - 0.1), 0), 1);
    const amp = RIO.amplitudEntrada + (RIO.amplitudOleaje - RIO.amplitudEntrada) * easeOut(calma);
    return amp * Math.sin((2 * Math.PI * x) / RIO.longitud - (2 * Math.PI * t) / RIO.periodo);
  }

  function nombreArchivo(comparsaId, n1, n2, fecha) {
    const nombres = [limpio(n1), limpio(n2)].filter(Boolean).join(" y ");
    const f = fecha.getFullYear() + String(fecha.getMonth() + 1).padStart(2, "0") + String(fecha.getDate()).padStart(2, "0");
    return `dru-carnaval-${comparsaId}-${G.slug(nombres)}-${f}.mp4`;
  }

  const api = { LIENZO, COLOR, COMPARSAS, comparsa, FUENTE, medidas, lineasListon, textoPuesto, estadoAnim, DURACION_ENTRADA, RIO, ondaRio, nombreArchivo, tamanoQueEntra: G.tamanoQueEntra };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.CarnavalCore = api;
})(this);
