// Daily keep-alive: Vercel runs this once a day (see vercel.json).
// It reads one row from the "keepalive" table so Supabase sees activity
// and never pauses the free project.
// Keys come from Vercel env vars if set, otherwise from the site's own config.js.
module.exports = async (req, res) => {
  try {
    let url = process.env.SUPABASE_URL;
    let key = process.env.SUPABASE_ANON_KEY;
    if (!url || !key) {
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      const cfg = await (await fetch(`https://${host}/config.js`, { cache: 'no-store' })).text();
      url = url || (cfg.match(/supabaseUrl:\s*"([^"]+)"/) || [])[1];
      key = key || (cfg.match(/supabaseAnonKey:\s*"([^"]+)"/) || [])[1];
    }
    if (!url || !key) return res.status(500).json({ ok: false, error: 'Supabase keys missing in config.js' });
    const r = await fetch(`${url.replace(/\/$/, '')}/rest/v1/keepalive?select=id&limit=1`, {
      headers: { apikey: key },
      cache: 'no-store'
    });
    const body = await r.text();
    res.setHeader('Cache-Control', 'no-store');
    return res.status(r.ok ? 200 : 502).json({ ok: r.ok, status: r.status, at: new Date().toISOString(), body: body.slice(0, 200) });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
};
