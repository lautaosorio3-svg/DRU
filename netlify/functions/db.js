// Proxy a Supabase REST. La service key vive SOLO acá (variables de entorno
// de Netlify) — nunca en el navegador. El frontend habla con esta función.
const HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};

// Solo estas tablas son accesibles desde el panel.
const TABLES = {
  borradores: { order: "creado.desc", limit: 100 },
  correcciones: { order: "creado.desc", limit: 50 },
  keywords: { order: "creado.asc", limit: 100 },
  alertas: { order: "creado.desc", limit: 200 }
};

function supa() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  // Tolera que SUPABASE_URL venga con o sin /rest/v1 (o con barra final).
  const clean = url.trim().replace(/\/+$/, "").replace(/\/rest\/v1$/, "");
  return {
    base: clean + "/rest/v1",
    headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` }
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: HEADERS, body: "" };

  const s = supa();
  if (!s) return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ configured: false }) };

  try {
    if (event.httpMethod === "GET") {
      const qs = event.queryStringParameters || {};

      // Diagnóstico seguro: NO expone la service key, solo el host y el estado.
      if (qs.action === "diag") {
        let host = "";
        try { host = new URL(process.env.SUPABASE_URL).host; } catch { host = "(SUPABASE_URL inválida: '" + String(process.env.SUPABASE_URL).slice(0, 40) + "')"; }
        let status = null, snippet = "";
        try {
          const r = await fetch(`${s.base}/keywords?select=id&limit=1`, { headers: s.headers });
          status = r.status;
          snippet = (await r.text()).slice(0, 200);
        } catch (e) { snippet = "fetch error: " + e.message; }
        return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ configured: true, base: s.base, host, keyLen: (process.env.SUPABASE_SERVICE_KEY || "").length, status, snippet }) };
      }

      const cfg = TABLES[qs.table];
      if (!cfg) return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: "Tabla no permitida" }) };
      const res = await fetch(`${s.base}/${qs.table}?select=*&order=${cfg.order}&limit=${cfg.limit}`, { headers: s.headers });
      const rows = await res.json();
      if (!res.ok) return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ configured: true, rows: [], error: rows.message || JSON.stringify(rows) }) };
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ configured: true, rows: Array.isArray(rows) ? rows : [] }) };
    }

    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      const { action, table } = body;
      if (!TABLES[table]) return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: "Tabla no permitida" }) };

      if (action === "insert") {
        const rows = Array.isArray(body.row) ? body.row : [body.row];
        const res = await fetch(`${s.base}/${table}`, {
          method: "POST",
          headers: { ...s.headers, Prefer: "return=representation" },
          body: JSON.stringify(rows)
        });
        const data = await res.json();
        if (!res.ok) return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: data.message || JSON.stringify(data) }) };
        return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ configured: true, rows: data }) };
      }

      if (action === "update" && body.id) {
        const res = await fetch(`${s.base}/${table}?id=eq.${encodeURIComponent(body.id)}`, {
          method: "PATCH",
          headers: { ...s.headers, Prefer: "return=representation" },
          body: JSON.stringify(body.row || {})
        });
        const data = await res.json();
        if (!res.ok) return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: data.message || JSON.stringify(data) }) };
        return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ configured: true, rows: data }) };
      }

      if (action === "delete" && (body.id || body.client_id)) {
        // borradores se borran por client_id (el id que genera el navegador)
        const filter = body.id
          ? `id=eq.${encodeURIComponent(body.id)}`
          : `client_id=eq.${encodeURIComponent(body.client_id)}`;
        if (body.client_id && table !== "borradores") {
          return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: "client_id solo en borradores" }) };
        }
        const res = await fetch(`${s.base}/${table}?${filter}`, {
          method: "DELETE",
          headers: s.headers
        });
        return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ configured: true, ok: res.ok }) };
      }

      return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: "Acción no válida" }) };
    }

    return { statusCode: 405, headers: HEADERS, body: "Method not allowed" };
  } catch (err) {
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: err.message }) };
  }
};
