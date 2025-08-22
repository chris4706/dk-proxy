// /api/dk.js  — Vercel Serverless Edge Function to proxy DraftKings MLB event groups
export const config = { runtime: 'edge' };

export default async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const site  = searchParams.get('site')  || 'US-NJ';      // pin to a state feed
    const group = searchParams.get('group') || '84240';      // MLB event group
    const path  = `/sites/${site}/api/v5/eventgroups/${group}?format=json&t=${Date.now()}`;
    const dkUrl = `https://sportsbook.draftkings.com${path}`;

    const headers = {
      'Accept': 'application/json, text/plain, */*',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
      'Referer': 'https://sportsbook.draftkings.com/'
    };

    // Try twice (DK sometimes serves an HTML splash first)
    for (let i = 0; i < 2; i++) {
      const url = i === 0 ? dkUrl : dkUrl + `&u=${Date.now()}`;
      const res = await fetch(url, { headers, redirect: 'follow' });
      const text = await res.text();

      // If response header is JSON or body parses as JSON, return it
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        return new Response(text, { status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }});
      }
      try {
        const j = JSON.parse(text);
        return new Response(JSON.stringify(j), { status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }});
      } catch (_) {
        // fall through, retry once
      }
    }
    return new Response(JSON.stringify({ error: 'Non-JSON from DK' }), { status: 502, headers: { 'content-type': 'application/json' }});
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
}
