const { getStore } = require("@netlify/blobs");

const HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS"
};

const USER_EMAILS = {
  admin: "lautaosorio3@gmail.com",
  redactor: "pereiragmati@gmail.com",
  redes: "more.martinezfi@gmail.com"
};

function initStore() {
  const siteID = process.env.SITE_ID;
  const token = process.env.NETLIFY_PAT;
  if (siteID && token) {
    return getStore({ name: "sugerencias", siteID, token });
  }
  return getStore("sugerencias");
}

async function getAll(store) {
  try {
    const data = await store.get("all", { type: "json" });
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function sendEmails(sug, notifyUsers) {
  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY || !notifyUsers || !notifyUsers.length) return;

  const to = notifyUsers.map(u => USER_EMAILS[u]).filter(Boolean);
  if (!to.length) return;

  const catLabels = { feature: "Nueva función", mejora: "Mejora", bug: "Bug", contenido: "Contenido", otro: "Otro" };

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${RESEND_KEY}` },
      body: JSON.stringify({
        from: "DRU Editorial <onboarding@resend.dev>",
        to,
        subject: `[DRU Sugerencia] ${catLabels[sug.category] || sug.category} — ${sug.name}`,
        html: `<div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#1a1a1a;padding:20px 24px;border-radius:12px 12px 0 0">
            <h2 style="color:#E8A94A;margin:0;font-size:18px">Nueva sugerencia en DRU Editorial</h2>
          </div>
          <div style="background:#242424;padding:20px 24px;border-radius:0 0 12px 12px">
            <table style="width:100%;font-size:14px;color:#ccc;border-collapse:collapse">
              <tr><td style="padding:6px 0;color:#888;width:100px">De:</td><td style="padding:6px 0">${sug.name}</td></tr>
              <tr><td style="padding:6px 0;color:#888">Categoría:</td><td style="padding:6px 0"><span style="background:#E8A94A22;color:#E8A94A;padding:2px 8px;border-radius:8px;font-size:12px">${catLabels[sug.category] || sug.category}</span></td></tr>
              <tr><td style="padding:6px 0;color:#888">Fecha:</td><td style="padding:6px 0">${new Date(sug.date).toLocaleString("es-AR",{timeZone:"America/Argentina/Buenos_Aires"})}</td></tr>
            </table>
            <hr style="border:1px solid #333;margin:16px 0">
            <p style="font-size:15px;line-height:1.7;color:#eee;margin:0">${sug.text.replace(/</g,"&lt;").replace(/\n/g,"<br>")}</p>
            <hr style="border:1px solid #333;margin:16px 0">
            <p style="color:#666;font-size:11px;margin:0">Enviado desde el panel DRU Editorial — Sección Sugerencias</p>
          </div>
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
    store = initStore();
  } catch (err) {
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: err.message }) };
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
      sendEmails(sug, body.notify);
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ ok: true }) };
    } catch (err) {
      return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: err.message }) };
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
