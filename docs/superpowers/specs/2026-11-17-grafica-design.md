# Gráfica — Diseño (fase 1)

Fecha: 2026-11-17 · Estado: propuesta (a revisar con Lautaro)

## Objetivo
Que cualquier redactor genere desde el panel las placas de redes de DRU, ya con el sistema
gráfico vigente (el mismo de las plantillas de Express), sin abrir Express ni armar capas.
Entrada: foto + textos (o una nota pegada). Salida: PNG listo para publicar y, para el
zócalo de entrevistas, la animación con transparencia.

Fuera de alcance (fase 1): edición libre tipo Express, plantillas del carnaval 2027,
video completo de reels (solo overlays).

## Principio técnico
Todo se dibuja **en el navegador con `<canvas>`**. No hacen falta functions nuevas, ni
Supabase, ni otro build más allá del push de la sección (los créditos de Netlify son
limitados: un solo push).
- Fuentes: Barlow y Barlow Condensed (Google Fonts, ya se cargan en el panel). Antes de
  dibujar: `await document.fonts.load('900 72px "Barlow Condensed"')` y equivalentes.
- Logo: `assets/logo-dru.png` (hay que sumar la versión crema si hace falta sobre oscuro).
- Export: `canvas.toBlob('image/png')` y descarga con nombre `dru-<formato>-<slug>-<AAAAMMDD>.png`.

## Sección nueva — "14 · Gráfica"
Ítem en el menú lateral. ⚠️ `loadDraft()` y otros usan índices posicionales de `.sb-item`:
revisarlos al agregar el ítem (ver DOCUMENTACION.md §7).

Pantalla en dos columnas: a la izquierda el formulario, a la derecha la vista previa en vivo
(canvas escalado). Selector de plantilla arriba.

### Campos comunes
- **Foto**: subir archivo; arrastrar para reencuadrar y slider de zoom (cover por defecto).
- **Volanta** (máx. 30 caracteres).
- **Titular** (máx. 3 líneas; el tamaño baja solo si no entra). Las palabras entre
  `*asteriscos*` van en naranja, como en Express.
- Botón **"Sugerir con IA"**: pegar la nota → `ai.js` (Haiku) devuelve volanta + titular con
  los criterios editoriales de CLAUDE.md, sin clickbait y respetando citas. El redactor edita
  antes de exportar.
- Atajo desde **Desgrabador**, **Gacetilla a nota** y **Traspaso a redes**: botón "Hacer placa"
  que abre Gráfica con volanta y titular precargados.

## Integración con "Formato para redes" (decidido 2026-11-17)
El texto de cada pieza se sigue escribiendo donde se escribe hoy (paso 5 de **Análisis de
notas** y **Generador IA** de Efemérides). Gráfica hace la imagen. No se duplica el selector
de formatos en Diseño: se conectan.

| Formato | Lo que ya escribe la IA | Plantilla en Gráfica |
|---|---|---|
| Placa + Copy | título de placa, subtítulo, caption | Posteo noticia 1080×1350 |
| Carrusel | slides 1 a 4 (4 = CTA fondo naranja), caption | Carrusel (sube a fase 1) |
| Guión Reel | gancho, textos en pantalla | Overlay de reel + zócalo por cada persona |

- **Nota SEO queda aparte**: es para la web, no para redes. En los dos módulos el selector
  se divide en "Para redes" (los tres formatos de arriba) y "Para la web" (Nota SEO, con su
  propio botón y sin paso por Gráfica).
- En cada resultado de redes aparece **"Diseñar →"**: abre Gráfica con la plantilla del
  formato y los textos cargados; falta solo la foto. El caption queda junto a la vista previa
  para copiarlo, así todo lo necesario para publicar sale de un mismo lugar.
- **Respuesta estructurada**: los tres prompts de redes pasan de texto libre ("SLIDE 1: …")
  a tool use forzado con schema (misma técnica que el agrupado de Agenda ahora), para que
  cada campo llegue a la plantilla sin depender del formato del texto.

### 5. Carrusel — 1080×1350, 4 placas
- Slides 1 a 3 con el sistema del posteo noticia (foto opcional en la 1); máx. 12 palabras
  por slide; "DESLIZÁ" en las slides 1 a 3.
- Slide 4: CTA "Leé la nota completa en diarioriouruguay.com" sobre fondo naranja.
- Export: las 4 placas en PNG, numeradas (`dru-carrusel-<slug>-<AAAAMMDD>-1.png` … `-4.png`).

## Plantillas fase 1 (medidas en px sobre el lienzo real)
Paleta: naranja DRU `#F7941D`, negro `#121212`, blanco. Márgenes laterales: 60.

### 1. Posteo noticia — 1080×1350
- Logo DRU arriba a la izquierda (x 60, y 60, ancho 330).
- Degradado negro inferior (de 0 a 85 % de opacidad, desde y 650 hasta abajo).
- Volanta: Barlow Condensed Bold 32, naranja, mayúsculas.
- Titular: Barlow Condensed Black 72, blanco, mayúsculas, interlineado 1,0; destacados en naranja.
- Rayita naranja de cierre: 60×6 debajo del titular.
- Opcional: **foto circular** (diámetro 340, aro naranja de 8) arriba a la derecha.

### 2. Historia — 1080×1920
- Zonas seguras de Instagram: 250 libres arriba y 340 abajo.
- Logo a la izquierda y fecha a la derecha (`17•11•2026`, Barlow Condensed Bold 34, blanco).
- Degradado arriba (para el logo) y abajo.
- Etiqueta: caja naranja con texto negro (Barlow Condensed Bold 30, mayúsculas, márgenes 16/8).
- Titular igual que el posteo (Black 76) y debajo "LEÉ LA NOTA ↗" (Barlow Condensed Bold 30).

### 3. Reel — overlay 1080×1920 (PNG transparente)
- Logo chico arriba a la izquierda (ancho 260).
- Bloque abajo a la izquierda, dentro de la zona segura: barra vertical naranja de 8 de ancho
  a la izquierda de la volanta y el titular (Black 64).
- Degradado inferior incluido en el PNG, para ponerlo sobre el video en Express o CapCut.

### 4. Zócalo de entrevistas — 1080×1920 (sección empresarios)
- Caja 1: naranja, alto 66, en x 60 · y 1280. Nombre en Barlow Condensed Bold 50, negro, mayúsculas.
- Caja 2: negra, alto 48, en x 60 · y 1356. Empresa · cargo en Barlow SemiBold 30, blanco.
- Margen interno de 18 a cada lado; el ancho de cada caja sigue al texto.
- Animación (igual a la entregada el 17/11): cada caja entra deslizando desde −140 px con
  fundido, en 0,5 s con *ease-out* cúbico; la empresa arranca 0,3 s después. Quedan quietas y
  salen hacia la izquierda en 0,4 s (*ease-in*): la empresa a los 2,8 s y el nombre a los 2,9 s.
  Duración total 4,5 s, 30 fps.
- Export: **PNG** del cuadro fijo y **WebM VP9 con alfa** de la animación
  (`canvas.captureStream(30)` + `MediaRecorder` con `video/webm;codecs=vp9`). Funciona en
  Chrome; Safari no graba alfa, así que hay que avisarlo en pantalla. Si los editores
  necesitan `.mov` ProRes, va a fase 2 (ffmpeg.wasm).

## Fase 2 (ideas, no comprometidas)
Declaración (comilla + cita + atribución), efeméride (panel crema + fecha en serif itálica,
conectada con la sección Efemérides), clima, último momento (tag de urgencia), kit 2027.

## Pruebas
- Exportar cada plantilla con titulares de 1, 2 y 3 líneas y con tildes/ñ; comparar contra
  las plantillas de Express (proyecto "Diario Rio Uruguay" → NUEVAS GRÁFICAS).
- Fotos verticales, horizontales y de baja resolución (avisar si es menor a 1080 px de ancho).
- WebM del zócalo: abrirlo sobre un video en Express/CapCut y verificar que la transparencia se respete.
- Chrome y Safari (en Safari solo PNG).
