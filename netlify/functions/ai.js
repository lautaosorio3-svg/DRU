const CORS_ORIGIN = process.env.URL || "https://dru-plataforma.netlify.app";

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: { "Access-Control-Allow-Origin": CORS_ORIGIN, "Access-Control-Allow-Headers": "Content-Type" }, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const API_KEY = process.env.ANTHROPIC_API_KEY_drudigital || process.env.ANTHROPIC_API_KEY;
  if (!API_KEY) {
    return { statusCode: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": CORS_ORIGIN },
      body: JSON.stringify({ error: "API key not configured" }) };
  }

  try {
    const body = JSON.parse(event.body);
    const requestBody = {
      // Use the model the frontend requests, or default to haiku (fastest)
      model: body.model || "claude-haiku-4-5-20251001",
      max_tokens: body.max_tokens || 1000,
      messages: body.messages || []
    };
    if (body.tools && body.tools.length > 0) {
      requestBody.tools = body.tools;
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(requestBody)
    });

    const data = await res.json();
    
    if (data.error) {
      return { statusCode: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": CORS_ORIGIN },
        body: JSON.stringify({ error: data.error.message || JSON.stringify(data.error), type: data.error.type }) };
    }

    return { statusCode: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": CORS_ORIGIN },
      body: JSON.stringify(data) };
  } catch (err) {
    return { statusCode: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": CORS_ORIGIN },
      body: JSON.stringify({ error: err.message }) };
  }
};
