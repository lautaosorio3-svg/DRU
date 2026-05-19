const { getStore } = require("@netlify/blobs");

const HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS"
};

async function getAll(store) {
  try {
    const data = await store.get("all", { type: "json" });
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function sendEmailNotification(sug) {
  const RESEND_KEY = process.env.RESEND_API_KEY;
  const NOTIFY_EMAILS = process.env.NOTIFICATION_EMAILS;
  if (!RESEND_KEY || !NOTIFY_EMAILS) return;

  const to = NOTIFY_EMAILS.split(",").map(e => e.trim()).filter(Boolean);
  if (!to.length) return;

  const catLabels = { feature: "Nueva función", mejora: "Mejora", bug: "Bug", contenido: "Contenido", otro: "Otro" };

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${RESEND_KEY}` },
      body: JSON.stringify({
        from: "DRU Editorial <onboarding@resend.dev>",
        to,
        subject: `[DRU] Nueva sugerencia: ${catLabels[sug.category] || sug.category}`,
        html: `<div style="font-family:sans-serif;max-width:600px">
          <h2 style="color:#E8A94A">Nueva sugerencia en DRU Editorial</h2>
          <p><strong>De:</strong> ${sug.name}</p>
          <p><strong>Categoría:</strong> ${catLabels[sug.category] || sug.category}</p>
          <p><strong>Fecha:</strong> ${new Date(sug.date).toLocaleString("es-AR")}</p>
          <hr style="border:1px solid #eee">
          <p style="font-size:16px;line-height:1.6">${sug.text.replace(/\n/g, "<br>")}</p>
          <hr style="border:1px solid #eee">
          <p style="color:#888;font-size:12px">Enviado desde DRU Editorial — Panel de sugerencias</p>
        </div>`
      })
    });
  } catch {}
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: HEADERS, body: "" };
  }

  let store;
  try {
    store = getStore("sugerencias");
  } catch (err) {
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: "Storage not available: " + err.message }) };
  }

  if (event.httpMethod === "GET") {
    const data = await getAll(store);
    return { statusCode: 200, headers: HEADERS, body: JSON.stringify(data) };
  }

  if (event.httpMethod === "POST") {
    try {
      const body = JSON.parse(event.body);
      if (!body.text) {
        return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: "text is required" }) };
      }
      const current = await getAll(store);
      const sug = {
        id: Date.now(),
        name: body.name || "Anónimo",
        category: body.category || "otro",
        text: body.text,
        date: new Date().toISOString()
      };
      current.push(sug);
      await store.setJSON("all", current);
      sendEmailNotification(sug);
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ ok: true }) };
    } catch (err) {
      return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: err.message, stack: err.stack }) };
    }
  }

  if (event.httpMethod === "DELETE") {
    try {
      const body = JSON.parse(event.body);
      let current = await getAll(store);
      current = current.filter(s => s.id !== body.id);
      await store.setJSON("all", current);
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ ok: true }) };
    } catch (err) {
      return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: err.message }) };
    }
  }

  return { statusCode: 405, headers: HEADERS, body: "Method not allowed" };
};
