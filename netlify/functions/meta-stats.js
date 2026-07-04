const CORS_ORIGIN = process.env.URL || "https://dru-plataforma.netlify.app";
const HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": CORS_ORIGIN,
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS"
};

const GRAPH_URL = "https://graph.facebook.com/v21.0";
const ALLOWED_PERIODS = [7, 28, 90];

async function graphGet(path, token, params = {}) {
  const qs = new URLSearchParams({ access_token: token, ...params });
  const res = await fetch(`${GRAPH_URL}/${path}?${qs}`);
  return res.json();
}

function dateStr(d) { return d.toISOString().split("T")[0]; }

// Meta caps insights date ranges at ~30 days per request, so longer periods
// are split into consecutive windows and summed.
function chunkRanges(days, maxChunk = 30) {
  const ranges = [];
  let end = new Date();
  let remaining = days;
  while (remaining > 0) {
    const chunkDays = Math.min(remaining, maxChunk);
    const start = new Date(end - chunkDays * 24 * 60 * 60 * 1000);
    ranges.push({ since: dateStr(start), until: dateStr(end) });
    end = start;
    remaining -= chunkDays;
  }
  return ranges;
}

async function fetchIGInsightsSummed(IG_USER_ID, TOKEN, days) {
  const ranges = chunkRanges(days);
  const results = await Promise.all(ranges.map(r => graphGet(`${IG_USER_ID}/insights`, TOKEN, {
    metric: "reach,accounts_engaged,profile_views,total_interactions",
    metric_type: "total_value",
    period: "day",
    since: r.since, until: r.until
  }).catch(() => ({ data: [] }))));
  const map = {};
  results.forEach(insights => {
    (insights.data || []).forEach(i => {
      map[i.name] = (map[i.name] || 0) + (i.total_value?.value || 0);
    });
  });
  return map;
}

async function fetchFBInsightsSummed(FB_PAGE_ID, TOKEN, days) {
  const ranges = chunkRanges(days);
  const results = await Promise.all(ranges.map(r => graphGet(`${FB_PAGE_ID}/insights`, TOKEN, {
    metric: "page_impressions_unique,page_engaged_users,page_post_engagements,page_views_total",
    period: "day",
    since: r.since, until: r.until
  }).catch(() => ({ data: [] }))));
  const map = {};
  results.forEach(insights => {
    (insights.data || []).forEach(m => {
      const sum = (m.values || []).reduce((s, v) => s + (v.value || 0), 0);
      map[m.name] = (map[m.name] || 0) + sum;
    });
  });
  return map;
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
  const days = ALLOWED_PERIODS.includes(parseInt(qs.period, 10)) ? parseInt(qs.period, 10) : 7;
  const mediaLimit = days <= 7 ? 12 : days <= 28 ? 20 : 30;
  const periodStart = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    if (action === "overview") {
      const result = { configured: true, fb: null, ig: null, period: days };

      // Facebook Page
      if (FB_PAGE_ID) {
        const [page, posts, insightsMap] = await Promise.all([
          graphGet(FB_PAGE_ID, TOKEN, { fields: "name,fan_count,followers_count" }),
          graphGet(`${FB_PAGE_ID}/posts`, TOKEN, {
            fields: "message,created_time,shares,likes.summary(true),comments.summary(true)",
            limit: mediaLimit
          }),
          fetchFBInsightsSummed(FB_PAGE_ID, TOKEN, days)
        ]);

        result.fb = {
          page,
          insights: insightsMap,
          posts: (posts.data || [])
            .filter(p => new Date(p.created_time) >= periodStart)
            .map(p => ({
              id: p.id, message: (p.message || "").substring(0, 200), created_time: p.created_time,
              likes: p.likes?.summary?.total_count || 0, comments: p.comments?.summary?.total_count || 0,
              shares: p.shares?.count || 0
            }))
        };
      }

      // Instagram
      if (IG_USER_ID) {
        const [profile, insightsMap, mediaList] = await Promise.all([
          graphGet(IG_USER_ID, TOKEN, { fields: "username,name,followers_count,follows_count,media_count,biography" }),
          fetchIGInsightsSummed(IG_USER_ID, TOKEN, days),
          graphGet(`${IG_USER_ID}/media`, TOKEN, {
            fields: "caption,timestamp,media_type,permalink,like_count,comments_count",
            limit: mediaLimit
          })
        ]);

        // Fetch per-post insights in parallel
        const media = (mediaList.data || []).filter(m => new Date(m.timestamp) >= periodStart);
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

        result.ig = { profile, insights: insightsMap, media: mediaWithInsights };
      }

      return { statusCode: 200, headers: HEADERS, body: JSON.stringify(result) };
    }

    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: "Acción no válida" }) };
  } catch (err) {
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: err.message }) };
  }
};
