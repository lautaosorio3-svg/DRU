# Carnaval · gráfica sobre video — Diseño

Fecha: 2026-11-18 · Estado: a revisar con Lautaro

## Objetivo
En la noche del Carnaval de Concordia 2027, quien está en el corsódromo con la notebook
(MacBook Pro M1) baja el clip de la cámara (Sony ZV-E10, 15–30 s, vertical 4K), elige la
figura del plantel y en un paso obtiene el reel con la gráfica de cobertura de
*El Alma de la Fiesta*, listo para subir a redes, sin perder calidad.

Fuera de alcance (esta fase): corrección de color / LUT (se va a definir aparte y se sumará
como LUT exportada), edición o cortes del clip, subida directa a redes, clips horizontales
(se aceptan, ver "Entrada", pero sin reencuadre manual).

## Decisiones tomadas
- **Todo en el navegador de la notebook** (camino A). El video no sale de la compu: no hay
  que subir gigas con la conexión del corsódromo y no hay servidor que mantener.
- **Plantel precargado** antes del carnaval; en la noche se elige y se corrige si hace falta.
- **Auspiciante**: biblioteca de logos; en cada video se elige uno o "ninguno" (queda
  marcado el último usado). Cubre cualquier esquema comercial que se defina después.
- **La gráfica entra animada en el primer segundo y queda** todo el video.
- **Salida 1080×1920** H.264 de alto bitrate (lo que muestran Instagram y TikTok).

## Lo que mostró el clip de prueba (`GRAFICA 2027 Y CARNAVAL/log.mp4`)
- H.264 Main 8 bits 4:2:0, 2160×3840 ya vertical, 23,976 fps, 18 Mbps, AAC 48 kHz, 31,5 s.
  Exportado desde Premiere/Media Encoder (MainConcept), no es el original de la tarjeta.
- S-Log3 sin corregir. La corrección de color queda fuera de esta fase.
- Chrome 156 soporta por hardware: decodificar ese 4K, codificar H.264 1080×1920, AAC, WebGL2.
- Referencia de velocidad (ffmpeg + VideoToolbox, Apple M4): 6,3 s para 31,5 s. En la M1
  y en el navegador se estiman 20–40 s por clip de 30 s.

## Sección nueva — "15 · Carnaval" (bloque Diseño)
Pantalla en dos columnas: a la izquierda los pasos, a la derecha la vista previa vertical.
1. **Video**: arrastrar o elegir el archivo. Se muestran resolución, duración y fps.
2. **Figura**: comparsa → figura del plantel. Completa nombre(s) y puesto. Campos editables:
   nombre 1, nombre 2 (opcional), puesto, comparsa.
3. **Auspiciante**: logo de la biblioteca o "Ninguno" (recuerda el último usado).
4. **Vista previa**: el video se reproduce con la gráfica animada encima (canvas sobre
   `<video>`); barra de tiempo.
5. **Exportar MP4**: barra de progreso; al terminar descarga
   `dru-carnaval-<comparsa>-<nombres>-<AAAAMMDD>.mp4`.
Pestaña aparte **"Plantel y marcas"** para cargar el plantel y los logos antes del carnaval.

## La gráfica (réplica de "Cobertura 2027 · Figuras", lienzo de diseño → Plantillas cerradas)
Lienzo 1080×1920. Medidas en px.
- **Degradado** noche `#120B1F` sobre el video: 70 % (0 %) → 15 % (20 %) → 0 (32 %–50 %) →
  80 % (72 %) → 95 % (100 %).
- **Lockup DRU** (PNG del lienzo): x 64 · y 305 · ancho 300.
- **Bloque del listón** desde y 1130:
  - Dos nombres: franjas 1080×232, listón x 70 · y +10 · 940×162, puestos en y +198.
  - Un nombre: franjas 1080×170, listón 940×100, puestos en y +136.
  - **Franjas**: tres bandas curvas de punta a punta (trazados SVG de la plantilla, uno por
    altura), con los colores de la comparsa:

    | Comparsa | Banda 1 | Banda 2 | Banda 3 |
    |---|---|---|---|
    | Bella Samba | `#8A1FD6` | `#F2B705` | `#3E4FE0` |
    | Ráfaga | `#E3262D` | `#1E7A3C` | `#E3262D` |
    | Emperatriz | `#0A9A2A` | `#FFF6E9` | `#0A9A2A` |
    | Imperio | `#1B3A9E` | `#C8102E` | `#F2C200` |

  - **Listón**: crema `#FFF6E9`, puntas cortadas de 30 px
    (`polygon(0 0, 100% 0, 100%-30 50%, 100% 100%, 0 100%, 30 50%)`).
  - **Nombres**: Manometer Sans (manual: logotipo y palabras grandes), mayúsculas, color
    `#120B1F`, centrados. Dos nombres: "NOMBRE APELLIDO" / "Y NOMBRE APELLIDO" en dos líneas
    con 14 px entre líneas. La letra se achica si una línea no entra en 800 px.
  - **Puestos**: Acumin Pro Extra Condensed Black, mayúsculas, crema `#FFF6E9`, centrados en
    900 px, sombra `0 2px 10px rgba(18,11,31,.9)`. Dos puestos se unen con " y ".
- **Auspiciante**: logo contenido en 300×90 en x 390 · y 1400. Sin auspiciante, no se dibuja
  nada (el recuadro punteado es solo de la plantilla).
- **Concordia Carnaval** (PNG del lienzo): x 368 · y 1510 · ancho 344.
- Zonas seguras de Instagram respetadas (guías de la plantilla).

### Animación de entrada (después queda fija)
| Elemento | Desde | Duración | Movimiento |
|---|---|---|---|
| Degradado y lockup DRU | 0 s | 0,4 s | fundido |
| Franjas | 0,1 s | 0,5 s | crecen desde el centro hacia los bordes |
| Listón | 0,25 s | 0,45 s | barrido de izquierda a derecha (recorte) |
| Nombres | 0,45 s | 0,5 s | cada línea sube desde su máscara (como los títulos del panel) |
| Puestos | 0,7 s | 0,4 s | fundido y sube 16 px |
| Auspiciante y Concordia Carnaval | 0,85 s | 0,4 s | fundido |
Curvas: ease-out cúbica para entradas (la misma del zócalo).

## Proceso del video (en la notebook)
- **Librería**: Mediabunny (lectura, decodificación y codificación con WebCodecs, MP4),
  **copiada al repo** con versión fija (`vendor/mediabunny-<versión>.min.js`): funciona sin
  internet en el corsódromo y no carga código de terceros en cada uso.
- **Entrada**: MP4/MOV H.264 o HEVC (originales de la ZV-E10 —XAVC S con audio PCM— o
  exportados). Se respeta la rotación del archivo. Si el clip no es vertical, se encuadra
  centrado a 9:16 y se avisa. Formato no soportado → mensaje con qué exportar.
- **Cada cuadro**: el cuadro del video se dibuja en un canvas 1080×1920 con escala a
  cubrir (el 4K vertical se reduce exactamente a la mitad) y encima la gráfica en su
  instante `t`. La gráfica es estática después de 1,25 s, así que desde ahí se reutiliza
  la misma capa ya dibujada.
- **Salida**: MP4, H.264 High 1080×1920, mismos fps del original, 16 Mbps, cuadro clave
  cada 2 s; audio AAC 192 kbps (se copia si ya es AAC; se convierte si es PCM).
- **Rendimiento**: progreso visible; la pestaña tiene que quedar abierta. Objetivo: un clip
  de 30 s en menos de un minuto en la M1.

## Datos (Supabase, vía `db.js`)
- `carnaval_figuras`: id, comparsa, puesto, nombre1, nombre2, orden, creado.
- `carnaval_marcas`: id, nombre, logo (PNG en data URL, máx. 300 KB), creado.
- Al abrir la sección se guardan en el navegador; sin conexión se usa esa copia. El proceso
  del video nunca usa internet.
- Las comparsas y sus colores van fijos en el código (vienen del manual).

## Archivos
- `carnaval-core.js`: datos de comparsas, medidas para 1 o 2 nombres, tiempos de animación,
  armado de textos ("NOMBRE / Y NOMBRE", "Puesto y puesto"), nombre de archivo. Con tests.
- `carnaval-grafica.js`: dibuja la gráfica en un canvas para un instante `t`.
- `carnaval-video.js`: lectura, composición por cuadro y exportación con Mediabunny.
- `carnaval.js`: pantalla, plantel, marcas, vista previa.
- `assets/carnaval/`: lockup DRU y logo Concordia Carnaval (PNG del lienzo), trazados de franjas.

## Fuentes
Manometer Sans y Acumin Pro Extra Condensed **Black** hay que sumarlas al proyecto web de
Adobe Fonts "DRU Panel" (`afu7nsm`). La gráfica espera a que estén cargadas antes de dibujar;
si faltan, avisa en pantalla en vez de exportar con otra letra.

## Pruebas
- Tests de `carnaval-core.js`: colores por comparsa, 1 y 2 nombres, achicado de letra,
  tiempos de animación, nombre de archivo.
- Con `log.mp4`: exportar y verificar con ffprobe (1080×1920, fps, duración, audio),
  medir el tiempo en la M1, comparar un cuadro final contra la plantilla del lienzo.
- Probar un original de la tarjeta de la ZV-E10 (audio PCM) cuando esté disponible.
