const HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS"
};

const GRAPH_URL = "https://graph.facebook.com/v21.0";

async function graphGet(path, token, params = {}) {
  const qs = new URLSearchParams({ access_token: token, ...params });
  const res = await fetch(`${GRAPH_URL}/${path}?${qs}`);
  return res.json();
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: HEADERS, body: "" };
  if (event.httpMethod !== "GET") return { statusCode: 405, headers: HEADERS, body: "Method not allowed" };

  const TOKEN = process.env.META_ACCESS_TOKEN;
  const FB_PAGE_ID = process.env.META_FB_PAGE_ID;
  const IG_USER_ID = process.env.META_IG_USER_ID;

  if (!TOKEN) {
    return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ configured: false, error: "META_ACCESS_TOKEN no configurado" }) };
  }

  const qs = event.queryStringParameters || {};
  const action = qs.action || "overview";

  try {
    if (action === "overview") {
      const result = { configured: true, fb: null, ig: null };

      // Facebook Page
      if (FB_PAGE_ID) {
        const [page, posts] = await Promise.all([
          graphGet(FB_PAGE_ID, TOKEN, { fields: "name,fan_count,followers_count" }),
          graphGet(`${FB_PAGE_ID}/posts`, TOKEN, {
            fields: "message,created_time,shares,likes.summary(true),comments.summary(true)",
            limit: 12
          })
        ]);
        result.fb = {
          page,
          posts: (posts.data || []).map(p => ({
            id: p.id, message: (p.message || "").substring(0, 200), created_time: p.created_time,
            likes: p.likes?.summary?.total_count || 0, comments: p.comments?.summary?.total_count || 0,
            shares: p.shares?.count || 0
          }))
        };
      }

      // Instagram
      if (IG_USER_ID) {
        const now = new Date();
        const since = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        const until = now.toISOString().split("T")[0];

        const [profile, insights, mediaList] = await Promise.all([
          graphGet(IG_USER_ID, TOKEN, { fields: "username,name,followers_count,follows_count,media_count,biography" }),
          graphGet(`${IG_USER_ID}/insights`, TOKEN, {
            metric: "reach,accounts_engaged,profile_views,total_interactions",
            metric_type: "total_value",
            period: "day",
            since, until
          }),
          graphGet(`${IG_USER_ID}/media`, TOKEN, {
            fields: "caption,timestamp,media_type,permalink,like_count,comments_count",
            limit: 12
          })
        ]);

        // Fetch per-post insights in parallel
        const media = mediaList.data || [];
        const mediaWithInsights = await Promise.all(media.map(async (m) => {
          try {
            const ins = await graphGet(`${m.id}/insights`, TOKEN, { metric: "reach,saved,shares,total_interactions" });
            const getData = (name) => ins.data?.find(i => i.name === name)?.values?.[0]?.value || 0;
            return {
              id: m.id, caption: (m.caption || "").substring(0, 200), timestamp: m.timestamp,
              media_type: m.media_type, permalink: m.permalink,
              likes: m.like_count || 0, comments: m.comments_count || 0,
              reach: getData("reach"), saved: getData("saved"),
              shares: getData("shares"), interactions: getData("total_interactions")
            };
          } catch {
            return {
              id: m.id, caption: (m.caption || "").substring(0, 200), timestamp: m.timestamp,
              media_type: m.media_type, permalink: m.permalink,
              likes: m.like_count || 0, comments: m.comments_count || 0,
              reach: 0, saved: 0, shares: 0, interactions: 0
            };
          }
        }));

        const insightsMap = {};
        (insights.data || []).forEach(i => { insightsMap[i.name] = i.total_value?.value || 0; });

        result.ig = { profile, insights: insightsMap, media: mediaWithInsights };
      }

      return { statusCode: 200, headers: HEADERS, body: JSON.stringify(result) };
    }

    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: "Acción no válida" }) };
  } catch (err) {
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: err.message }) };
  }
};
