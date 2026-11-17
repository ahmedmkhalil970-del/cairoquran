// Temporary: lists CC0 landscape photos on Commons (structured-data licence CC0) for reel backgrounds, with contact sheets.
import { writeFile, mkdir } from 'node:fs/promises';
const UA = { 'User-Agent': 'CairoQuranContent/1.0 (+https://cairoquran.com)' };
const Q = ['sunrise', 'sunset', 'clouds sky', 'sea', 'ocean waves', 'desert', 'sand dunes', 'mountains', 'lake', 'forest', 'waterfall',
  'night sky stars', 'moon', 'fog', 'beach', 'river', 'valley', 'snow mountains', 'meadow', 'palm trees', 'canyon', 'rain'];
const out = [];
for (const q of Q) {
  const u = 'https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', generator: 'search',
    gsrnamespace: '6', gsrlimit: '40', gsrsearch: `${q} haswbstatement:P275=Q6938433 filetype:bitmap filew:>1919 -painting -drawing -NASA`,
    prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: '330', iiextmetadatafilter: 'LicenseShortName' });
  const j = await (await fetch(u, { headers: UA })).json();
  const pages = (j.query?.pages || []).sort((a, b) => a.index - b.index)
    .filter(p => p.imageinfo?.[0]?.mime === 'image/jpeg' && p.imageinfo[0].width > p.imageinfo[0].height * 1.2 && /cc0|public domain/i.test(p.imageinfo[0].extmetadata?.LicenseShortName?.value || ''))
    .slice(0, 9);
  pages.forEach((p, i) => out.push({ q, n: i + 1, title: p.title.replace(/^File:/, ''), thumb: p.imageinfo[0].thumburl, lic: p.imageinfo[0].extmetadata.LicenseShortName.value }));
  console.log(q, pages.length);
  await new Promise(r => setTimeout(r, 500));
}
await mkdir('.github/content/tools/bg/out', { recursive: true });
await writeFile('.github/content/tools/bg/out/found.json', JSON.stringify(out, null, 1));
await writeFile('.github/content/tools/bg/out/thumbs.tsv', out.map((o, i) => `${String(i + 1).padStart(3, '0')}\t${o.thumb}\t${i + 1} ${o.q}`).join('\n') + '\n');
