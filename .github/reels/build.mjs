// Builds Cairo Quran reels from samples.json: fetches verse words, recitation audio and word timings
// from the quran.com API, the reciter photo from Wikimedia Commons, renders reel.html frame by frame
// with Playwright and muxes the frames with the recitation using ffmpeg. Output: out/<id>.mp4
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'out');
const FPS = 30, INTRO = 1.6, OUTRO = 3.4;
const API = 'https://api.quran.com/api/v4';
const UA = { 'user-agent': 'CairoQuran-Reels/1.0 (https://cairoquran.com; contact@cairoquran.com)' };
const ar = n => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);

const getJSON = async u => { const r = await fetch(u, { headers: UA }); if (!r.ok) throw new Error(`${r.status} ${u}`); return r.json(); };
const getBuf = async u => { const r = await fetch(u, { headers: UA }); if (!r.ok) throw new Error(`${r.status} ${u}`); return Buffer.from(await r.arrayBuffer()); };
const sh = (cmd, args) => execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 1 << 28 });
const duration = f => parseFloat(sh('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());

async function verseData(key, recitation) {
  const j = await getJSON(`${API}/verses/by_key/${key}?words=true&word_fields=text_uthmani&audio=${recitation}`);
  const v = j.verse;
  const words = v.words.filter(w => w.char_type_name === 'word').map(w => ({ pos: w.position, text: w.text_uthmani }));
  const audio = v.audio || {};
  if (!audio.url) throw new Error(`no audio for ${key} recitation ${recitation}`);
  const url = audio.url.startsWith('http') ? audio.url : (audio.url.startsWith('//') ? 'https:' + audio.url : 'https://verses.quran.com/' + audio.url);
  return { key, words, url, segments: audio.segments || [] };
}

async function build(s, browser) {
  console.log(`== ${s.id}`);
  const tmp = join(OUT, 'tmp-' + s.id); rmSync(tmp, { recursive: true, force: true }); mkdirSync(join(tmp, 'f'), { recursive: true });
  const verses = [];
  for (const k of s.verses) verses.push(await verseData(k, s.recitation));

  // audio: download each ayah, note its length, join into one track
  let offset = 0; const words = []; const list = [];
  for (const [i, v] of verses.entries()) {
    const f = join(tmp, `a${i}.mp3`); writeFileSync(f, await getBuf(v.url)); list.push(`file '${f}'`);
    const d = duration(f);
    const seg = new Map();
    for (const sg of v.segments) { if (sg.length >= 3) seg.set(sg[0], [sg[sg.length - 2] / 1000, sg[sg.length - 1] / 1000]); }
    const timed = v.words.every(w => seg.has(w.pos));
    console.log(`  ${v.key}: ${d.toFixed(1)}s, ${v.words.length} words, timings: ${timed ? 'yes' : 'no (even spread)'}`);
    v.words.forEach((w, j) => {
      const [a, b] = timed ? seg.get(w.pos) : [d * j / v.words.length, d * (j + 1) / v.words.length];
      words.push({ text: w.text, start: offset + a, end: offset + b });
    });
    words.push({ text: '﴿' + ar(v.key.split(':')[1]) + '﴾', mark: true, start: offset + d - .2, end: offset + d });
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

  const img = await getBuf(s.photo);
  const photo = 'data:image/jpeg;base64,' + img.toString('base64');
  const first = s.verses[0].split(':')[1], last = s.verses[s.verses.length - 1].split(':')[1];
  const ref = `${s.surah} · ${first === last ? 'الآية ' + ar(first) : 'الآيات ' + ar(first) + '–' + ar(last)}`;
  const total = INTRO + audioLen + OUTRO;

  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await page.goto('file://' + join(HERE, 'reel.html'));
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(d => setup(d), { style: s.style, photo, reciter: s.reciter, label: s.label, words, ref, total, intro: INTRO, outro: OUTRO, env: envN });
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
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-r', String(FPS),
    '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', mp4]);
  sh('ffmpeg', ['-loglevel', 'error', '-y', '-ss', String(INTRO + Math.min(audioLen * .6, audioLen - .5)), '-i', mp4, '-frames:v', '1', '-vf', 'scale=540:-1', join(OUT, s.id + '.jpg')]);
  rmSync(tmp, { recursive: true, force: true });
  console.log(`  -> ${mp4} (${total.toFixed(1)}s)`);
}

const samples = JSON.parse(readFileSync(join(HERE, 'samples.json'), 'utf8'));
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
let failed = 0;
for (const s of samples) { try { await build(s, browser); } catch (e) { failed++; console.error(`!! ${s.id}: ${e.message}`); } }
await browser.close();
process.exit(failed === samples.length ? 1 : 0);
