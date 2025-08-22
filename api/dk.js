// /api/dk.js  – Vercel Edge Function to proxy DraftKings MLB event groups
export const config = { runtime: 'edge' };

const SITES = ['US-NJ', 'US-NY', 'US-PA', 'US-MA', 'US-IL', 'US-CO', 'US-AZ'];

export default async function handler(req) {
  const url = new URL(req.url);
  const site = url.searchParams.get('site') || 'US-NJ';
  const group = url.searchParams.get('group'); // e.g. 84240 (MLB Game Lines) or other group ids
  const now = Date.now();

  // Build paths:
  // - no group => list MLB sport (contains eventGroups with ids)
  // - with group => fetch that eventgroup
  const paths = group
    ? [`/sites/${site}/api/v5/eventgroups/${group}?format=json&t=${now}`]
    : [`/sites/${site}/api/v5/sports/baseball/mlb?format=json&t=${now}`];

  // Try both primary & us-nj subdomain, some regions vary
  const hosts = [
    `https://sportsbook.draftkings.com`,
    `https://sportsbook-us-nj.draftkings.com`,
  ];

  const headers = {
    'Accept': 'application/json, text/plain, */*',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
    'Referer': 'https://sportsbook.draftkings.com/',
  };

  const errors = [];
  for (const h of hosts) {
    for (const p of paths) {
      const endpoint = `${h}${p}`;
      try {
        const res = await fetch(endpoint, { headers, cf: { cacheTtl: 0 } });
        const ct = res.headers.get('content-type') || '';
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        if (!ct.includes('application/json')) {
          throw new Error(`Unexpected content-type: ${ct} (looks like HTML)`);
        }
        const data = await res.json();
        return new Response(JSON.stringify({ ok: true, site, group: group ?? null, endpoint, data }, null, 2), {
          status: 200,
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store',
            'access-control-allow-origin': '*',
          },
        });
      } catch (e) {
        errors.push({ endpoint, error: String(e.message || e) });
      }
    }
  }

  return new Response(JSON.stringify({ ok: false, message: 'DK: all endpoints failed', site, group: group ?? null, errors }, null, 2), {
    status: 502,
    headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' },
  });
}
