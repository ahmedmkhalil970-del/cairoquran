// Monthly check of the slideshow photos: every photo in data/places.js is requested (HEAD) at the address the site
// uses, then at the Special:FilePath fallback. Photos that fail both are listed in broken.json and broken.md
// (and printed as BROKEN lines in the log).
import fs from 'node:fs';
import vm from 'node:vm';

const TH = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/';
const UA = 'CairoQuranPhotoCheck/1.0 (monthly link check, one request per photo; github.com/' + (process.env.GITHUB_REPOSITORY || 'cairoquran') + ')';
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync('data/places.js', 'utf8'), sandbox);
const places = sandbox.window.PLACES_DATA, countries = sandbox.window.PLACE_COUNTRIES || {};
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function ok(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(url, { method: 'HEAD', redirect: 'follow', headers: { 'User-Agent': UA } });
      if (r.status === 429 || r.status >= 500) { await sleep(5000 * (attempt + 1)); continue; }
      return r.ok;
    } catch (e) { await sleep(3000); }
  }
  return false;
}

const broken = [];
let i = 0;
async function worker() {
  while (i < places.length) {
    const x = places[i++];
    const main = x.p.startsWith('http') ? x.p : TH + x.p;
    const file = decodeURIComponent((x.p.startsWith('http') ? x.p : x.p.split('/')[2]).split('/').pop());
    const alt = 'https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(file) + '?width=1920';
    if (!(await ok(main)) && !(await ok(alt))) broken.push({ k: x.k, c: x.c, country: (countries[x.c] || {}).ar || x.c, name: x.ar[0], url: main });
    await sleep(150);
  }
}
await Promise.all([worker(), worker(), worker()]);
fs.writeFileSync('broken.json', JSON.stringify(broken, null, 1));
const md = broken.length
  ? `## فحص روابط صور الخلفية\n\nمن أصل ${places.length} صورة، تعذّر تحميل ${broken.length} صورة من الرابط الأساسي والبديل:\n\n` +
    broken.map(b => `- ${b.name} (${b.country}) · \`${b.k}\` · ${b.url}`).join('\n') +
    '\n\nالبرنامج يتخطاها تلقائيًا؛ المطلوب استبدالها في `data/places.js`.'
  : '';
fs.writeFileSync('broken.md', md);
console.log(`${places.length} photos checked, ${broken.length} broken`);
broken.forEach(b => console.log('BROKEN', b.k, b.url));
