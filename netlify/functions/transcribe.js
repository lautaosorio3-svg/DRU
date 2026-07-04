// Devuelve la API key de OpenAI para que el frontend llame directo a Whisper
// (evita el límite de 6MB de body en Netlify Functions)
const CORS_ORIGIN = process.env.URL || "https://dru-plataforma.netlify.app";

exports.handler = async (event) => {
  const HEADERS = { "Content-Type": "application/json", "Access-Control-Allow-Origin": CORS_ORIGIN, "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "GET, OPTIONS" };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: HEADERS, body: "" };
  }

  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers: HEADERS, body: "Method not allowed" };
  }

  const API_KEY = process.env.OPENAI_API_KEY;
  if (!API_KEY) {
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: "OPENAI_API_KEY not configured" }) };
  }

  return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ k: API_KEY }) };
};
