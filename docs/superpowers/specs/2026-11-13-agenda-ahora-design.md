# Agenda ahora — Diseño (fase 1)

Fecha: 2026-11-13 · Estado: aprobado

## Objetivo
Detectar en casi tiempo real (retraso ~15 min) qué temas está levantando la prensa entrerriana,
cuántos medios lo cubren y si DRU ya lo publicó, para no llegar tarde a la agenda.
Señal principal: **velocidad de cobertura** (medios distintos en las últimas 2 h), no interacciones.

Fuera de alcance (fase 1): interacciones de Facebook, medios que solo publican en redes,
generación automática de notas completas (con solo titulares la IA inventaría datos).

## Fuentes (18)
- 9 RSS existentes de `rss-trends.js` (Diario Junio, 7Páginas, El Heraldo, La Calle, 03442, El Día, Chajarí al Día, Federación al Día, Entre Ríos Ahora).
- Sitemaps Google News: El Once (`elonce.com/sitemap-news.xml`), Análisis (`analisisdigital.com.ar/news-sitemap.xml`), UNO (`unoentrerios.com.ar/sitemap-news.xml`), Máxima Online (`maximaonline.com.ar/sitemap-news.xml`), El Entre Ríos (`elentrerios.com/sitemap-news.xml`).
- RSS nuevos: El Argentino (Gualeguaychú), El Diario (Paraná), Concordia Hoy.
- DRU propio: `diarioriouruguay.com/sitemap-news.xml` (marca `es_dru`).

## Datos (Supabase)
```sql
create table agenda_temas (
  id bigint primary key generated always as identity,
  titulo text not null,
  categoria text not null,
  primer_visto timestamptz not null,
  ultimo_visto timestamptz not null,
  aviso_enviado boolean default false,
  creado timestamptz default now()
);
create table agenda_titulares (
  id bigint primary key generated always as identity,
  link text unique not null,
  titulo text not null,
  fuente text not null,
  ciudad text,
  publicado timestamptz not null,
  es_dru boolean default false,
  tema_id bigint references agenda_temas(id) on delete set null,
  creado timestamptz default now()
);
create index on agenda_titulares (publicado);
create index on agenda_titulares (tema_id);
alter table agenda_temas enable row level security;
alter table agenda_titulares enable row level security;
```
Conteos (medios en 2 h, total, cobertura DRU) se calculan al leer, nunca se guardan.
Categorías fijas: política, economía, policiales, judiciales, salud, educación, clima y servicios, sociedad, deportes, cultura, rutina.

## Recolector — `netlify/functions/agenda-recolector.js` (schedule `*/15 * * * *`)
1. Lee las 18 fuentes en paralelo (timeout 8 s c/u, UA de navegador). Reutiliza `parseFeed` de `rss-trends.js`; agrega parser de sitemap News (`news:title`, `news:publication_date`). Fuente caída → se loguea y se saltea.
2. Filtra últimas 24 h y descarta `link` ya guardados; inserta los nuevos (`tema_id` null).
3. Toma titulares sin tema de las últimas 24 h (máx 60) + temas activos de 24 h (id, título, categoría) y llama a Haiku una vez. Respuesta JSON: asignación titular→tema existente o tema nuevo (con título y categoría). Inserta temas nuevos, actualiza `tema_id` y `ultimo_visto`. Si Haiku falla, quedan sin tema y se reintentan en la próxima corrida.
4. Avisos: tema con ≥3 fuentes distintas no-DRU en 2 h, sin titular DRU y `aviso_enviado=false` → `aviso_enviado=true`.
5. Borra titulares con `publicado` > 7 días y temas sin titulares.
- Presupuesto: < 30 s (límite de scheduled functions). Invocable a mano vía HTTP para el botón "Actualizar ahora".
- Llama a Anthropic directo (no vía `ai.js`), modelo Haiku, sin thinking.

## Lectura — `netlify/functions/agenda.js`, `GET ?horas=2|24`
`POST {action:"run"}` fuerza una corrida (las scheduled functions no son invocables por URL en producción).
Devuelve temas con titulares de las últimas 24 h, con: `medios_ventana`, `medios_total`, `cubierto_dru`, `caliente` (≥3 en 2 h), `primer_visto`, primera fuente y lista de titulares. Agregación en JS.

## Pantalla — sección "Agenda ahora"
- Ítem en el menú lateral con badge = temas calientes sin cubrir (mismo mecanismo que Alertas, refresca en `syncFromDB`).
- Tarjetas ordenadas por medios en la ventana: título, categoría, 🔥, medios 2 h / total, "primer titular hace X min (fuente)", "DRU ✓ cubierto" / "Sin cubrir", titulares desplegables con links.
- Filtros por categoría (rutina oculta por defecto) y ventana 2 h / 24 h.
- Acciones: "Buscar ángulo DRU" (envía a SEO del día, como las alertas) y "Guardar en borradores".
- Auto-refresh cada 2 min con la sección abierta. Botón "Actualizar ahora".
- Si Supabase no está configurado o faltan tablas: mensaje con instrucciones (degradación elegante, como Alertas).

## Pruebas
- Correr el recolector a mano y verificar filas en Supabase.
- `curl` a `db?action=agenda` en el sitio en vivo.
- Revisar la pantalla en el navegador (filtros, badge, acciones).
