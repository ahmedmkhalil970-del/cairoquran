// Daily insights: collects account and per-post numbers from Facebook, Instagram and YouTube into one JSON snapshot,
// so the daily analyst reads a small file instead of dashboards. Every metric is fetched defensively: a metric the
// API refuses is left out and named in "errors", the rest still lands.
// Usage: node insights.mjs <out-dir> <history.json>   Env: META_TOKEN, FB_PAGE_ID, IG_USER_ID, YT_API_KEY (all optional)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const [outDir, histFile] = process.argv.slice(2);
const { FB_PAGE_ID, IG_USER_ID, YT_API_KEY } = process.env;
let META_TOKEN = process.env.META_TOKEN;
const GRAPH = 'https://graph.facebook.com/v21.0';
const DAYS = 21;                                   // posts from the last three weeks
const since = Date.now() - DAYS * 86400e3;
const errors = [];
mkdirSync(outDir, { recursive: true });

async function get(url) {
  const r = await fetch(url); const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error ? j.error.message : String(r.status));
  return j;
}
const graph = (path, params = {}) => get(`${GRAPH}/${path}?${new URLSearchParams({ ...params, access_token: META_TOKEN })}`);
// Ask for a set of insight metrics at once; if the API rejects the set, ask one by one and keep what works
async function metrics(path, list, extra = {}, edge = 'insights') {
  const pick = d => Object.fromEntries((d.data || []).map(m => [m.name, m.values?.[0]?.value ?? m.total_value?.value ?? null]));
  try { return pick(await graph(`${path}/${edge}`, { metric: list.join(','), ...extra })); }
  catch {
    const out = {};
    for (const m of list) { try { Object.assign(out, pick(await graph(`${path}/${edge}`, { metric: m, ...extra }))); } catch (e) { errors.push(`${path} ${m}: ${e.message}`.slice(0, 160)); } }
    return out;
  }
}
const first = s => (s || '').split('\n').find(l => l.trim()) || '';

async function facebook() {
  const page = await graph(FB_PAGE_ID, { fields: 'name,followers_count,fan_count' });
  const posts = [];
  const reels = await graph(`${FB_PAGE_ID}/video_reels`, { fields: 'id,description,created_time,permalink_url,length', limit: 50 }).catch(e => { errors.push('fb reels: ' + e.message); return { data: [] }; });
  for (const v of reels.data.filter(v => Date.parse(v.created_time) > since)) {
    const counts = await graph(v.id, { fields: 'likes.summary(true).limit(0),comments.summary(true).limit(0)' }).catch(() => ({}));
    posts.push({ kind: 'reel', id: v.id, at: v.created_time, length: v.length, text: first(v.description), url: v.permalink_url,
      likes: counts.likes?.summary?.total_count, comments: counts.comments?.summary?.total_count,
      ...await metrics(v.id, ['blue_reels_play_count', 'fb_reels_total_plays', 'post_impressions_unique', 'post_video_avg_time_watched', 'post_video_followers', 'post_video_social_actions'], {}, 'video_insights') });
  }
  const feed = await graph(`${FB_PAGE_ID}/posts`, { fields: 'id,message,created_time,permalink_url,shares,reactions.summary(true).limit(0),comments.summary(true).limit(0)', limit: 50 }).catch(e => { errors.push('fb posts: ' + e.message); return { data: [] }; });
  for (const p of feed.data.filter(p => Date.parse(p.created_time) > since)) {
    posts.push({ kind: 'post', id: p.id, at: p.created_time, text: first(p.message), url: p.permalink_url,
      reactions: p.reactions?.summary?.total_count, comments: p.comments?.summary?.total_count, shares: p.shares?.count || 0,
      ...await metrics(p.id, ['post_impressions_unique', 'post_clicks']) });
  }
  return { name: page.name, followers: page.followers_count, likes: page.fan_count, posts };
}

async function instagram() {
  const acc = await graph(IG_USER_ID, { fields: 'username,followers_count,follows_count,media_count' });
  const media = await graph(`${IG_USER_ID}/media`, { fields: 'id,caption,media_type,media_product_type,timestamp,like_count,comments_count,permalink', limit: 50 });
  const posts = [];
  for (const m of media.data.filter(m => Date.parse(m.timestamp) > since)) {
    const reel = m.media_product_type === 'REELS';
    posts.push({ kind: reel ? 'reel' : m.media_type.toLowerCase(), id: m.id, at: m.timestamp, text: first(m.caption), url: m.permalink, likes: m.like_count, comments: m.comments_count,
      ...await metrics(m.id, reel ? ['views', 'reach', 'saved', 'shares', 'total_interactions', 'ig_reels_avg_watch_time'] : ['views', 'reach', 'saved', 'shares', 'total_interactions']) });
  }
  const day = await metrics(IG_USER_ID, ['reach', 'profile_views', 'accounts_engaged', 'follows_and_unfollows'], { period: 'day', metric_type: 'total_value' });
  return { username: acc.username, followers: acc.followers_count, following: acc.follows_count, media: acc.media_count, yesterday: day, posts };
}

async function youtube() {
  const yt = (path, p) => get(`https://www.googleapis.com/youtube/v3/${path}?${new URLSearchParams({ ...p, key: YT_API_KEY })}`);
  const ch = (await yt('channels', { part: 'statistics,contentDetails', forHandle: 'CairoQuran' })).items?.[0];
  if (!ch) throw new Error('channel @CairoQuran not found');
  const up = await yt('playlistItems', { part: 'contentDetails', playlistId: ch.contentDetails.relatedPlaylists.uploads, maxResults: 50 });
  const ids = (up.items || []).map(i => i.contentDetails.videoId);
  const vids = ids.length ? (await yt('videos', { part: 'snippet,statistics,contentDetails', id: ids.join(',') })).items : [];
  return { subscribers: +ch.statistics.subscriberCount, views: +ch.statistics.viewCount, videos: +ch.statistics.videoCount,
    posts: vids.filter(v => Date.parse(v.snippet.publishedAt) > since).map(v => ({ kind: 'short', id: v.id, at: v.snippet.publishedAt, text: v.snippet.title,
      duration: v.contentDetails.duration, views: +v.statistics.viewCount || 0, likes: +v.statistics.likeCount || 0, comments: +v.statistics.commentCount || 0 })) };
}

// A user token in the secret: use the Page's own token for page calls
if (META_TOKEN && FB_PAGE_ID) {
  try { const me = await graph('me', { fields: 'id' }); if (me.id !== FB_PAGE_ID) { const p = await graph(FB_PAGE_ID, { fields: 'access_token' }); if (p.access_token) META_TOKEN = p.access_token; } }
  catch (e) { errors.push('token: ' + e.message); }
}
const snap = { date: new Date().toISOString().slice(0, 10), collected_at: new Date().toISOString() };
const run = async (name, ok, fn) => { if (!ok) { snap[name] = { missing: 'credentials' }; return; } try { snap[name] = await fn(); } catch (e) { snap[name] = { error: e.message }; } };
await run('facebook', META_TOKEN && FB_PAGE_ID, facebook);
await run('instagram', META_TOKEN && IG_USER_ID, instagram);
await run('youtube', YT_API_KEY, youtube);
snap.tiktok = { missing: 'no API access; numbers are posted by hand on issue #4' };
snap.errors = errors;

// Follower history, one row per day, for trends
const hist = (() => { try { return JSON.parse(readFileSync(histFile, 'utf8')); } catch { return []; } })().filter(r => r.date !== snap.date);
hist.push({ date: snap.date, facebook: snap.facebook.followers ?? null, instagram: snap.instagram.followers ?? null, youtube: snap.youtube.subscribers ?? null });
writeFileSync(histFile, JSON.stringify(hist.slice(-400), null, 1));
writeFileSync(join(outDir, `${snap.date}.json`), JSON.stringify(snap, null, 1));
writeFileSync(join(outDir, 'latest.json'), JSON.stringify(snap, null, 1));
console.log(`facebook: ${snap.facebook.followers ?? snap.facebook.missing ?? snap.facebook.error}; instagram: ${snap.instagram.followers ?? snap.instagram.missing ?? snap.instagram.error}; youtube: ${snap.youtube.subscribers ?? snap.youtube.missing ?? snap.youtube.error}; ${errors.length} metric errors`);
