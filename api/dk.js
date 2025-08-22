// /api/dk.js  — Vercel Serverless Function (Node runtime)

export default async function handler(req, res) {
  // --- CORS (so Sheets/Browser can call it) ---
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  const urlObj = new URL(req.url, `http://${req.headers.host}`);
  const site = urlObj.searchParams.get("site") || "US-NJ";
  const group = urlObj.searchParams.get("group"); // e.g. 84240 for MLB

  // DK endpoints we’ll try in order
  const endpoints = [];
  const ts = Date.now();

  if (group) {
    endpoints.push(`https://sportsbook.draftkings.com/sites/${site}/api/v5/eventgroups/${group}?format=json&t=${ts}`);
    endpoints.push(`https://sportsbook-us-nj.draftkings.com/sites/${site}/api/v5/eventgroups/${group}?format=json&t=${ts}`);
  } else {
    endpoints.push(`https://sportsbook.draftkings.com/sites/${site}/api/v5/sports?format=json&t=${ts}`);
    endpoints.push(`https://sportsbook-us-nj.draftkings.com/sites/${site}/api/v5/sports?format=json&t=${ts}`);
  }

  const headers = {
    "Accept": "application/json, text/plain, */*",
    "Accept-Encoding": "identity",           // avoid gzip aborts
    "Connection": "keep-alive",
    "Origin": "https://sportsbook.draftkings.com",
    "Referer": "https://sportsbook.draftkings.com/",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
  };

  // helper: fetch with timeout
  const fetchWithTimeout = async (u, ms = 12000) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    try {
      const r = await fetch(u, {
        method: "GET",
        headers,
        redirect: "follow",
        cache: "no-store",
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const txt = await r.text();
      // DK sometimes returns blank lines; trim then parse
      const body = txt.trim();
      return JSON.parse(body);
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  };

  // try endpoints in order
  const errors = [];
  for (const ep of endpoints) {
    try {
      const data = await fetchWithTimeout(ep, 15000);
      return res.status(200).json({
        ok: true,
        site,
        group: group || null,
        endpoint_used: ep,
        data,
      });
    } catch (e) {
      errors.push({ endpoint: ep, error: String(e && e.message ? e.message : e) });
    }
  }

  // none worked
  return res.status(502).json({
    ok: false,
    message: "DK: all endpoints failed",
    errors,
  });
}
