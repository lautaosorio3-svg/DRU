// Función programada (cada hora, ver netlify.toml): revisa los feeds RSS
// y guarda alertas en Supabase cuando un titular matchea una keyword vigilada.
// Así las alertas llegan a todo el equipo sin que nadie tenga que abrir el panel.
const { checkAlertas } = require("./rss-trends");

exports.handler = async () => {
  try {
    const result = await checkAlertas(24);
    console.log("rss-alertas:", JSON.stringify({ configured: result.configured, nuevas: (result.alertas || []).length, keywords: result.keywords }));
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (err) {
    console.error("rss-alertas error:", err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
