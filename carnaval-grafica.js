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
