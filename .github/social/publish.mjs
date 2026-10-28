// Publishes the content releases on their schedule: reads schedule.json from each release named in config.json and
// posts every item that is due to Facebook, Instagram and (when enabled) YouTube through the platforms' own APIs.
// What was posted is kept in published.json (an asset of the "social-log" release), so nothing is posted twice.
// Usage: node publish.mjs <published.json> [run|check]
// Secrets (env): META_TOKEN (Page access token), FB_PAGE_ID, IG_USER_ID, YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN.
// Without them, or with "dry_run": true in config.json, it only lists what it would post.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const [stateFile, mode = 'run'] = process.argv.slice(2);
const cfg = JSON.parse(readFileSync(join(HERE, 'config.json'), 'utf8'));
const REPO = process.env.GITHUB_REPOSITORY || 'ahmedmkhalil970-del/cairoquran';
const GRAPH = 'https://graph.facebook.com/v21.0';
const { META_TOKEN, FB_PAGE_ID, IG_USER_ID, YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN } = process.env;
const WINDOW = (cfg.window_hours || 6) * 3600e3;   // an item later than this is skipped, not posted late
const now = process.env.NOW ? Date.parse(process.env.NOW) : Date.now();   // NOW: for testing only
const state = (() => { try { return JSON.parse(readFileSync(stateFile, 'utf8')); } catch { return {}; } })();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const can = {
  facebook: !!(META_TOKEN && FB_PAGE_ID),
  instagram: !!(META_TOKEN && IG_USER_ID),
  youtube: !!(YT_CLIENT_ID && YT_CLIENT_SECRET && YT_REFRESH_TOKEN),
};
const dry = cfg.dry_run || mode !== 'run';

async function graph(path, params = {}, method = 'POST') {
  const body = new URLSearchParams({ ...params, access_token: META_TOKEN });
  const r = method === 'GET' ? await fetch(`${GRAPH}/${path}?${body}`) : await fetch(`${GRAPH}/${path}`, { method, body });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(`${path}: ${j.error ? j.error.message : r.status}`);
  return j;
}
// Release downloads redirect to a short-lived signed URL; the platforms fetch that one directly
async function direct(url) {
  const r = await fetch(url, { redirect: 'manual' });
  return r.headers.get('location') || url;
}

async function facebook(it) {
  if (it.type === 'post') {
    const j = await graph(`${FB_PAGE_ID}/photos`, { url: await direct(it.url), caption: it.caption });
    if (it.first_comment?.facebook) await graph(`${j.post_id || j.id}/comments`, { message: it.first_comment.facebook });
    return j.post_id || j.id;
  }
  const s = await graph(`${FB_PAGE_ID}/video_reels`, { upload_phase: 'start' });
  const up = await fetch(s.upload_url, { method: 'POST', headers: { Authorization: `OAuth ${META_TOKEN}`, file_url: await direct(it.url) } });
  if (!up.ok) throw new Error(`facebook upload: ${up.status} ${await up.text()}`);
  await graph(`${FB_PAGE_ID}/video_reels`, { upload_phase: 'finish', video_id: s.video_id, video_state: 'PUBLISHED', description: it.caption });
  return s.video_id;
}

async function instagram(it) {
  const p = it.type === 'post'
    ? { image_url: await direct(it.url), caption: it.caption }
    : { media_type: 'REELS', video_url: await direct(it.url), caption: it.caption, share_to_feed: 'true', ...(it.cover ? { cover_url: await direct(it.cover) } : {}) };
  const c = await graph(`${IG_USER_ID}/media`, p);
  for (let i = 0; i < 40; i++) {
    const s = await graph(c.id, { fields: 'status_code' }, 'GET');
    if (s.status_code === 'FINISHED') break;
    if (s.status_code === 'ERROR' || s.status_code === 'EXPIRED') throw new Error(`instagram container ${s.status_code}`);
    await sleep(10e3);
  }
  return (await graph(`${IG_USER_ID}/media_publish`, { creation_id: c.id })).id;
}

async function youtube(it) {
  if (it.type !== 'reel') return 'skipped (not a video)';
  const t = await (await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({
    client_id: YT_CLIENT_ID, client_secret: YT_CLIENT_SECRET, refresh_token: YT_REFRESH_TOKEN, grant_type: 'refresh_token' }) })).json();
  if (!t.access_token) throw new Error('youtube token: ' + (t.error_description || t.error));
  const video = Buffer.from(await (await fetch(it.url)).arrayBuffer());
  const meta = { snippet: { title: (it.title || it.caption.split('\n')[0]).slice(0, 100), description: it.caption, categoryId: '22', defaultLanguage: 'ar' },
    status: { privacyStatus: 'public', selfDeclaredMadeForKids: false } };
  const s = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', { method: 'POST',
    headers: { Authorization: `Bearer ${t.access_token}`, 'Content-Type': 'application/json', 'X-Upload-Content-Type': 'video/mp4', 'X-Upload-Content-Length': String(video.length) },
    body: JSON.stringify(meta) });
  if (!s.ok) throw new Error(`youtube start: ${s.status} ${await s.text()}`);
  const u = await fetch(s.headers.get('location'), { method: 'PUT', headers: { 'Content-Type': 'video/mp4' }, body: video });
  const j = await u.json().catch(() => ({}));
  if (!u.ok) throw new Error(`youtube upload: ${u.status} ${JSON.stringify(j.error || j)}`);
  return j.id;
}
const POST = { facebook, instagram, youtube };

async function check() {
  if (META_TOKEN) {
    const p = await graph(FB_PAGE_ID || 'me', { fields: 'name,instagram_business_account{username}' }, 'GET');
    log(`meta: page "${p.name}"${p.instagram_business_account ? `, instagram @${p.instagram_business_account.username} (IG_USER_ID ${p.instagram_business_account.id})` : ''}`);
  } else log('meta: no token');
  log('youtube:', can.youtube ? 'credentials present' : 'no credentials');
}

if (mode === 'check') await check();
let posted = 0, failed = 0;
for (const tag of cfg.releases) {
  const r = await fetch(`https://github.com/${REPO}/releases/download/${tag}/schedule.json`);
  if (!r.ok) { log(`${tag}: no schedule.json (${r.status})`); continue; }
  for (const it of (await r.json()).items) {
    const at = Date.parse(it.at);
    const pfs = it.platforms.filter(p => cfg.platforms.includes(p));
    if (mode === 'check') { if (at > now - WINDOW && at < now + 86400e3) log(`next 24h: ${tag}/${it.id} at ${it.at} on ${pfs.join(', ')}`); continue; }
    if (at > now) continue;
    for (const pf of pfs) {
      const key = `${tag}/${it.id}/${pf}`;
      if (state[key]?.id || state[key]?.tries >= 3) continue;
      if (now - at > WINDOW) { if (!state[key]) { state[key] = { skipped: 'late', at: new Date().toISOString() }; log(`late, skipped: ${key}`); } continue; }
      if (dry || !can[pf]) { log(`${dry ? 'would post' : 'no credentials for'}: ${key} (${it.at})`); continue; }
      try {
        const id = await POST[pf](it);
        state[key] = { id, at: new Date().toISOString() }; posted++;
        log(`posted: ${key} -> ${id}`);
      } catch (e) {
        failed++;
        state[key] = { error: String(e.message).slice(0, 300), tries: (state[key]?.tries || 0) + 1, at: new Date().toISOString() };
        log(`FAILED: ${key}: ${e.message}`);
      }
    }
  }
}
writeFileSync(stateFile, JSON.stringify(state, null, 2));
log(`done: ${posted} posted, ${failed} failed${dry ? ' (dry run)' : ''}`);
process.exit(failed ? 1 : 0);
