exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type" }, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const API_KEY = process.env.OPENAI_API_KEY;
  if (!API_KEY) {
    return { statusCode: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "OPENAI_API_KEY not configured" }) };
  }

  try {
    const body = JSON.parse(event.body);
    const audioBase64 = body.audio;
    const filename = body.filename || "audio.webm";
    const model = body.model || "whisper-1";

    if (!audioBase64) {
      return { statusCode: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "No audio data provided" }) };
    }

    const audioBuffer = Buffer.from(audioBase64, "base64");
    const blob = new Blob([audioBuffer]);

    const formData = new FormData();
    formData.append("file", blob, filename);
    formData.append("model", model);
    formData.append("language", "es");
    formData.append("response_format", "verbose_json");

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${API_KEY}` },
      body: formData
    });

    const data = await res.json();

    if (data.error) {
      return { statusCode: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: data.error.message || JSON.stringify(data.error) }) };
    }

    return { statusCode: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ text: data.text, duration: data.duration, language: data.language, segments: data.segments }) };
  } catch (err) {
    return { statusCode: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: err.message }) };
  }
};
