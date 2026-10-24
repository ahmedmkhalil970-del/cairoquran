/* Cairo Quran stream check.
   Reads the station list straight from index.html (so it never needs updating by hand),
   opens every stream URL, and confirms it answers and actually sends audio.
   A station counts as down only when all of its URLs fail; a failed mirror alone is a warning.
   The upstream server (qurango.net) returns short HTTP 500 bursts on single stations that clear by themselves,
   so a URL is retried three times, and any URL still failing is checked once more after RECHECK_MS;
   only stations that fail every pass are reported.
   Exit code: 0 the check ran (stations up or down; the result goes to GITHUB_OUTPUT as status=ok|down),
   2 the station list could not be read (the tool itself is broken).
   Read-only: it changes no file of the site. */
import { readFile, writeFile, appendFile } from 'node:fs/promises';

const HTML_FILE = process.argv[2] || 'index.html';
const TIMEOUT_MS = 20000;   // per attempt
const MIN_BYTES = 16384;    // audio that must arrive before a stream counts as working
const RETRY_DELAYS_MS = [15000, 45000]; // waits before the 2nd and 3rd attempt
const RECHECK_MS = 180000;                // second pass for URLs that failed the first
const CONCURRENCY = 4;

async function loadStations() {
  const html = await readFile(HTML_FILE, 'utf8');
  const slice = (from, to) => {
    const i = html.indexOf(from), j = html.indexOf(to, i);
    if (i < 0 || j < 0) throw new Error(`لم يُعثر على "${from}" في ${HTML_FILE}`);
    return html.slice(i, j);
  };
  const src = slice('const STREAMS = [', 'const VERSES') + slice('const STATION_GROUPS = [', 'const STATION_LIST');
  const groups = new Function(`${src}; return STATION_GROUPS;`)();
  const stations = groups.flatMap(g => g.items.map(s => ({ ...s, group: g.title })));
  if (!stations.length || stations.some(s => !s.urls?.length)) throw new Error('قائمة الإذاعات فارغة أو ناقصة');
  return stations;
}

async function probeOnce(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: 'follow', headers: { 'user-agent': 'CairoQuran-StreamCheck/1.0' } });
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    const reader = res.body.getReader();
    let bytes = 0;
    while (bytes < MIN_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
    }
    reader.cancel().catch(() => {});
    if (bytes < MIN_BYTES) return { ok: false, reason: `توقف البث بعد ${bytes} بايت` };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: ctrl.signal.aborted ? 'انتهت مهلة الاتصال' : (e.cause?.code || e.message) };
  } finally {
    clearTimeout(timer);
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function probe(url) {
  let res = await probeOnce(url);
  for (const wait of RETRY_DELAYS_MS) {
    if (res.ok) break;
    await sleep(wait);
    res = await probeOnce(url);
  }
  return res;
}

async function mapLimited(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: limit }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i]); }
  }));
  return out;
}

async function report(text, code, status) {
  console.log(text);
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `status=${status}\n`);
  if (process.env.REPORT_FILE) await writeFile(process.env.REPORT_FILE, text);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, text + '\n');
  process.exit(code);
}

let stations;
try {
  stations = await loadStations();
} catch (e) {
  await report(`## تعذّر فحص روابط البث\n\nلم يتمكن الفحص من قراءة قائمة الإذاعات من \`${HTML_FILE}\`.\n\n- السبب: ${e.message}\n- الإجراء: مراجعة آخر تعديل على قائمة الإذاعات في الموقع.\n`, 2, 'error');
}

const urls = [...new Set(stations.flatMap(s => s.urls))];
const results = new Map();
(await mapLimited(urls, CONCURRENCY, probe)).forEach((r, i) => results.set(urls[i], r));

const failedFirst = urls.filter(u => !results.get(u).ok);
if (failedFirst.length) {
  console.log(`فشل ${failedFirst.length} رابط في الجولة الأولى؛ إعادة الفحص بعد ${RECHECK_MS / 60000} دقائق.`);
  await sleep(RECHECK_MS);
  (await mapLimited(failedFirst, CONCURRENCY, probe)).forEach((r, i) => results.set(failedFirst[i], r));
}

const down = [], degraded = [];
for (const s of stations) {
  const failed = s.urls.filter(u => !results.get(u).ok);
  if (failed.length === s.urls.length) down.push({ s, failed });
  else if (failed.length) degraded.push({ s, failed });
}

const when = new Date().toLocaleString('ar-EG', { timeZone: 'Africa/Cairo', dateStyle: 'full', timeStyle: 'short' });
const line = ({ s, failed }) => failed.map(u => `| ${s.name} | ${s.group} | ${results.get(u).reason} | ${u} |`).join('\n');
const table = rows => `| الإذاعة | القسم | السبب | الرابط |\n|---|---|---|---|\n${rows.map(line).join('\n')}\n`;

let text = `## نتيجة فحص روابط البث\n\n- وقت الفحص: ${when} (بتوقيت القاهرة)\n- عدد الإذاعات: ${stations.length}، وعدد الروابط: ${urls.length}\n- الإذاعات المتوقفة: ${down.length}\n- الإذاعات التي تعطّل أحد روابطها الاحتياطية: ${degraded.length}\n`;
if (down.length) text += `\n### إذاعات متوقفة بالكامل\nلن يسمع الزائر أي صوت عند اختيار هذه الإذاعات.\n\n${table(down)}`;
if (degraded.length) text += `\n### روابط احتياطية متعطّلة\nالإذاعة تعمل من رابط آخر، لكن الاحتياطي غير متاح.\n\n${table(degraded)}`;
if (!down.length && !degraded.length) text += `\nجميع الإذاعات تعمل بصورة سليمة.\n`;

await report(text, 0, down.length ? 'down' : 'ok');
