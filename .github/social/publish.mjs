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
const { FB_PAGE_ID, IG_USER_ID, YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN } = process.env;
let META_TOKEN = process.env.META_TOKEN;
const USER_TOKEN = META_TOKEN;
const WINDOW = (cfg.window_hours || 6) * 3600e3;   // an item later than this is skipped, not posted late
let now = process.env.NOW ? Date.parse(process.env.NOW) : Date.now();   // NOW: for testing only
// LOOP_MINUTES: stay up this long and post each item at its minute (GitHub's frequent schedules fire late or not at all)
const LOOP = +(process.env.LOOP_MINUTES || 0);
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
// A per-platform caption (captions.facebook / captions.instagram) wins over the shared one
const forPlatform = (it, pf) => ({ ...it, caption: it.captions?.[pf] || it.caption });

// Each capability the publisher and the daily insights need, tried read-only; nothing is posted
async function diagnose() {
  const t = async (label, path, params) => { try { await graph(path, params, 'GET'); log(`  ok   ${label}`); } catch (e) { log(`  FAIL ${label}: ${e.message.slice(0, 140)}`); } };
  try {
    const d = (await (await fetch(`${GRAPH}/debug_token?input_token=${USER_TOKEN}&access_token=${USER_TOKEN}`)).json()).data || {};
    log(`  info secret token: type ${d.type || '?'}, expires ${d.expires_at ? (d.expires_at === 0 ? 'never' : new Date(d.expires_at * 1000).toISOString().slice(0, 10)) : 'never'}, valid ${d.is_valid}`);
    const need = ['pages_show_list', 'pages_read_engagement', 'pages_read_user_content', 'pages_manage_posts', 'read_insights', 'instagram_basic', 'instagram_content_publish', 'instagram_manage_insights'];
    const miss = need.filter(x => !(d.scopes || []).includes(x));
    log(miss.length ? `  FAIL permissions missing: ${miss.join(', ')}` : '  ok   all permissions granted');
  } catch (e) { log('  info debug_token unavailable: ' + e.message); }
  try { const me = await graph('me', { fields: 'id,name' }, 'GET'); log(me.id === FB_PAGE_ID ? `  ok   token type: page token ("${me.name}")` : `  FAIL token type: not the page's token (it belongs to "${me.name}"); publishing to the page needs the Page access token from me/accounts`); }
  catch (e) { log(`  FAIL token: ${e.message}`); }
  if (FB_PAGE_ID) {
    await t('facebook: read posts (pages_read_engagement, pages_read_user_content)', `${FB_PAGE_ID}/posts`, { limit: 1 });
    await t('facebook: read reels', `${FB_PAGE_ID}/video_reels`, { limit: 1 });
    await t('facebook: page insights (read_insights)', `${FB_PAGE_ID}/insights`, { metric: 'page_follows', period: 'day' });
  }
  if (IG_USER_ID) {
    await t('instagram: publishing allowed (instagram_content_publish)', `${IG_USER_ID}/content_publishing_limit`, {});
    const m = await graph(`${IG_USER_ID}/media`, { limit: 1, fields: 'id' }, 'GET').catch(() => ({ data: [] }));
    if (m.data[0]) await t('instagram: post insights (instagram_manage_insights)', `${m.data[0].id}/insights`, { metric: 'reach' });
  }
}

async function check() {
  if (META_TOKEN) await diagnose();
  if (META_TOKEN) {
    const p = await graph(FB_PAGE_ID || 'me', { fields: 'name,instagram_business_account{username}' }, 'GET');
    log(`meta: page "${p.name}"${p.instagram_business_account ? `, instagram @${p.instagram_business_account.username} (IG_USER_ID ${p.instagram_business_account.id})` : ''}`);
  } else log('meta: no token');
  log('youtube:', can.youtube ? 'credentials present' : 'no credentials');
}

// The secret may hold a user token instead of the Page's own token: the page token is then fetched from it
// (it lasts as long as the user token; a page token taken from a long-lived user token does not expire)
if (META_TOKEN && FB_PAGE_ID) {
  try {
    const me = await graph('me', { fields: 'id' }, 'GET');
    if (me.id !== FB_PAGE_ID) { const p = await graph(FB_PAGE_ID, { fields: 'access_token' }, 'GET'); if (p.access_token) { META_TOKEN = p.access_token; log('using the page token derived from the user token'); } }
  } catch (e) { log('token check failed: ' + e.message); }
}
if (mode === 'check') await check();
let posted = 0, failed = 0;
// Releases to publish: every content-<week> release from cfg.from on (so new weeks need no change here), minus cfg.exclude
async function releases() {
  const list = new Set(cfg.releases || []);
  if (cfg.from) {
    const h = process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {};
    for (let page = 1; page <= 5; page++) {
      const r = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=100&page=${page}`, { headers: h });
      if (!r.ok) throw new Error(`release list: ${r.status} ${(await r.text()).slice(0, 120)}`);
      const j = await r.json();
      j.filter(x => /^content-\d{4}-\d{2}-\d{2}$/.test(x.tag_name) && x.tag_name >= cfg.from).forEach(x => list.add(x.tag_name));
      if (j.length < 100) break;
    }
  }
  return [...list].filter(t => !(cfg.exclude || []).includes(t)).sort();
}
let schedules = [], loadedAt = 0;
async function load() {
  schedules = [];
  for (const tag of await releases()) {
    const r = await fetch(`https://github.com/${REPO}/releases/download/${tag}/schedule.json`);
    if (!r.ok) { log(`${tag}: no schedule.json (${r.status})`); continue; }
    schedules.push([tag, (await r.json()).items]);
  }
  loadedAt = Date.now();
}
async function pass() {
  for (const [tag, items] of schedules) {
    for (const it of items) {
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
          const id = await POST[pf](forPlatform(it, pf));
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
}
const deadline = Date.now() + LOOP * 60e3;
for (;;) {
  // New or re-rendered weeks are picked up every half hour; a failed refresh keeps the schedules already loaded
  if (Date.now() - loadedAt > 30 * 60e3) {
    try { await load(); } catch (e) { if (!loadedAt) throw e; log('schedule refresh failed, keeping the last one: ' + e.message); loadedAt = Date.now(); }
  }
  await pass();
  writeFileSync(stateFile, JSON.stringify(state, null, 2));
  if (mode === 'check' || Date.now() + 60e3 > deadline) break;
  await sleep(60e3);
  if (!process.env.NOW) now = Date.now();
}
writeFileSync(stateFile, JSON.stringify(state, null, 2));
log(`done: ${posted} posted, ${failed} failed${dry ? ' (dry run)' : ''}`);
process.exit(failed ? 1 : 0);
