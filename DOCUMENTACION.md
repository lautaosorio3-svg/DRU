# DRU Editorial — Documentación del proyecto

**Panel editorial interno de Diario Río Uruguay** (Concordia, Entre Ríos).
Herramienta de redacción asistida por IA para el equipo: generación de contenido,
análisis SEO, transcripción de audio, métricas de redes y monitoreo de agenda regional.

*Última actualización: julio 2026.*

---

## 1. Arquitectura general

```
┌────────────────────────────────────────────────┐
│  index.html  (SPA vanilla JS, sin framework)   │
│  theme.css + screens.css                       │
│  · localStorage como almacenamiento local      │
└──────────────────┬─────────────────────────────┘
                   │ fetch()
┌──────────────────▼─────────────────────────────┐
│  Netlify Functions (/.netlify/functions/*)     │
│  · ai.js          → proxy Claude (Anthropic)   │
│  · openai.js      → proxy GPT (OpenAI)         │
│  · transcribe.js  → API key para Whisper       │
│  · meta-stats.js  → proxy Meta Graph API       │
│  · sugerencias.js → Netlify Blobs + Resend     │
│  · rss-trends.js  → lector de 9 feeds RSS      │
│  · rss-alertas.js → programada @hourly         │
│  · db.js          → proxy Supabase REST        │
└──────┬──────────┬──────────┬───────────────────┘
       ▼          ▼          ▼
   Anthropic   Meta Graph  Supabase (PostgreSQL)
   OpenAI      Resend      · borradores · alertas
                           · keywords · correcciones
```

**Principio de diseño**: el navegador nunca guarda API keys (con una excepción
problemática, ver ANALISIS.md). Todas las llaves viven en variables de entorno de
Netlify y las funciones actúan de proxy.

**Degradación elegante**: si Supabase o Meta no están configurados, el panel sigue
funcionando — cada feature detecta su configuración y muestra instrucciones o cae a
localStorage.

## 2. Secciones del panel

| # | Sección | Qué hace | IA |
|---|---------|----------|-----|
| 01 | Efemérides | Archivo de +1400 efemérides de Entre Ríos (efemerides.json), filtros, sugerencias del día | — |
| 02 | Generador IA | Genera carrusel/reel/nota SEO/placa desde una efeméride, con chat de corrección | Claude/GPT |
| 03 | Agregar | Alta manual de efemérides (localStorage `dru_efem_custom`) | — |
| 04 | SEO del día | Links a fuentes de tendencias + **tendencias regionales RSS** + búsqueda de ángulo entrerriano | Claude |
| 05 | Análisis de notas | Chequeo SEO local (score /100) + análisis IA profundo + generación de copy para redes | Claude/GPT |
| 06 | Desgrabador | Sube audio → Whisper transcribe → IA redacta nota + copy | Whisper + Claude/GPT |
| 07 | Enfoques | Reescribe una nota según los 8 enfoques del modelo Shishkin (News User Needs) | Claude/GPT |
| 08 | Estadísticas | Dashboard Meta (IG+FB) con pestañas General/Instagram/Facebook, período 7/28/90 días, gráficos y análisis IA | Claude/GPT |
| 09 | Alertas | Keywords vigiladas compartidas + alertas automáticas cada hora desde 9 medios regionales | — |
| 10 | Borradores | Borradores guardados desde cualquier sección; compartidos vía Supabase | — |
| 11 | Sugerencias | Feedback del equipo → Netlify Blobs + email vía Resend | — |

## 3. Fuentes RSS monitoreadas

Verificadas el 04/07/2026. Los sitios WordPress bloquean user-agents no-navegador,
por eso `rss-trends.js` manda un UA de Chrome.

| Medio | Ciudad | Formato |
|---|---|---|
| Diario Junio | Concordia | RSS 2.0 |
| 7Páginas | Concordia | RSS 2.0 |
| El Heraldo | Concordia | Atom (plataforma eleco) |
| La Calle | C. del Uruguay | RSS 2.0 |
| 03442 | C. del Uruguay | RSS 2.0 |
| El Día | Gualeguaychú | Atom (plataforma eleco) |
| Chajarí al Día | Chajarí | RSS 2.0 |
| Federación al Día | Federación | RSS 2.0 |
| Entre Ríos Ahora | Paraná | RSS 2.0 |

**Sin RSS** (requerirían scraping): El Once, Análisis Digital, UNO Entre Ríos,
APF Digital, R2820, Máxima Online, El Entre Ríos, Página Política, Tal Cual Chajarí.

### Flujo de alertas

1. `rss-alertas.js` corre cada hora (schedule en `netlify.toml`).
2. Lee los 9 feeds, normaliza los titulares (sin tildes, minúsculas).
3. Los compara contra la tabla `keywords` de Supabase.
4. Coincidencia → inserta en `alertas` (dedupe por `link`, así la misma nota no alerta dos veces).
5. Cada usuario ve el badge con alertas no vistas (visto se guarda por usuario en localStorage).

## 4. Variables de entorno (Netlify)

| Variable | Para qué | Función que la usa |
|---|---|---|
| `ANTHROPIC_API_KEY_drudigital` (o `ANTHROPIC_API_KEY`) | Claude | ai.js |
| `OPENAI_API_KEY` | GPT + Whisper | openai.js, transcribe.js |
| `META_ACCESS_TOKEN` | Page Access Token permanente de Meta | meta-stats.js |
| `META_FB_PAGE_ID` | ID de la página FB (509443015830351) | meta-stats.js |
| `META_IG_USER_ID` | ID de la cuenta IG (17841402060436487) | meta-stats.js |
| `RESEND_API_KEY` | Emails de sugerencias | sugerencias.js |
| `SUPABASE_URL` | URL del proyecto Supabase | db.js, rss-trends.js, rss-alertas.js |
| `SUPABASE_SERVICE_KEY` | Llave service_role (secreta) | db.js, rss-trends.js, rss-alertas.js |
| `SITE_ID` / `NETLIFY_PAT` | Netlify Blobs (opcional) | sugerencias.js |

## 5. Almacenamiento

### localStorage (por navegador)

| Key | Contenido |
|---|---|
| `dru_session` | Sesión de login (expira a las 4 hs) |
| `dru_theme` | light / dark |
| `dru_efem_custom` | Efemérides agregadas a mano |
| `dru_borradores` | Borradores (espejo local de Supabase) |
| `dru_corrections` | Últimas 20 correcciones de estilo para prompts |
| `dru_sugerencias` | Copia local de sugerencias |
| `dru_alertas_vistas` | IDs de alertas ya vistas por este usuario |

### Supabase (compartido, opcional)

Tablas: `borradores`, `correcciones`, `keywords`, `alertas`.
Esquema completo y guía de setup en **SUPABASE_SETUP.md**.
Estrategia de sync: dual-write (localStorage siempre + push a Supabase si está
configurado) y merge al iniciar sesión (`syncFromDB()`).

### Netlify Blobs

Solo `sugerencias` (store "sugerencias", key "all"). Anterior a Supabase; funciona y
no se migró para no romper nada.

## 6. Modelos de IA

- **Claude**: `claude-haiku-4-5-20251001` (default, rápido y barato).
- **GPT**: `gpt-4o-mini` vía openai.js, que **normaliza la respuesta al formato de
  Anthropic** (`{content:[{type:"text",text}]}`) — el frontend parsea igual para ambos.
- Whisper: `whisper-1`, el navegador llama directo a OpenAI (límite 6MB de body en
  functions), con la key que le da transcribe.js.

## 7. Convenciones del código

- Un solo archivo `index.html` (~2100 líneas): HTML de las 11 páginas + un `<script>` al final.
- Navegación por `showPage(id, navEl)` — muestra `.page` y marca `.sb-item` activo.
  ⚠️ `loadDraft()` y otros usan índices posicionales de `.sb-item` — si agregás un ítem
  al sidebar, revisá esos índices.
- Los prompts de IA incorporan los criterios editoriales DRU (CLAUDE.md) y el contexto
  de correcciones (`getCorrectionsContext()`). Las correcciones NO se guardan solas:
  el redactor marca "☆ Recordar regla" en el chat y solo eso se comparte como
  preferencia de estilo del equipo (tabla `correcciones` de Supabase + localStorage).
- CSS: `theme.css` (variables, light/dark) + `screens.css` (componentes). Prefijos:
  `.meta-*` (dashboard Meta), `.mc` (magazine cards), `.sb-*` (sidebar), `.fi/.flbl` (forms).

## 8. Deploy

- **Hosting**: Netlify, deploy automático al pushear a `main` de GitHub (`lautaosorio3-svg/DRU`).
- ⚠️ Los créditos de build de Netlify son limitados: **agrupar cambios en un solo push**.
- Preview local: `npx serve -l 3001 -s .` (las functions NO corren localmente; para
  probarlas se necesita `npx netlify dev`, que sí las levanta).

## 9. Usuarios

Definidos en `USERS` dentro de index.html (login client-side — ver debilidad en
ANALISIS.md): more, mati, laura, horacio, mateo, lautaro.
