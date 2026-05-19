const { getStore } = require("@netlify/blobs");

const HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS"
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: HEADERS, body: "" };
  }

  const store = getStore("sugerencias");

  if (event.httpMethod === "GET") {
    try {
      const data = await store.get("all", { type: "json" });
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify(data || []) };
    } catch {
      return { statusCode: 200, headers: HEADERS, body: "[]" };
    }
  }

  if (event.httpMethod === "POST") {
    try {
      const body = JSON.parse(event.body);
      let current = [];
      try { current = await store.get("all", { type: "json" }) || []; } catch {}
      current.push({
        id: Date.now(),
        name: body.name || "Anónimo",
        category: body.category || "otro",
        text: body.text,
        date: new Date().toISOString()
      });
      await store.setJSON("all", current);
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ ok: true }) };
    } catch (err) {
      return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: err.message }) };
    }
  }

  if (event.httpMethod === "DELETE") {
    try {
      const body = JSON.parse(event.body);
      let current = [];
      try { current = await store.get("all", { type: "json" }) || []; } catch {}
      current = current.filter(s => s.id !== body.id);
      await store.setJSON("all", current);
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ ok: true }) };
    } catch (err) {
      return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: err.message }) };
    }
  }

  return { statusCode: 405, headers: HEADERS, body: "Method not allowed" };
};
