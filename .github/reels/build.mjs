// Builds Cairo Quran reels from a batch file (env BATCH_FILE, else the one named in ./current): fetches verse words, recitation audio and word timings
// from the quran.com API, the reciter photo from Wikimedia Commons, renders reel.html frame by frame
// with Playwright and muxes the frames with the recitation using ffmpeg. Output: out/<id>.mp4
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BATCH = process.env.BATCH_FILE || (() => { try { return join(HERE, readFileSync(join(HERE, 'current'), 'utf8').trim()); } catch { return join(HERE, 'samples.json'); } })();
const OUT = process.env.OUT_DIR || join(HERE, 'out', BATCH.replace(/^.*\//, '').replace(/\.json$/, ''));
const FPS = 30, INTRO = 0.3, OUTRO = 2.6; // the recitation starts at once: the first second decides whether a viewer stays
const API = 'https://api.quran.com/api/v4';
const UA = { 'user-agent': 'CairoQuran-Reels/1.0 (https://cairoquran.com; contact@cairoquran.com)' };
const ar = n => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);

function radiosLine(html) {
  // "إذاعات القرآن الكريم من مصر والسعودية", read from the live-radio group in the site's station list
  const g = html.indexOf("title: 'إذاعات مباشرة'"), e = g < 0 ? -1 : html.indexOf('] }', g);
  const places = g < 0 ? [] : [...html.slice(g, e).matchAll(/name: 'إذاعة القرآن الكريم · ([^']+)'/g)].map(m => m[1].trim() === 'القاهرة' ? 'مصر' : m[1].trim());
  const list = [...new Set(places)];
  if (!list.length) return 'إذاعات القرآن الكريم';
  return 'إذاعات القرآن الكريم من ' + list.join(' و');
}
const RADIOS = (() => { try { return radiosLine(readFileSync(join(HERE, '..', '..', 'index.html'), 'utf8')); } catch { return 'إذاعات القرآن الكريم'; } })();

// Landmark photos with their credits, from the PLACES table the site itself shows (index.html): [key, path, author, licence, ...]
const PLACES = (() => { try {
  const h = readFileSync(join(HERE, '..', '..', 'index.html'), 'utf8'), g = h.slice(h.indexOf('const PLACES = ['), h.indexOf('];', h.indexOf('const PLACES = [')));
  return [...g.matchAll(/\["([^"]+)", "([^"]+)", "([^"]*)", "([^"]*)"/g)].map(m => ({ key: m[1], src: m[2].startsWith('http') ? m[2] : 'https://upload.wikimedia.org/wikipedia/commons/thumb/' + m[2], by: m[3], lic: m[4] }));
} catch { return []; } })();
const place = (key, n = 0) => PLACES.filter(p => p.key === key)[n];
const getJSON = async u => { const r = await fetch(u, { headers: UA }); if (!r.ok) throw new Error(`${r.status} ${u}`); return r.json(); };
const getBuf = async u => { const r = await fetch(u, { headers: UA }); if (!r.ok) throw new Error(`${r.status} ${u}`); return Buffer.from(await r.arrayBuffer()); };
const sh = (cmd, args) => execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 1 << 28 });
const duration = f => parseFloat(sh('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());

// Word text from quran.com; audio and per-word timings from the chapter recordings quran.com itself uses (QDC).
const getWords = async key => {
  const j = await getJSON(`${API}/verses/by_key/${key}?words=true&word_fields=text_uthmani`);
  return j.verse.words.filter(w => w.char_type_name === 'word').map(w => ({ pos: w.position, text: w.text_uthmani.replace(/۞\s*/g, '').trim() })).filter(w => w.text);
};
async function chapterAudio(recitation, chapter, dir) {
  const j = await getJSON(`https://api.qurancdn.com/api/qdc/audio/reciters/${recitation}/audio_files?chapter=${chapter}&segments=true`);
  const f = (j.audio_files || [])[0];
  if (!f || !f.audio_url) return null;
  const file = join(dir, `ch${chapter}.mp3`);
  writeFileSync(file, await getBuf(f.audio_url));
  const timings = new Map((f.verse_timings || []).map(v => [v.verse_key, v]));
  return { file, timings };
}
async function verseFallback(key, recitation) {
  const j = await getJSON(`${API}/verses/by_key/${key}?audio=${recitation}`);
  const a = j.verse.audio || {};
  if (!a.url) throw new Error(`no audio for ${key} recitation ${recitation}`);
  return a.url.startsWith('http') ? a.url : (a.url.startsWith('//') ? 'https:' + a.url : 'https://verses.quran.com/' + a.url);
}

async function build(s, browser) {
  console.log(`== ${s.id}`);
  const tmp = join(OUT, 'tmp-' + s.id); rmSync(tmp, { recursive: true, force: true }); mkdirSync(join(tmp, 'f'), { recursive: true });
  const chapter = s.verses[0].split(':')[0];
  let ch = null;
  try { ch = await chapterAudio(s.recitation, chapter, tmp); } catch (e) { console.log(`  chapter audio unavailable: ${e.message}`); }
  let offset = 0; const words = []; const list = []; const plain = [];
  for (const [i, key] of s.verses.entries()) {
    const ws = await getWords(key);
    const f = join(tmp, `a${i}.wav`);
    const vt = ch && ch.timings.get(key);
    let seg = new Map();
    if (vt) {
      const from = vt.timestamp_from / 1000, to = vt.timestamp_to / 1000;
      sh('ffmpeg', ['-loglevel', 'error', '-y', '-ss', String(from), '-to', String(to), '-i', ch.file, '-ar', '44100', '-ac', '2', f]);
      for (const sg of vt.segments || []) if (sg.length >= 3) seg.set(sg[0], [sg[sg.length - 2] / 1000 - from, sg[sg.length - 1] / 1000 - from]);
    } else {
      const mp3 = join(tmp, `a${i}.mp3`); writeFileSync(mp3, await getBuf(await verseFallback(key, s.recitation)));
      sh('ffmpeg', ['-loglevel', 'error', '-y', '-i', mp3, '-ar', '44100', '-ac', '2', f]);
    }
    list.push(`file '${f}'`);
    const d = duration(f);
    const timed = ws.every(w => seg.has(w.pos));
    console.log(`  ${key}: ${d.toFixed(1)}s, ${ws.length} words, word timings: ${timed ? 'yes' : 'no (even spread)'}`);
    ws.forEach((w, j) => {
      const [a, b] = timed ? seg.get(w.pos) : [d * j / ws.length, d * (j + 1) / ws.length];
      words.push({ text: w.text, start: offset + Math.max(0, a), end: offset + Math.max(a, b) });
    });
    plain.push(ws.map(w => w.text).join(' ') + ' ﴿' + ar(key.split(':')[1]) + '﴾');
    words.push({ text: '﴿' + ar(key.split(':')[1]) + '﴾', mark: true, start: offset + d - .25, end: offset + d });
    offset += d;
  }
  writeFileSync(join(tmp, 'list.txt'), list.join('\n'));
  const wav = join(tmp, 'all.wav');
  sh('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', join(tmp, 'list.txt'), '-ar', '44100', '-ac', '2', wav]);
  const audioLen = duration(wav);

  // loudness envelope at 30 values per second, for the "wave" style
  const pcm = sh('ffmpeg', ['-loglevel', 'error', '-i', wav, '-ac', '1', '-ar', '8000', '-f', 's16le', '-']);
  const per = Math.round(8000 / FPS), env = [];
  for (let i = 0; i + per * 2 <= pcm.length; i += per * 2) { let q = 0; for (let j = 0; j < per; j++) { const x = pcm.readInt16LE(i + j * 2) / 32768; q += x * x; } env.push(Math.sqrt(q / per)); }
  const peak = Math.max(...env, 1e-6); const envN = env.map(x => +(Math.min(1, x / peak)).toFixed(3));

  let bg = null, credit = null;
  if (s.background) {
    const pl = place(s.background, s.background_n || 0);
    if (!pl) throw new Error(`no place "${s.background}" in index.html`);
    bg = 'data:image/jpeg;base64,' + (await getBuf(pl.src)).toString('base64');
    credit = `الصورة: ${pl.key}${pl.by ? ' · ' + pl.by : ''} · ${pl.lic}`;
  }
  const img = await getBuf(s.photo);
  const photo = 'data:image/jpeg;base64,' + img.toString('base64');
  const first = s.verses[0].split(':')[1], last = s.verses[s.verses.length - 1].split(':')[1];
  const ref = `${s.surah} · ${first === last ? 'الآية ' + ar(first) : 'الآيات ' + ar(first) + '–' + ar(last)}`;
  const total = INTRO + audioLen + OUTRO;

  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await page.goto('file://' + join(HERE, 'reel.html'));
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(d => setup(d), { style: s.style, photo, reciter: s.reciter, label: s.label, words, ref, total, intro: INTRO, outro: OUTRO, env: envN, radios: RADIOS, bg, credit, series: s.series || null, hook: s.hook || null, note: s.note || null });
  await page.evaluate(() => Promise.all([...document.fonts].map(f => f.load())));
  await page.waitForTimeout(800);
  const frames = Math.ceil(total * FPS);
  for (let f = 0; f < frames; f++) {
    await page.evaluate(t => render(t), f / FPS);
    await page.screenshot({ path: join(tmp, 'f', String(f).padStart(5, '0') + '.jpg'), type: 'jpeg', quality: 90 });
  }
  await page.close();

  const mp4 = join(OUT, s.id + '.mp4');
  sh('ffmpeg', ['-loglevel', 'error', '-y', '-framerate', String(FPS), '-i', join(tmp, 'f', '%05d.jpg'), '-i', wav,
    '-filter_complex', `[1:a]adelay=${Math.round(INTRO * 1000)}|${Math.round(INTRO * 1000)},apad[a]`, '-map', '0:v', '-map', '[a]', '-shortest',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '23', '-maxrate', '2500k', '-bufsize', '5000k', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-r', String(FPS),
    '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', mp4]);
  sh('ffmpeg', ['-loglevel', 'error', '-y', '-ss', String(INTRO + Math.min(audioLen * .6, audioLen - .5)), '-i', mp4, '-frames:v', '1', '-vf', 'scale=540:-1', join(OUT, s.id + '.jpg')]);
  rmSync(tmp, { recursive: true, force: true });
  console.log(`  -> ${mp4} (${total.toFixed(1)}s)`);
  return { verse: plain.join(' '), ref };
}

const samples = JSON.parse(readFileSync(BATCH, 'utf8'));
// Guard: the recitation id must belong to the reciter and style named in the batch, or the item is skipped.
const qdc = (await getJSON('https://api.qurancdn.com/api/qdc/audio/reciters?locale=en')).reciters || [];
for (const s of samples) {
  const r = qdc.find(x => x.id === s.recitation);
  const label = r ? `${r.name} / ${r.style?.name || ''}`.toLowerCase() : '';
  console.log(`recitation ${s.recitation}: ${label || 'not found'}`);
  if (s.expect && !s.expect.every(k => label.includes(k))) { s.skip = `recitation ${s.recitation} is "${label}", expected ${s.expect.join(' + ')}`; }
}
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
let failed = 0;
const captions = [], made = [];
for (const s of samples) { if (s.skip) { failed++; console.error(`!! ${s.id}: ${s.skip}`); continue; } try { const r = await build(s, browser); const cap = s.caption ? s.caption.replace('{{verse}}', r.verse).replace('{{ref}}', r.ref) : ''; made.push({ id: s.id, file: s.id + '.mp4', cover: s.id + '.jpg', type: s.type || 'reel', at: s.at || null, when: s.when || '', platforms: s.platforms || ['facebook', 'instagram'], title: s.title ? s.title.replace('{{ref}}', r.ref) : null, caption: cap, meta: { series: s.series || null, style: s.style, background: s.background || null, hook: s.hook || null, reciter: s.reciter, recitation: s.recitation, verses: s.verses } }); if (s.caption) captions.push(`### ${s.id}${s.when ? ' · ' + s.when : ''}\n\n${s.caption.replace('{{verse}}', r.verse).replace('{{ref}}', r.ref)}\n`); } catch (e) { failed++; console.error(`!! ${s.id}: ${e.message}`); } }
if (captions.length) writeFileSync(join(OUT, 'captions.md'), captions.join('\n'));
writeFileSync(join(OUT, 'reels.json'), JSON.stringify(made, null, 2));
await browser.close();
process.exit(failed === samples.length ? 1 : 0);
