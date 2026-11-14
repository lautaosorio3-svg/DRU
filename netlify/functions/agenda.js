// HTTP de "Agenda ahora": GET lee la agenda, POST {action:"run"} fuerza una corrida
// (las funciones programadas no se pueden llamar por URL en producción).
const { runRecolector, obtenerAgenda } = require("../lib/agenda-run");

const CORS_ORIGIN = process.env.URL || "https://dru-plataforma.netlify.app";
const HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": CORS_ORIGIN,
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};
const reply = (body) => ({ statusCode: 200, headers: HEADERS, body: JSON.stringify(body) });

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: HEADERS, body: "" };
  try {
    if (event.httpMethod === "GET") {
      const horas = (event.queryStringParameters || {}).horas === "24" ? 24 : 2;
      return reply(await obtenerAgenda(horas));
    }
    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      if (body.action === "run") return reply(await runRecolector());
      return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: "Acción no válida" }) };
    }
    return { statusCode: 405, headers: HEADERS, body: "Method not allowed" };
  } catch (err) {
    const faltanTablas = /agenda_(temas|titulares)/.test(err.message) && /does not exist|schema cache|404/.test(err.message);
    return reply({ configured: true, error: err.message, faltanTablas });
  }
};
