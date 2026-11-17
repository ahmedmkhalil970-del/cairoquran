// Finds landscape photos on Wikimedia Commons for each candidate place (temporary tool, runs on GitHub Actions).
// Output: .github/landmarks/out/found.json (top 3 per place) and contact sheets for review.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const UA = 'CairoQuranLandmarks/1.0 (+https://cairoquran.com)';
const API = 'https://commons.wikimedia.org/w/api.php';
const OK_LIC = /^(CC BY(-SA)? \d(\.\d)?|CC0|Public domain|PD)/i;
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function api(params) {
  const u = API + '?' + new URLSearchParams({ format: 'json', formatversion: '2', origin: '*', ...params });
  for (let i = 0; i < 4; i++) {
    const r = await fetch(u, { headers: { 'User-Agent': UA } });
    if (r.ok) return r.json();
    await sleep(2000 * (i + 1));
  }
  throw new Error('api failed');
}
const strip = h => String(h || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
async function search(q, extra) {
  const j = await api({ action: 'query', generator: 'search', gsrnamespace: '6', gsrlimit: '25',
    gsrsearch: `${q} filetype:bitmap filew:>2000 ${extra}`, prop: 'imageinfo',
    iiprop: 'url|size|extmetadata', iiurlwidth: '1920', iiextmetadatafilter: 'LicenseShortName|Artist|ImageDescription' });
  const pages = (j.query && j.query.pages) || [];
  pages.sort((a, b) => a.index - b.index);
  return pages.map(p => {
    const ii = p.imageinfo && p.imageinfo[0]; if (!ii) return null;
    const m = ii.extmetadata || {};
    return { title: p.title, w: ii.width, h: ii.height, thumb: ii.thumburl, lic: strip(m.LicenseShortName && m.LicenseShortName.value),
      by: strip(m.Artist && m.Artist.value), desc: strip(m.ImageDescription && m.ImageDescription.value).slice(0, 160) };
  }).filter(Boolean);
}
const rows = (await readFile('.github/landmarks/candidates.tsv', 'utf8')).trim().split('\n').map(l => l.split('\t'));
const out = [];
for (const [cat, key, q] of rows) {
  const seen = new Set(), picks = [];
  for (const [tier, extra] of [['FP', 'incategory:Featured_pictures_on_Wikimedia_Commons'], ['QI', 'incategory:Quality_images'], ['', '']]) {
    let res = [];
    try { res = await search(q, extra); } catch (e) { console.log('search failed', key, tier); }
    for (const r of res) {
      if (seen.has(r.title)) continue; seen.add(r.title);
      const ratio = r.w / r.h;
      if (ratio < 1.3 || ratio > 2.3) continue;
      if (!OK_LIC.test(r.lic)) continue;
      if (!r.thumb || !/\/thumb\//.test(r.thumb)) continue;
      if (/\b(map|logo|diagram|plan|drawing|painting)\b/i.test(r.title)) continue;
      picks.push({ tier, ...r });
      if (picks.length >= 3) break;
    }
    if (picks.length >= 3) break;
    await sleep(300);
  }
  out.push({ cat, key, q, picks });
  console.log(`${picks.length} ${key}`);
}
await mkdir('.github/landmarks/out', { recursive: true });
await writeFile('.github/landmarks/out/found.json', JSON.stringify(out, null, 1));
const lines = [];
out.forEach((o, i) => o.picks.forEach((p, k) => lines.push(`${String(i + 1).padStart(3, '0')}_${k + 1}\t${p.thumb.replace('/1920px-', '/330px-')}\t${i + 1}.${k + 1} ${o.key} ${p.tier}`)));
await writeFile('.github/landmarks/out/thumbs.tsv', lines.join('\n') + '\n');
