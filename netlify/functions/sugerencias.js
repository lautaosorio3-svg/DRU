const { getStore } = require("@netlify/blobs");

const HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS"
};

function initStore() {
  try {
    return getStore("sugerencias");
  } catch {
    const siteID = process.env.SITE_ID;
    const token = process.env.NETLIFY_PAT;
    if (!siteID || !token) throw new Error("Configurá NETLIFY_PAT en las variables de entorno de Netlify");
    return getStore({ name: "sugerencias", siteID, token });
  }
}

async function getAll(store) {
  try {
    const data = await store.get("all", { type: "json" });
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
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
