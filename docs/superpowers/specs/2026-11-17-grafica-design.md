# Gráfica — Diseño (fase 1)

Fecha: 2026-11-17 · Estado: propuesta (a revisar con Lautaro)

## Objetivo
Que cualquier redactor genere desde el panel las placas de redes de DRU, ya con el sistema
gráfico vigente (el mismo de las plantillas de Express), sin abrir Express ni armar capas.
Entrada: foto + textos (o una nota pegada). Salida: PNG listo para publicar y, para el
zócalo de entrevistas, la animación con transparencia.

Fuera de alcance (fase 1): edición libre tipo Express, plantillas del carnaval 2027,
carruseles de varias placas, video completo de reels (solo overlays).

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
conectada con la sección Efemérides), clima, último momento (tag de urgencia), carrusel
(varias placas + "DESLIZÁ" + slide 4 CTA naranja según CLAUDE.md), kit 2027.

## Pruebas
- Exportar cada plantilla con titulares de 1, 2 y 3 líneas y con tildes/ñ; comparar contra
  las plantillas de Express (proyecto "Diario Rio Uruguay" → NUEVAS GRÁFICAS).
- Fotos verticales, horizontales y de baja resolución (avisar si es menor a 1080 px de ancho).
- WebM del zócalo: abrirlo sobre un video en Express/CapCut y verificar que la transparencia se respete.
- Chrome y Safari (en Safari solo PNG).
