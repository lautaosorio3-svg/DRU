# Cómo configurar Supabase — guía paso a paso

**Tiempo estimado: 15 minutos · Costo: $0 (tier gratuito)**

## ¿Qué es Supabase y por qué lo usamos?

Supabase es una base de datos PostgreSQL en la nube con una interfaz visual amigable.
Pensalo así: hasta ahora, cada computadora del equipo guardaba sus propios borradores
y correcciones en el navegador (localStorage). Es como si cada redactor tuviera su
propio cuaderno que nadie más puede leer.

Supabase es **el cuaderno compartido del equipo**: lo que guarda uno, lo ven todos.
Con esto conseguimos:

- **Alertas para todos**: el sistema revisa los medios de la región cada hora y si un
  titular menciona una keyword vigilada, la alerta le aparece a todo el equipo.
- **Borradores compartidos**: guardás un borrador en tu computadora y Mati lo ve en la suya.
- **Correcciones compartidas**: la IA aprende del estilo de todo el equipo, no solo del tuyo.

### ¿Cómo se conecta con lo que ya tenemos?

```
Navegador (panel DRU)
   │  nunca habla directo con Supabase
   ▼
Netlify Functions (db.js, rss-trends.js, rss-alertas.js)
   │  acá vive la llave secreta
   ▼
Supabase (base de datos compartida)
```

El navegador **nunca** toca Supabase directamente. Todo pasa por las funciones de
Netlify, que guardan la llave secreta. Esto es importante: si la llave estuviera en el
navegador, cualquiera que mire el código fuente podría leer y borrar toda la base.

---

## Paso 1 — Crear la cuenta y el proyecto

1. Entrá a **https://supabase.com** y hacé clic en **"Start your project"**.
2. Registrate con tu cuenta de GitHub (la misma que usás para el repo DRU) o con email.
3. Una vez adentro, clic en **"New project"**.
4. Completá:
   - **Name**: `dru-editorial`
   - **Database Password**: generá una contraseña fuerte con el botón y **guardala**
     (no la vas a necesitar para el panel, pero sí si algún día querés conectarte directo).
   - **Region**: elegí **South America (São Paulo)** — es la más cercana, menos latencia.
5. Clic en **"Create new project"** y esperá 1-2 minutos mientras se crea.

## Paso 2 — Crear las tablas

Una "tabla" es como una planilla de Excel: filas y columnas. Vamos a crear 4.

1. En el menú lateral izquierdo de Supabase, clic en **SQL Editor** (ícono de terminal).
2. Clic en **"New query"**.
3. Pegá TODO este bloque y clic en **"Run"** (o Ctrl+Enter):

```sql
-- Borradores compartidos del equipo
create table borradores (
  id bigint primary key generated always as identity,
  client_id bigint unique,          -- id que genera el navegador (para sincronizar)
  seccion text not null,            -- gen / traspaso / desgrab / enfoques / metastats
  etiqueta text,
  titulo text not null,
  formato text,
  contenido text not null,
  autor text,
  creado timestamptz default now()
);

-- Correcciones de estilo (la IA las usa como contexto)
create table correcciones (
  id bigint primary key generated always as identity,
  texto text not null,
  autor text,
  creado timestamptz default now()
);

-- Keywords vigiladas para las alertas RSS
create table keywords (
  id bigint primary key generated always as identity,
  palabra text not null unique,
  autor text,
  creado timestamptz default now()
);

-- Alertas generadas cuando un titular matchea una keyword
create table alertas (
  id bigint primary key generated always as identity,
  titulo text not null,
  link text unique,                 -- evita alertas duplicadas de la misma nota
  fuente text,
  ciudad text,
  keyword text,
  publicado timestamptz,
  creado timestamptz default now()
);

-- Seguridad: bloquear acceso anónimo directo.
-- Nuestras funciones de Netlify usan la llave "service_role" que puentea esto.
alter table borradores enable row level security;
alter table correcciones enable row level security;
alter table keywords enable row level security;
alter table alertas enable row level security;
```

4. Tiene que decir **"Success. No rows returned"**. Si ves las 4 tablas en
   **Table Editor** (menú lateral), está perfecto.

> **¿Qué es eso de "row level security"?** Supabase tiene dos llaves: una pública
> (`anon`) y una secreta (`service_role`). Con RLS activado y sin reglas, la llave
> pública no puede leer nada — solo la secreta accede. Como nuestra llave secreta vive
> únicamente en Netlify, nadie puede tocar los datos desde afuera.

## Paso 3 — Copiar las credenciales

1. En Supabase, menú lateral → **Project Settings** (engranaje) → **API**.
2. Copiá dos cosas:
   - **Project URL** — algo como `https://abcdefghijk.supabase.co`
   - **service_role key** (en la sección "Project API keys", clic en "Reveal" para verla).
     Es un texto largo que empieza con `eyJ...`

⚠️ **La service_role key es LA llave maestra.** No la pegues en ningún chat, no la
subas al repo, no la compartas. Solo va en las variables de entorno de Netlify.

## Paso 4 — Cargar las variables en Netlify

1. Entrá a **https://app.netlify.com** → tu sitio DRU → **Site configuration** →
   **Environment variables**.
2. Agregá estas dos variables:

| Key | Value |
|---|---|
| `SUPABASE_URL` | la Project URL del paso 3 |
| `SUPABASE_SERVICE_KEY` | la service_role key del paso 3 |

3. **Trigger deploy**: Deploys → "Trigger deploy" → "Deploy site"
   (las variables nuevas solo se aplican con un deploy).

## Paso 5 — Probar que funciona

1. Abrí el panel DRU → sección **Alertas** (menú lateral, 09).
2. Si ves el formulario de keywords en vez del cartel "Supabase no configurado", está conectado. ✅
3. Agregá una keyword de prueba, por ejemplo `Concordia`.
4. Clic en **"Revisar medios ahora"** — debería encontrar coincidencias en segundos
   (Concordia aparece seguido en los titulares de la región).
5. Las alertas que veas vos, las van a ver todos los que entren al panel. Eso es Supabase funcionando.

A partir de ahí, el sistema revisa solo cada hora (función programada de Netlify) —
nadie tiene que tener el panel abierto.

---

## Preguntas frecuentes

**¿Cuánto aguanta el tier gratuito?**
500 MB de base de datos y 5 GB de transferencia por mes. Para texto puro (borradores,
alertas, keywords) eso son años de uso del equipo. No hay tarjeta de crédito involucrada.

**¿Qué pasa si Supabase se cae o borramos las variables?**
Nada grave: el panel detecta que no está configurado y vuelve a funcionar con
localStorage como siempre. Las alertas compartidas dejan de generarse, el resto sigue.

**¿Puedo ver los datos directamente?**
Sí — en Supabase, **Table Editor** te muestra las tablas como planillas. Podés editar,
borrar o exportar a CSV desde ahí. Es tu panel de administración de datos.

**¿Y si quiero borrar todas las alertas viejas?**
SQL Editor → `delete from alertas where creado < now() - interval '30 days';` → Run.
