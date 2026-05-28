exports.handler = async (event) => {
  const HEADERS = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "POST, OPTIONS" };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: HEADERS, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: HEADERS, body: "Method not allowed" };

  const API_KEY = process.env.OPENAI_API_KEY;
  if (!API_KEY) return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: "OPENAI_API_KEY not configured" }) };

  try {
    const body = JSON.parse(event.body);
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${API_KEY}` },
      body: JSON.stringify({
        model: body.model || "gpt-4o-mini",
        max_tokens: body.max_tokens || 2000,
        messages: body.messages || []
      })
    });

    const data = await res.json();
    if (data.error) return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: data.error.message || JSON.stringify(data.error) }) };

    // Normalizar respuesta al formato de Anthropic para que el frontend no cambie
    const text = data.choices?.[0]?.message?.content || "";
    return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ content: [{ type: "text", text }] }) };
  } catch (err) {
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: err.message }) };
  }
};
