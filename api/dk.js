// /api/dk.js  — Vercel Edge Function to proxy DraftKings sportsbook JSON

export const config = { runtime: 'edge' };

export default async function handler(req) {
  const url = new URL(req.url);
  const site = (url.searchParams.get('site') || 'US-NJ').toUpperCase();
  const group = url.searchParams.get('group'); // optional: event group id

  // Build candidate endpoints (we'll try each until one works)
  const now = Date.now();
  const paths = group
    ? [
        `/sites/${site}/api/v5/eventgroups/${group}?format=json&t=${now}`,
      ]
    : [
        // League root with all current event groups
        `/sites/${site}/api/v5/sports/baseball/mlb?format=json&t=${now}`,
      ];

  const hosts = [
    'https://sportsbook.draftkings.com',
    `https://sportsbook-us-nj.draftkings.com`, // alt geo host often used by DK
  ];

  const headers = {
    'Accept': 'application/json, text/plain, */*',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
    'Referer': 'https://sportsbook.draftkings.com/',
  };

  const errors = [];

  // Try each host+path combination until one returns valid JSON
  for (const h of hosts) {
    for (const p of paths) {
      const endpoint = `${h}${p}`;
      try {
        const res = await fetch(endpoint, {
          headers,
          // Abort after 12s to avoid hanging
          signal: AbortSignal.timeout(12_000),
        });

        if (!res.ok) {
          errors.push({ endpoint, error: `HTTP ${res.status}` });
          continue;
        }

        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('application/json')) {
          const text = await res.text();
          if (text && text.trim().startsWith('{')) {
            // Some DK edges send JSON without the proper header — try to parse
            const data = JSON.parse(text);
            return jsonResponse({ ok: true, site, group, endpoint, data });
          }
          errors.push({
            endpoint,
            error: `Unexpected content-type: ${ct} (looks like HTML)`,
          });
          continue;
        }

        const data = await res.json();
        return jsonResponse({ ok: true, site, group, endpoint, data });
      } catch (e) {
        errors.push({ endpoint, error: String(e?.message || e) });
      }
    }
  }

  // If we got here, everything failed
  return jsonResponse(
    {
      ok: false,
      message: 'DK: all endpoints failed',
      site,
      group,
      errors,
    },
    502
  );
}

// Utility: JSON + CORS
function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
    },
  });
}
