const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 3000;
const API_KEY = process.env.ANTHROPIC_API_KEY || "";
const OPENAI_KEY = process.env.OPENAI_API_KEY || "";

if (!API_KEY) {
  console.error("\n  ⚠  Falta ANTHROPIC_API_KEY\n");
  console.error("  Ejecutá así:");
  console.error("  ANTHROPIC_API_KEY=sk-ant-... OPENAI_API_KEY=sk-... node server.js\n");
  process.exit(1);
}

const MIME = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

async function handleAI(req, res) {
  let body = "";
  for await (const chunk of req) body += chunk;

  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid JSON" }));
    return;
  }

  const requestBody = {
    model: parsed.model || "claude-haiku-4-5-20251001",
    max_tokens: parsed.max_tokens || 1000,
    messages: parsed.messages || [],
  };
  if (parsed.tools && parsed.tools.length > 0) {
    requestBody.tools = parsed.tools;
  }

  try {
    const apiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(requestBody),
    });

    const data = await apiRes.text();
    res.writeHead(apiRes.status, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(data);
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
}

async function handleTranscribe(req, res) {
  if (!OPENAI_KEY) {
    res.writeHead(500, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify({ error: "OPENAI_API_KEY not configured. Transcription requires an OpenAI API key." }));
    return;
  }

  let body = "";
  for await (const chunk of req) body += chunk;

  let parsed;
  try { parsed = JSON.parse(body); } catch {
    res.writeHead(400, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify({ error: "Invalid JSON" }));
    return;
  }

  try {
    const audioBuffer = Buffer.from(parsed.audio, "base64");
    const blob = new Blob([audioBuffer]);
    const formData = new FormData();
    formData.append("file", blob, parsed.filename || "audio.webm");
    formData.append("model", parsed.model || "whisper-1");
    formData.append("language", "es");
    formData.append("response_format", "verbose_json");

    const apiRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_KEY}` },
      body: formData
    });

    const data = await apiRes.json();
    if (data.error) {
      res.writeHead(400, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify({ error: data.error.message || JSON.stringify(data.error) }));
      return;
    }

    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify({ text: data.text, duration: data.duration, language: data.language }));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify({ error: err.message }));
  }
}

const server = http.createServer((req, res) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(200, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    });
    res.end();
    return;
  }

  // Proxy AI requests
  if (req.url === "/.netlify/functions/ai" && req.method === "POST") {
    handleAI(req, res);
    return;
  }

  // Proxy transcription requests
  if (req.url === "/.netlify/functions/transcribe" && req.method === "POST") {
    handleTranscribe(req, res);
    return;
  }

  // Static file server
  let filePath = req.url === "/" ? "/index.html" : req.url;
  filePath = path.join(__dirname, filePath);

  const ext = path.extname(filePath);
  const contentType = MIME[ext] || "application/octet-stream";

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
  });
});

server.listen(PORT, () => {
  console.log(`\n  ✓ DRU Editorial corriendo en http://localhost:${PORT}`);
  console.log(`  ✓ Anthropic API Key configurada (${API_KEY.substring(0, 12)}...)`);
  console.log(`  ${OPENAI_KEY ? "✓" : "⚠"} OpenAI API Key ${OPENAI_KEY ? "configurada (" + OPENAI_KEY.substring(0, 12) + "...)" : "NO configurada — transcripción deshabilitada"}`);
  console.log(`  ✓ Proxy activo: /.netlify/functions/ai → api.anthropic.com`);
  console.log(`  ${OPENAI_KEY ? "✓" : "⚠"} Proxy transcripción: /.netlify/functions/transcribe → api.openai.com\n`);
});
