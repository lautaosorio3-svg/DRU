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
    // ── OVERVIEW: métricas generales ──
    if (action === "overview") {
      const result = { configured: true, fb: null, ig: null };

      // Facebook Page
      if (FB_PAGE_ID) {
        const [page, insights, posts] = await Promise.all([
          graphGet(FB_PAGE_ID, TOKEN, { fields: "name,fan_count,followers_count,new_like_count" }),
          graphGet(`${FB_PAGE_ID}/insights`, TOKEN, {
            metric: "page_impressions,page_engaged_users,page_post_engagements,page_fans",
            period: "day",
            date_preset: "last_7d"
          }),
          graphGet(`${FB_PAGE_ID}/posts`, TOKEN, {
            fields: "message,created_time,shares,likes.summary(true),comments.summary(true),insights.metric(post_impressions,post_engaged_users)",
            limit: 10
          })
        ]);
        result.fb = { page, insights: insights.data || [], posts: (posts.data || []).map(p => ({
          id: p.id, message: (p.message || "").substring(0, 120), created_time: p.created_time,
          likes: p.likes?.summary?.total_count || 0, comments: p.comments?.summary?.total_count || 0,
          shares: p.shares?.count || 0,
          impressions: p.insights?.data?.find(i => i.name === "post_impressions")?.values?.[0]?.value || 0,
          engagement: p.insights?.data?.find(i => i.name === "post_engaged_users")?.values?.[0]?.value || 0
        })) };
      }

      // Instagram
      if (IG_USER_ID) {
        const [profile, insights, media] = await Promise.all([
          graphGet(IG_USER_ID, TOKEN, { fields: "username,name,followers_count,follows_count,media_count,profile_picture_url,biography" }),
          graphGet(`${IG_USER_ID}/insights`, TOKEN, {
            metric: "impressions,reach,accounts_engaged,profile_views",
            period: "day",
            date_preset: "last_7d"
          }),
          graphGet(`${IG_USER_ID}/media`, TOKEN, {
            fields: "caption,timestamp,media_type,media_url,thumbnail_url,permalink,like_count,comments_count,insights.metric(impressions,reach,engagement,saved)",
            limit: 12
          })
        ]);
        result.ig = { profile, insights: insights.data || [], media: (media.data || []).map(m => ({
          id: m.id, caption: (m.caption || "").substring(0, 150), timestamp: m.timestamp,
          media_type: m.media_type, permalink: m.permalink,
          media_url: m.media_url || m.thumbnail_url || null,
          likes: m.like_count || 0, comments: m.comments_count || 0,
          impressions: m.insights?.data?.find(i => i.name === "impressions")?.values?.[0]?.value || 0,
          reach: m.insights?.data?.find(i => i.name === "reach")?.values?.[0]?.value || 0,
          engagement: m.insights?.data?.find(i => i.name === "engagement")?.values?.[0]?.value || 0,
          saved: m.insights?.data?.find(i => i.name === "saved")?.values?.[0]?.value || 0
        })) };
      }

      return { statusCode: 200, headers: HEADERS, body: JSON.stringify(result) };
    }

    // ── TOKEN CHECK ──
    if (action === "check") {
      const debug = await graphGet("debug_token", TOKEN, { input_token: TOKEN });
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ configured: true, debug: debug.data }) };
    }

    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: "Acción no válida" }) };
  } catch (err) {
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: err.message }) };
  }
};
