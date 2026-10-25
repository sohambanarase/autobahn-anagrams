// Daily keep-alive (Vercel cron, see vercel.json).
// Calls the ping() function in Supabase, which writes a timestamp, so the free
// project always shows real database activity and never gets paused.
// Keys: Vercel env vars if set, otherwise read from config.js (bundled with this function).
const fs = require('fs');
const path = require('path');

function keysFromText(t) {
  return {
    url: (t.match(/supabaseUrl:\s*"([^"]+)"/) || [])[1],
    key: (t.match(/supabaseAnonKey:\s*"([^"]+)"/) || [])[1]
  };
}

async function getKeys(req) {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY)
    return { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_ANON_KEY, from: 'env' };
  for (const p of [path.join(process.cwd(), 'config.js'), path.join(__dirname, '..', 'config.js')]) {
    try { const k = keysFromText(fs.readFileSync(p, 'utf8')); if (k.url && k.key) return { ...k, from: 'file' }; } catch (e) {}
  }
  try {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const k = keysFromText(await (await fetch(`https://${host}/config.js`, { cache: 'no-store' })).text());
    if (k.url && k.key) return { ...k, from: 'site' };
  } catch (e) {}
  return {};
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const { url, key, from } = await getKeys(req);
  if (!url || !key) return res.status(500).json({ ok: false, error: 'Supabase keys missing in config.js' });
  const base = url.replace(/\/$/, '') + '/rest/v1';
  const headers = { apikey: key, 'Content-Type': 'application/json' };
  const out = { at: new Date().toISOString(), keys: from };
  try {
    const w = await fetch(base + '/rpc/ping', { method: 'POST', headers, body: '{}', cache: 'no-store' });
    out.write = w.status; out.pinged = (await w.text()).slice(0, 80);
  } catch (e) { out.write = String(e); }
  try {
    const r = await fetch(base + '/keepalive?select=id,pinged_at,pings&limit=1', { headers, cache: 'no-store' });
    out.read = r.status; out.row = (await r.text()).slice(0, 160);
  } catch (e) { out.read = String(e); }
  out.ok = out.write === 200 || out.read === 200;
  if (out.write !== 200) out.hint = 'Run the latest supabase-setup.sql in Supabase so ping() exists.';
  console.log('keepalive', JSON.stringify(out));
  return res.status(out.ok ? 200 : 502).json(out);
};
