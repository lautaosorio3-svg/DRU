// ══ DRU · Estética 2027 · movimiento ══
// Detalles tomados del backstage de L+: títulos que suben palabra por palabra,
// números que cuentan, puntos "en vivo", barra de carga de la IA y ticker de titulares.
// Se engancha desde afuera a lo que ya existe (showPage, fetch, las listas) sin tocar su lógica.
// Usa globales del script principal: showPage, DB, MESF.
(function () {
  const quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ── 1. Títulos: cada palabra en su máscara (la animación la hace el CSS al mostrar la página) ──
  function partirTitulo(h) {
    if (h.dataset.partido) return;
    h.dataset.partido = "1";
    let i = 0;
    const recorrer = (nodo) => {
      [...nodo.childNodes].forEach((n) => {
        if (n.nodeType === 1) return recorrer(n);
        if (n.nodeType !== 3 || !n.textContent.trim()) return;
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((p) => {
          if (!p) return;
          if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(p)); return; }
          const mascara = document.createElement("span");
          mascara.className = "t-palabra";
          const palabra = document.createElement("span");
          palabra.textContent = p;
          palabra.style.setProperty("--i", i++);
          mascara.appendChild(palabra);
          frag.appendChild(mascara);
        });
        n.replaceWith(frag);
      });
    };
    recorrer(h);
  }

  // ── 2. Números que cuentan hasta su valor ──
  const NUMEROS = ".stat-num, .meta-card-num";
  const escrito = new WeakMap();
  function contar(el) {
    if (quieto) return;
    const txt = el.textContent.trim();
    if (!/^\d{1,6}$/.test(txt) || +txt < 2) return;
    const fin = +txt, t0 = performance.now(), dur = 900;
    const paso = (t) => {
      if (el.textContent !== (escrito.get(el) ?? txt)) return; // el panel lo cambió: no pisar
      const p = Math.min((t - t0) / dur, 1);
      const v = p < 1 ? String(Math.round(fin * (1 - Math.pow(1 - p, 3)))) : txt;
      escrito.set(el, v);
      el.textContent = v;
      if (p < 1) requestAnimationFrame(paso);
    };
    escrito.set(el, txt);
    requestAnimationFrame(paso);
  }
  function contarEn(raiz) { raiz.querySelectorAll(NUMEROS).forEach(contar); }

  // ── 3. Puntos "en vivo" y bloque negro para lo caliente sin cubrir ──
  function marcarVivos(raiz) {
    raiz.querySelectorAll(".tag").forEach((t) => {
      if (t.dataset.vivo) return;
      const m = t.textContent.match(/^\s*(🔥|●)\s*(.+)$/u);
      if (!m) return;
      t.dataset.vivo = "1";
      t.innerHTML = '<span class="vivo"></span>';
      t.appendChild(document.createTextNode(m[2]));
    });
    raiz.querySelectorAll("#agenda-list > .step").forEach((card) => {
      if (/border-left/.test(card.getAttribute("style") || "")) card.classList.add("bloque-negro");
    });
  }

  // ── 4. Barra de carga mientras la IA trabaja ──
  const barra = document.createElement("div");
  barra.className = "carga-ia";
  barra.setAttribute("aria-hidden", "true");
  document.body.appendChild(barra);
  let enCurso = 0;
  const fetchOriginal = window.fetch.bind(window);
  window.fetch = function (recurso, ...resto) {
    const url = String((recurso && recurso.url) || recurso);
    const esIA = /\/\.netlify\/functions\/(ai|openai|transcribe)\b/.test(url);
    const p = fetchOriginal(recurso, ...resto);
    if (esIA) {
      enCurso++; barra.classList.add("activa");
      const fin = () => { enCurso = Math.max(0, enCurso - 1); if (!enCurso) barra.classList.remove("activa"); };
      p.then(fin, fin);
    }
    return p;
  };

  // ── 5. Ticker de titulares: Agenda ahora; si no hay datos, las efemérides de hoy ──
  const ticker = document.createElement("div");
  ticker.className = "ticker";
  ticker.hidden = true;
  ticker.innerHTML = '<div class="ticker-label"><span class="vivo"></span><span class="ticker-titulo">En agenda</span></div><div class="ticker-pista"><div class="ticker-cinta"></div></div>';
  const topbar = document.querySelector(".topbar");
  if (topbar) topbar.after(ticker);

  function pintarTicker(titulo, items) {
    if (!items.length) { ticker.hidden = true; return; }
    ticker.querySelector(".ticker-titulo").textContent = titulo;
    const html = items.map((x) => `<span class="ticker-item" data-destino="${x.destino}"><b>${esc(x.dato)}</b>${esc(x.texto)}</span>`).join("");
    const cinta = ticker.querySelector(".ticker-cinta");
    cinta.innerHTML = html + html;  // dos vueltas para que el loop no tenga corte
    cinta.style.setProperty("--dur", Math.max(30, items.length * 9) + "s");
    ticker.hidden = false;
  }
  ticker.addEventListener("click", (e) => {
    const it = e.target.closest(".ticker-item");
    if (!it) return;
    const destino = it.dataset.destino;
    const nav = [...document.querySelectorAll(".sb-item")].find((n) => (n.getAttribute("onclick") || "").includes(`'${destino}'`));
    showPage(destino, nav);
  });

  async function cargarTicker() {
    try {
      const res = await fetchOriginal("/.netlify/functions/agenda?horas=2");
      const data = await res.json();
      const temas = (data.temas || []).filter((t) => t.categoria !== "rutina" && t.medios_ventana >= 2).slice(0, 12);
      if (temas.length) {
        pintarTicker("En agenda", temas.map((t) => ({ dato: t.medios_ventana + " medios", texto: t.titulo, destino: "agenda" })));
        return;
      }
    } catch (e) { /* sin functions (local) o sin Supabase: se usan las efemérides */ }
    if (typeof DB === "undefined" || !DB.length) return;
    const hoy = new Date(), d = hoy.getDate(), m = hoy.getMonth() + 1;
    const efem = DB.filter((e) => e.d === d && e.m === m).slice(0, 12);
    pintarTicker("Hoy en la historia", efem.map((e) => ({ dato: String(e.y), texto: e.title, destino: "efem" })));
  }

  // ── Enganches ──
  function alMostrar(id) {
    const pagina = document.getElementById("page-" + id);
    if (!pagina) return;
    pagina.querySelectorAll(".hero-title").forEach(partirTitulo);
    contarEn(pagina);
    marcarVivos(pagina);
  }
  const showPageOriginal = window.showPage;
  window.showPage = function (id, nav) {
    const r = showPageOriginal.apply(this, arguments);
    alMostrar(id);
    return r;
  };

  // Listas que se redibujan (agenda, alertas) y números que el panel actualiza después
  const obs = new MutationObserver((cambios) => {
    for (const c of cambios) {
      const el = c.target.nodeType === 1 ? c.target : c.target.parentElement;
      if (!el) continue;
      if (el.matches && el.matches(NUMEROS) && el.textContent !== escrito.get(el)) contar(el);
      if (el.closest && el.closest("#agenda-list, #alertas-list")) marcarVivos(el.closest("#agenda-list, #alertas-list"));
    }
  });
  const app = document.getElementById("app") || document.body;
  obs.observe(app, { childList: true, subtree: true, characterData: true });

  document.querySelectorAll(".hero-title").forEach(partirTitulo);
  const activa = document.querySelector(".page.active");
  if (activa) alMostrar(activa.id.replace(/^page-/, ""));
  setTimeout(cargarTicker, 1500);            // después de que el panel cargó las efemérides
  setInterval(cargarTicker, 5 * 60 * 1000);   // se renueva cada 5 minutos
})();
