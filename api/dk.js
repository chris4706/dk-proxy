// /api/dk.js – Vercel Serverless Edge Function to proxy DraftKings MLB event groups
export const config = { runtime: 'edge' };

export default async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const site = searchParams.get('site') || 'US-NJ';   // DraftKings site/state
    const group = searchParams.get('group') || '84240'; // MLB event group (all games)
    const path = `/sites/${site}/api/v5/eventgroups/${group}?format=json&t=${Date.now()}`;
    const dkUrl = `https://sportsbook.draftkings.com${path}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout

    const res = await fetch(dkUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
        'Referer': 'https://sportsbook.draftkings.com/'
      },
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!res.ok) {
      return new Response(JSON.stringify({ error: `DK returned ${res.status}` }), { status: res.status });
    }

    const data = await res.json();
    return new Response(JSON.stringify(data), {
      headers: { 'content-type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Unknown error' }), { status: 500 });
  }
}
