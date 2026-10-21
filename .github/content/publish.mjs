// Assembles one week's content into a release folder: rendered reels (+ covers), static assets, a machine-readable
// schedule.json for the scheduling session, and notes.md (the release page, in Arabic) with direct download links.
// Usage: node publish.mjs <week> <dist-dir>   (reels already rendered into <dist-dir> by .github/reels/build.mjs)
import { readFileSync, writeFileSync, copyFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const [week, dist] = process.argv.slice(2);
if (!week || !dist) { console.error('usage: node publish.mjs <week> <dist-dir>'); process.exit(2); }
const W = join(HERE, week), TAG = `content-${week}`;
const REPO = process.env.GITHUB_REPOSITORY || 'ahmedmkhalil970-del/cairoquran';
const url = f => `https://github.com/${REPO}/releases/download/${TAG}/${encodeURIComponent(f)}`;
mkdirSync(dist, { recursive: true });

const readJSON = f => existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : [];
const reels = [...readJSON(join(dist, 'reels.json')), ...readJSON(join(dist, 'extra.json'))];
const posts = readJSON(join(W, 'posts.json'));
if (existsSync(join(W, 'assets'))) for (const f of readdirSync(join(W, 'assets'))) copyFileSync(join(W, 'assets', f), join(dist, f));

const missing = [...reels.map(r => r.file), ...posts.map(p => p.file)].filter(f => !existsSync(join(dist, f)));
if (missing.length) { console.error('missing files: ' + missing.join(', ')); process.exit(1); }

const items = [...posts, ...reels].map(x => ({
  id: x.id, type: x.type, at: x.at, when: x.when, platforms: x.platforms,
  file: x.file, url: url(x.file), cover: x.cover ? url(x.cover) : null,
  caption: x.caption, first_comment: x.first_comment || null, note: x.facebook_caption_note || null, status: 'pending'
})).sort((a, b) => String(a.at).localeCompare(String(b.at)));
writeFileSync(join(dist, 'schedule.json'), JSON.stringify({ week, tag: TAG, timezone: 'Asia/Kuwait', items }, null, 2));

const TYPE = { reel: 'ريلز', post: 'منشور', story: 'قصة' };
let md = `# محتوى أسبوع ${week}\n\nالمواعيد بتوقيت الكويت. ملف الجدولة الآلي: [schedule.json](${url('schedule.json')})\n\n`;
md += '| الموعد | النوع | الملف | المنصات |\n|---|---|---|---|\n';
for (const i of items) md += `| ${i.when || i.at} | ${TYPE[i.type] || i.type} | [${i.file}](${i.url})${i.cover ? ` · [الغلاف](${i.cover})` : ''} | ${i.platforms.join('، ')} |\n`;
md += '\n## النصوص\n';
for (const i of items) md += `\n### ${i.when || i.at} · ${i.file}\n\n${i.caption}\n${i.note ? `\n> ${i.note}\n` : ''}${i.first_comment?.facebook ? `\n> أول تعليق على فيسبوك: ${i.first_comment.facebook}\n` : ''}`;
writeFileSync(join(dist, 'notes.md'), md);
writeFileSync(join(dist, 'captions.md'), md);
console.log(`${items.length} items -> ${dist}`);
