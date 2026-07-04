# DRU Editorial — Análisis técnico

Auditoría del código realizada en julio 2026. Ordenado por gravedad.
Cada ítem indica el archivo afectado y el fix recomendado.

---

## 🔴 Críticos (resolver cuanto antes)

### 1. La API key de OpenAI se entrega a cualquiera
**Archivo**: `netlify/functions/transcribe.js`
Cualquier persona que haga `GET /.netlify/functions/transcribe` recibe la key de
OpenAI en texto plano. No hace falta estar logueado ni conocer el panel. Con esa key
pueden usar GPT-4/Whisper a costa de la cuenta de DRU hasta agotar el crédito.

Existe porque Whisper necesita subir audios de hasta 15MB y las functions de Netlify
tienen límite de 6MB de body, entonces el navegador llama directo a OpenAI.

**Fix recomendado (en orden de esfuerzo):**
1. *Ya mismo*: poner un límite de gasto mensual bajo en platform.openai.com
   (Settings → Limits) — acota el daño a X dólares.
2. *Corto plazo*: crear una key separada solo para Whisper con límite propio, y rotar
   la actual (que quedó expuesta desde el deploy).
3. *Fix real*: usar la API de OpenAI con archivos por URL o comprimir el audio en el
   navegador (webm/opus a ~5MB) y proxear por la función como el resto.

### 2. Las funciones de IA no tienen autenticación
**Archivos**: `ai.js`, `openai.js`
Cualquiera que descubra `https://<sitio>.netlify.app/.netlify/functions/ai` puede usar
Claude gratis a costa de DRU (y lo mismo con GPT). Además `Access-Control-Allow-Origin: *`
permite que cualquier sitio web haga estas llamadas desde el navegador de sus visitantes.

**Fix recomendado:**
1. Cambiar CORS de `*` al dominio real del panel — frena el abuso desde otros sitios.
2. Poner límites de gasto en Anthropic y OpenAI.
3. *Fix real*: autenticación de verdad (ver punto 3) y validar un token de sesión en
   cada función.

### 3. El login es decorativo
**Archivo**: `index.html` (objeto `USERS`)
Los seis usuarios comparten la contraseña `dru2026` y está **escrita en el código
fuente** que cualquiera puede ver con clic derecho → "Ver código fuente". La sesión es
un JSON en localStorage que se puede fabricar a mano.

Esto era aceptable como maqueta; con datos compartidos (Supabase) y APIs pagas detrás,
conviene subir el nivel.

**Fix recomendado**: Supabase Auth (ya vamos a tener Supabase). Da login real con
email/contraseña, sesiones con JWT verificables en las functions, y es gratis. Es un
cambio mediano (~1 día de trabajo) pero resuelve los puntos 2 y 3 juntos.

### 4. Datos del medio expuestos públicamente
**Archivos**: `meta-stats.js`, `sugerencias.js`, `db.js`
- `meta-stats` devuelve las métricas de IG/FB del diario a cualquiera que la llame.
- `sugerencias` permite a cualquiera **borrar todas las sugerencias** (DELETE sin auth)
  o disparar emails vía Resend (spam con costo).
- `db.js` (nuevo) hereda el mismo problema: sin auth, cualquiera que conozca la URL
  puede leer/escribir borradores, keywords y alertas.

**Fix**: mismo que el punto 3 — un login real cierra todo esto de una vez. Mientras
tanto, el riesgo práctico es bajo (hay que conocer las URLs) pero real.

---

## 🟡 Medios (conviene arreglar, no urgen)

### 5. Escapado de HTML inconsistente (XSS potencial)
**Archivo**: `index.html`
El contenido dinámico (respuestas de IA, titulares RSS, sugerencias) se inserta con
`innerHTML` escapando solo `<`. En `renderSugerencias()` el campo `name` no se escapa.
En `renderAngleResult()` los botones "Copiar" interpolan texto de la IA dentro de
`onclick='...'` escapando solo comillas simples — un salto de línea en `fb_copy` rompe
el botón (bug funcional, no solo de seguridad).

**Fix**: función helper `esc(s)` que escape `& < > " '` y usarla en todos los template
literals; para los botones de copiar, guardar el texto en un array global e interpolar
solo el índice.

### 6. Índices posicionales del sidebar
**Archivo**: `index.html` (`loadDraft`, `goGen`, `quickGen`, `usarAlertaEnSEO`)
La navegación usa `document.querySelectorAll(".sb-item")[4]` con índices a mano.
Cada vez que se agrega un ítem al menú hay que auditar esos números (ya pasó con
Alertas). **Fix**: darle `id` o `data-page` a cada ítem del sidebar y buscar por eso.

### 7. Llamadas a Meta API en cada login
**Archivo**: `index.html` (`initApp`)
`loadMetaStats()` corre al iniciar sesión aunque el usuario no mire Estadísticas.
Son ~15 requests a Meta (per-post insights) por login de cada usuario. Meta tiene
rate limits por app. **Fix**: cargar solo al entrar a la página (ya existe el hook en
`showPage`) y cachear el resultado 10-15 minutos.

### 8. `efemerides.json` pesa 850 KB
Se descarga entero al iniciar sesión. En conexiones lentas retrasa el arranque.
**Fix eventual**: dividir por mes (12 archivos de ~70KB) y cargar el mes actual +
lazy-load del resto, o moverlo a Supabase con paginación.

### 9. Un solo archivo de 2.100 líneas
`index.html` mezcla las 11 páginas y todo el JS. Funciona, pero cada cambio arriesga
romper otra sección y dos personas no pueden trabajar en paralelo. **Fix eventual**:
extraer el JS a `app.js` (mejora además el cacheo del navegador) y separar por módulos.

### 10. Restos y housekeeping
- `server.js` es un servidor local legado que ya no se usa (las functions lo
  reemplazaron) — borrar o documentar.
- `parse_efem.py` es el script que generó `efemerides.json` — moverlo a una carpeta
  `tools/` con un README de una línea.
- El token de GitHub está embebido en la URL del remote local (`git config`) — funciona,
  pero conviene migrar a SSH o a credential helper para que no quede en texto plano.
- `.DS_Store` está trackeado en git — agregar a `.gitignore`.

---

## 🟢 Fortalezas (para mantener)

- **Proxy pattern correcto**: las API keys (salvo transcribe) nunca llegan al navegador.
- **Degradación elegante**: cada integración (Meta, Supabase, Blobs, Resend) detecta si
  está configurada y el panel sigue funcionando sin ella.
- **Normalización de modelos**: openai.js traduce la respuesta de GPT al formato de
  Anthropic — un solo parser en el frontend para ambos modelos.
- **Sin dependencias de frontend**: cero npm en el navegador = cero vulnerabilidades de
  supply chain, carga rápida, sin builds.
- **Criterios editoriales centralizados**: los prompts comparten el código editorial DRU
  y aprenden de las correcciones del equipo.
- **Dedupe de alertas por link**: la misma nota nunca alerta dos veces aunque el
  chequeo corra cada hora.

---

## Hoja de ruta sugerida

| Prioridad | Acción | Esfuerzo | Estado |
|---|---|---|---|
| 1 | Límites de gasto en OpenAI y Anthropic (hoy mismo, sin código) | 10 min | ⏳ manual del usuario |
| 2 | Rotar la key de OpenAI expuesta | 15 min | ⏳ manual del usuario |
| 3 | CORS restrictivo (dominio propio en vez de `*`) en todas las funciones | 30 min | ✅ hecho (jul 2026) |
| 4 | Configurar Supabase (SUPABASE_SETUP.md) y activar alertas | 15 min | ✅ hecho |
| 5 | Supabase Auth: login real + validación de sesión en functions | 1 día | ⏸ pospuesto (equipo optó por contraseña compartida) |
| 6 | Helper `esc()` para todo el HTML dinámico | 2-3 hs | ✅ hecho |
| 7 | Fix transcribe.js (audio comprimido por proxy) | medio día | ⏸ pendiente (mitigado con límites de gasto + rotación de key) |
| 8 | Extraer JS a app.js + sidebar por data-page | medio día | ⏸ pendiente |
| 9 | Cache de meta-stats y RSS (10-15 min) para cuidar rate limits | 2 hs | ✅ hecho (cache 15 min en navegador) |
| 10 | Migrar sugerencias de Blobs a Supabase (unificar almacenamiento) | 2 hs | ✅ hecho (requiere crear tabla `sugerencias`) |

### Ejecutado en julio 2026
- **CORS restrictivo**: todas las funciones usan `process.env.URL` (dominio del sitio) en vez de `*`.
- **esc()**: helper anti-XSS aplicado a sugerencias, keywords, titulares RSS, alertas, resultado de ángulo SEO e historial. Arreglado el bug de los botones "Copiar" (se rompían con saltos de línea) usando un store global en vez de interpolar texto en `onclick`.
- **Cache 15 min** de meta-stats (por período) y titulares RSS en `localStorage` — el botón "Actualizar datos" fuerza refresco.
- **Sugerencias → Supabase**: tabla `sugerencias` en el allowlist de `db.js`; el frontend lee/escribe de Supabase con fallback a localStorage y sigue enviando el email vía `sugerencias.js`.
- **Housekeeping**: `server.js` eliminado, `parse_efem.py` movido a `tools/`, `.DS_Store` fuera del tracking.

Pendiente del usuario para completar #10: correr en Supabase (SQL Editor) el `create table sugerencias` que figura al final de SUPABASE_SETUP.md.
