// "From the channel itself": records the Cairo Quran screen (the site served from this checkout, shown as on a TV)
// together with the live Cairo Quran Radio stream, and composes a 1080x1920 reel around it.
// Usage: node live.mjs <live.json> <dist-dir>   (expects the repo root served on http://127.0.0.1:8000/)
import { chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const [listFile, dist] = process.argv.slice(2);
const items = JSON.parse(readFileSync(listFile, 'utf8'));
const CAIRO = ['https://stream.radiojar.com/8s5u5tpdtwzuv', 'https://n12.radiojar.com/8s5u5tpdtwzuv', 'https://n0c.radiojar.com/8s5u5tpdtwzuv'];
mkdirSync(dist, { recursive: true });
const sh = (cmd, args) => execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'inherit'] });

const page_ = sub => `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Amiri:wght@700&family=Readex+Pro:wght@300;400;600&display=block">
<style>
*{margin:0;box-sizing:border-box}html,body{width:1080px;height:1920px;overflow:hidden}
body{background:radial-gradient(80% 50% at 50% 45%,rgba(232,194,122,.13),transparent 70%),linear-gradient(#0a1230,#22305c);color:#fdf6e9;font-family:"Readex Pro",sans-serif;position:relative}
.frame{position:absolute;inset:46px;border:2.5px solid rgba(232,194,122,.5)}
.brand{position:absolute;top:290px;left:0;right:0;text-align:center;font:700 50px Amiri;direction:ltr}.brand b{color:#e8c27a}
.live{position:absolute;top:380px;left:0;right:0;display:flex;justify-content:center;align-items:center;gap:16px;font:600 44px "Readex Pro"}
.live i{width:22px;height:22px;border-radius:50%;background:#e5484d;box-shadow:0 0 0 0 rgba(229,72,77,.6);animation:p 1.6s infinite}
@keyframes p{0%{box-shadow:0 0 0 0 rgba(229,72,77,.6)}100%{box-shadow:0 0 0 22px rgba(229,72,77,0)}}
.sub{position:absolute;top:460px;left:0;right:0;text-align:center;font:300 36px "Readex Pro";color:rgba(253,246,233,.85)}
.tv{position:absolute;top:620px;left:50%;width:1000px;height:563px;margin-left:-500px;border-radius:18px;overflow:hidden;border:6px solid #050816;box-shadow:0 0 0 3px rgba(232,194,122,.6),0 40px 90px rgba(0,0,0,.6)}
.tv{direction:ltr}.tv iframe{display:block;width:1920px;height:1080px;border:0;transform:scale(.5146);transform-origin:0 0}
.stand{position:absolute;top:1196px;left:50%;width:220px;height:14px;margin-left:-110px;border-radius:0 0 12px 12px;background:#050816}
.note{position:absolute;top:1290px;left:90px;right:90px;text-align:center;font:400 40px/1.7 "Readex Pro"}
.note b{color:#e8c27a;font-weight:600}
.url{position:absolute;top:1480px;left:0;right:0;text-align:center;font:400 46px "Readex Pro";color:#e8c27a;direction:ltr}
</style></head><body><div class="frame"></div>
<div class="brand"><b>Cairo</b> Quran</div>
<div class="live"><i></i>بث مباشر الآن</div>
<div class="sub">${sub}</div>
<div class="tv"><iframe src="http://127.0.0.1:8000/"></iframe></div><div class="stand"></div>
<div class="note">على موقعنا وعلى شاشة التلفاز في بيتك<br><b>مع مواقيت الصلاة لمدينتك والأذكار</b></div>
<div class="url">cairoquran.com</div>
</body></html>`;

function recordAudio(streams, file, seconds) {
  return new Promise(resolve => {
    const tryNext = i => {
      if (i >= streams.length) return resolve(false);
      const p = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-i', streams[i], '-t', String(seconds), '-vn', '-ac', '2', '-ar', '44100', file], { stdio: 'inherit' });
      p.on('exit', code => (code === 0 && existsSync(file)) ? resolve(true) : tryNext(i + 1));
    };
    tryNext(0);
  });
}

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const out = [];
for (const it of items) {
  const tmp = join(dist, 'tmp-' + it.id); mkdirSync(join(tmp, 'f'), { recursive: true });
  writeFileSync(join(process.cwd(), '_live.html'), page_(it.sub || 'إذاعة القرآن الكريم من القاهرة'));
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, timezoneId: 'Africa/Cairo', locale: 'ar-EG' });
  // Open the screen as a returning viewer in Cairo on the item's station, so no city picker appears
  await page.addInitScript(st => { try { localStorage.setItem('qtv-city', 'cairo'); localStorage.setItem('qtv-station', st); } catch (e) {} }, it.station || 'cairo');
  // The screen shows the clock and the next prayer as they will be when the reel is published
  if (it.at) await page.clock.setSystemTime(new Date(it.at));
  await page.goto('http://127.0.0.1:8000/_live.html', { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(6000);
  // Start the station on the screen so it reads «على الهواء مباشرة»; if it cannot connect, return it to the idle state
  const site = page.frames().find(f => f !== page.mainFrame());
  const state = () => site.evaluate(() => document.getElementById('status').dataset.s).catch(() => '');
  await site.evaluate(() => document.getElementById('play').click()).catch(() => {});
  for (let i = 0; i < 20 && await state() !== 'live'; i++) await page.waitForTimeout(500);
  if (await state() !== 'live') await site.evaluate(() => document.getElementById('play').click()).catch(() => {});
  await page.waitForTimeout(1000);
  const dur = it.duration || 25, audio = join(tmp, 'a.wav');
  const audioP = recordAudio(it.streams || CAIRO, audio, dur + 1);
  const t0 = Date.now(), frames = [];
  while (Date.now() - t0 < dur * 1000) {
    const f = join(tmp, 'f', String(frames.length).padStart(5, '0') + '.jpg');
    await page.screenshot({ path: f, type: 'jpeg', quality: 88 }); frames.push({ f, t: (Date.now() - t0) / 1000 });
  }
  await page.close();
  const ok = await audioP;
  if (!ok) throw new Error('could not record the live stream');
  // A pause in the broadcast at the end would leave dead air: end the reel half a second after the last sound
  let cut = dur;
  const log = (() => { try { return execFileSync('sh', ['-c', `ffmpeg -hide_banner -i '${audio}' -af silencedetect=n=-45dB:d=1.5 -f null - 2>&1`]).toString(); } catch (e) { return ''; } })();
  const starts = [...log.matchAll(/silence_start: ([\d.]+)/g)].map(m => +m[1]), ends = [...log.matchAll(/silence_end: ([\d.]+)/g)].map(m => +m[1]);
  if (starts.length > ends.length || (ends.length && ends[ends.length - 1] >= dur - .3)) { const last = starts[starts.length - 1]; if (last > 14) cut = Math.min(dur, last + .6); }
  if (cut < dur) console.log(`${it.id}: trailing silence from ${cut.toFixed(1)}s, reel ends there`);
  let list = ''; frames.forEach((fr, i) => { const next = i + 1 < frames.length ? frames[i + 1].t : dur; list += `file '${fr.f}'\nduration ${Math.max(.01, next - fr.t).toFixed(3)}\n`; });
  list += `file '${frames[frames.length - 1].f}'\n`; writeFileSync(join(tmp, 'list.txt'), list);
  const mp4 = join(dist, it.id + '.mp4');
  sh('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', join(tmp, 'list.txt'), '-i', audio,
    '-vf', 'fps=30,format=yuv420p', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11,afade=t=in:d=0.8,afade=t=out:st=' + (cut - 1.2) + ':d=1.2',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '23', '-maxrate', '2500k', '-bufsize', '5000k', '-profile:v', 'high',
    '-c:a', 'aac', '-b:a', '128k', '-t', String(cut), '-movflags', '+faststart', mp4]);
  sh('ffmpeg', ['-loglevel', 'error', '-y', '-ss', String(cut / 2), '-i', mp4, '-frames:v', '1', join(dist, it.id + '.jpg')]);
  console.log(`${it.id}: ${frames.length} frames over ${dur}s -> ${mp4}`);
  out.push({ id: it.id, file: it.id + '.mp4', cover: it.id + '.jpg', type: 'reel', at: it.at, when: it.when, platforms: it.platforms || ['facebook', 'instagram'], title: it.title || null, caption: it.caption });
}
await browser.close();
writeFileSync(join(dist, 'extra.json'), JSON.stringify(out, null, 2));
