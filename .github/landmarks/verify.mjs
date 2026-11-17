// Temporary: checks that every photo in data/places.js loads (HTTP 200, image) at the size the site uses.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const src = await readFile('data/places.js', 'utf8');
const window = {}; new Function('window', src)(window);
const P = window.PLACES_DATA, ROOT = 'https://upload.wikimedia.org/wikipedia/commons/thumb/';
const UA = 'CairoQuranLandmarks/1.0 (+https://cairoquran.com)';
const bad = [];
for (const [i, p] of P.entries()) {
  if (i < 250) continue;                                     // only the new photos
  const url = /^https?:/.test(p.p) ? p.p : ROOT + p.p;
  let code = 0, type = '';
  for (let t = 0; t < 5 && code !== 200; t++) {
    try { const r = await fetch(url, { headers: { 'User-Agent': UA } }); code = r.status; type = r.headers.get('content-type') || ''; await r.arrayBuffer(); } catch (e) { code = -1; }
    if (code !== 200) await new Promise(r => setTimeout(r, 15000));
  }
  if (code !== 200 || !/^image\//.test(type)) bad.push(`${i} ${p.k} ${code} ${type} ${url}`);
  await new Promise(r => setTimeout(r, 1200));
}
await mkdir('.github/landmarks/out', { recursive: true });
await writeFile('.github/landmarks/out/verify.txt', `checked ${P.length - 250}, failed ${bad.length}\n` + bad.join('\n') + '\n');
console.log(`checked ${P.length - 250}, failed ${bad.length}`); bad.forEach(b => console.log(b));
