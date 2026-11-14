// Función programada (cada 15 min, ver netlify.toml): recolecta titulares
// de los medios entrerrianos y los agrupa en temas para "Agenda ahora".
const { runRecolector } = require("../lib/agenda-run");

exports.handler = async () => {
  try {
    const r = await runRecolector();
    console.log("agenda-recolector:", JSON.stringify(r));
    return { statusCode: 200, body: JSON.stringify(r) };
  } catch (err) {
    console.error("agenda-recolector error:", err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
