// Proceso del video del Carnaval, todo en la notebook: lee el clip, compone cada cuadro
// (video a 1080×1920 + gráfica animada) y exporta un MP4 listo para redes.
// Mediabunny va copiado en vendor/ para funcionar sin internet en el corsódromo.
import * as MB from "./vendor/mediabunny-1.65.1.min.mjs";

const W = 1080, H = 1920;
let conversionActual = null;

async function abrir(file) {
  return new MB.Input({ formats: MB.ALL_FORMATS, source: new MB.BlobSource(file) });
}

async function inspeccionar(file) {
  const input = await abrir(file);
  const v = await input.getPrimaryVideoTrack();
  if (!v) throw new Error("El archivo no tiene video.");
  const a = await input.getPrimaryAudioTrack();
  return {
    ancho: v.displayWidth, alto: v.displayHeight,
    duracion: await input.computeDuration(),
    codec: v.codec, audio: a ? a.codec : null,
    decodificable: await v.canDecode(),
    vertical: v.displayHeight > v.displayWidth
  };
}

async function exportar(file, datos, recursos, { alAvanzar } = {}) {
  const input = await abrir(file);
  const output = new MB.Output({ format: new MB.Mp4OutputFormat({ fastStart: "in-memory" }), target: new MB.BufferTarget() });
  const lienzo = document.createElement("canvas"); lienzo.width = W; lienzo.height = H;
  const ctx = lienzo.getContext("2d", { alpha: false });
  const capa = document.createElement("canvas"); capa.width = W; capa.height = H;
  const capaCtx = capa.getContext("2d");
  let inicio = null;

  const conversion = await MB.Conversion.init({
    input, output,
    video: {
      codec: "avc", bitrate: 16e6, keyFrameInterval: 2, forceTranscode: true,
      processedWidth: W, processedHeight: H,
      process: (sample) => {
        if (inicio === null) inicio = sample.timestamp;
        ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
        sample.drawWithFit(ctx, { fit: "cover" });
        window.CarnavalGrafica.dibujarGrafica(capaCtx, datos, sample.timestamp - inicio, recursos);
        ctx.drawImage(capa, 0, 0);
        return lienzo;
      }
    },
    audio: { codec: "aac", bitrate: 192e3 }
  });
  if (!conversion.isValid) {
    const motivos = conversion.discardedTracks.map((d) => `${d.track.type}: ${d.reason}`).join(", ");
    throw new Error("No se puede procesar este archivo (" + motivos + "). Exportalo como MP4 H.264 o HEVC.");
  }
  if (alAvanzar) conversion.onProgress = alAvanzar;
  conversionActual = conversion;
  try { await conversion.execute(); } finally { conversionActual = null; }
  return new Blob([output.target.buffer], { type: "video/mp4" });
}

function cancelar() { if (conversionActual) conversionActual.cancel(); }

window.CarnavalVideo = { inspeccionar, exportar, cancelar };
window.dispatchEvent(new Event("carnaval-video-listo"));
