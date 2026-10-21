/* Cairo Quran studio: shared helpers for the image, recitation-video and video-editor pages.
   Everything runs in the browser; sources are quran.com / QDC (text, recitation, word timings),
   Wikimedia Commons (reciter photos) and the site's own index.html (adhkar, verses, radio list). */
(() => {
  const CQ = window.CQ = {};
  const $ = CQ.$ = id => document.getElementById(id);
  CQ.ar = n => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
  CQ.API = 'https://api.quran.com/api/v4';
  CQ.QDC = 'https://api.qurancdn.com/api/qdc/audio';
  CQ.SIZES = { '9:16': [1080, 1920], '4:5': [1080, 1350], '1:1': [1080, 1080] };
  CQ.STYLE_AR = { Murattal: 'مرتّل', Mujawwad: 'مجوّد', Muallim: 'المعلّم', 'Kids repeat': 'مع ترديد الأطفال' };
  const COMMONS = 'https://upload.wikimedia.org/wikipedia/commons/';
  CQ.PHOTOS = {
    1: COMMONS + 'b/b9/Abdul_Basit_Abd_us-Samad_in_South_Africa_in_1966_%283%29_%28cropped%29.jpg',
    2: COMMONS + 'b/b9/Abdul_Basit_Abd_us-Samad_in_South_Africa_in_1966_%283%29_%28cropped%29.jpg',
    6: COMMONS + '7/70/Hussary.jpg', 12: COMMONS + '7/70/Hussary.jpg',
    9: COMMONS + 'e/ee/Elminshwey.jpg',
    7: COMMONS + '2/24/%D0%9C%D0%B8%D1%88%D0%B0%D1%80%D0%B8_%D0%A0%D0%B0%D1%88%D0%B8%D0%B4.jpg',
    173: COMMONS + '2/24/%D0%9C%D0%B8%D1%88%D0%B0%D1%80%D0%B8_%D0%A0%D0%B0%D1%88%D0%B8%D0%B4.jpg'
  };
  CQ.ORDER = [2, 1, 6, 12, 9, 7];
  CQ.THEMES = {
    night: { top: '#0a1230', bottom: '#22305c', glow: 'rgba(232,194,122,.13)', ink: '#fdf6e9', soft: 'rgba(253,246,233,.68)', gold: '#e8c27a', line: 'rgba(232,194,122,.55)', pattern: 'rgba(232,194,122,.05)' },
    dawn: { top: '#141f45', bottom: '#9c6a4a', glow: 'rgba(255,214,150,.22)', ink: '#fff8ec', soft: 'rgba(255,248,236,.72)', gold: '#f3d08e', line: 'rgba(243,208,142,.6)', pattern: 'rgba(255,230,190,.06)' },
    emerald: { top: '#04171a', bottom: '#14503f', glow: 'rgba(232,194,122,.14)', ink: '#f6f3e6', soft: 'rgba(246,243,230,.66)', gold: '#e3c072', line: 'rgba(227,192,114,.55)', pattern: 'rgba(227,192,114,.06)' }
  };
  CQ.FONT = { verse: '"Amiri Quran", Amiri, serif', amiri: 'Amiri, serif', ruqaa: '"Aref Ruqaa", Amiri, serif', ui: '"Readex Pro", "Segoe UI", Tahoma, sans-serif' };

  /* ---------- status line ---------- */
  CQ.say = (el, t, kind) => { el.textContent = t; el.className = 'msg' + (kind ? ' ' + kind : ''); };

  /* ---------- fonts ---------- */
  CQ.fonts = () => Promise.all([
    document.fonts.load('80px "Amiri Quran"', 'بِسْمِ'), document.fonts.load('700 60px Amiri', 'Cairo قرآن'),
    document.fonts.load('400 60px Amiri', 'قرآن'), document.fonts.load('700 60px "Aref Ruqaa"', 'جمعة'),
    document.fonts.load('300 30px "Readex Pro"', 'مواقيت'), document.fonts.load('400 30px "Readex Pro"', 'cairoquran'),
    document.fonts.load('600 60px "Readex Pro"', '١٢٣')
  ]).catch(() => {});

  /* ---------- the site's own data: radio countries, adhkar, verses ---------- */
  CQ.radiosLine = html => {
    const g = html.indexOf("title: 'إذاعات مباشرة'"), e = g < 0 ? -1 : html.indexOf('] }', g);
    const places = g < 0 ? [] : [...html.slice(g, e).matchAll(/name: 'إذاعة القرآن الكريم · ([^']+)'/g)].map(m => m[1].trim() === 'القاهرة' ? 'مصر' : m[1].trim());
    const list = [...new Set(places)];
    return list.length ? 'إذاعات القرآن الكريم من ' + list.join(' و') : 'إذاعات القرآن الكريم';
  };
  let siteP = null;
  CQ.site = () => siteP || (siteP = fetch('../index.html').then(r => r.ok ? r.text() : '').catch(() => '').then(html => {
    const out = { radios: 'إذاعات القرآن الكريم', adhkar: null, verses: null };
    if (!html) return out;
    out.radios = CQ.radiosLine(html);
    const grab = (from, to) => { const i = html.indexOf(from), j = html.indexOf(to, i); return i < 0 || j < 0 ? null : html.slice(i, j); };
    try { const v = grab('const VERSES = [', '\n  ];'); if (v) out.verses = new Function(v + '\n  ]; return VERSES;')(); } catch (e) {}
    try { const a = grab('const ADHKAR = {', '\n  };'); if (a) out.adhkar = new Function(a + '\n  }; return ADHKAR;')(); } catch (e) {}
    return out;
  }));

  /* ---------- quran.com / QDC ---------- */
  const getJSON = CQ.getJSON = async u => { const r = await fetch(u); if (!r.ok) throw new Error('تعذّر الوصول إلى ' + new URL(u).host + '. تأكد من الاتصال ثم أعد المحاولة.'); return r.json(); };
  let recP = null, chP = null;
  CQ.reciters = () => recP || (recP = getJSON(CQ.QDC + '/reciters?locale=ar').then(j => {
    const rs = j.reciters.filter(r => r.style && r.style.name !== 'Kids repeat');
    rs.sort((a, b) => (CQ.ORDER.indexOf(a.id) + 1 || 99) - (CQ.ORDER.indexOf(b.id) + 1 || 99));
    return rs;
  }));
  CQ.chapters = () => chP || (chP = getJSON(CQ.API + '/chapters?language=ar').then(j => j.chapters));
  CQ.reciterName = r => r ? (r.translated_name?.name || r.name) : '';
  CQ.reciterLabel = r => r ? (CQ.STYLE_AR[r.style?.name] || r.style?.name || '') : '';
  CQ.fillReciters = async sel => { const rs = await CQ.reciters(); sel.innerHTML = rs.map(r => `<option value="${r.id}">${CQ.reciterName(r)} · ${CQ.reciterLabel(r)}</option>`).join(''); return rs; };
  CQ.fillChapters = async sel => { const cs = await CQ.chapters(); sel.innerHTML = cs.map(ch => `<option value="${ch.id}">${CQ.ar(ch.id)}. ${ch.name_arabic}</option>`).join(''); return cs; };
  CQ.verseWords = async key => {
    const j = await getJSON(`${CQ.API}/verses/by_key/${key}?words=true&word_fields=text_uthmani`);
    return j.verse.words.filter(w => w.char_type_name === 'word').map(w => ({ pos: w.position, text: w.text_uthmani.replace(/۞\s*/g, '').trim() })).filter(w => w.text);
  };
  // Words of verses from..to with times (seconds) relative to the first verse's start, plus the audio file to cut from.
  CQ.recitation = async (rid, ch, from, to, maxSeconds) => {
    const aj = await getJSON(`${CQ.QDC}/reciters/${rid}/audio_files?chapter=${ch}&segments=true`);
    const file = (aj.audio_files || [])[0];
    if (!file || !file.audio_url) throw new Error('لا تتوفر تلاوة هذا القارئ لهذه السورة.');
    const tm = new Map((file.verse_timings || []).map(v => [v.verse_key, v]));
    const s = tm.get(`${ch}:${from}`), e = tm.get(`${ch}:${to}`);
    if (!s || !e) throw new Error('لا تتوفر توقيتات هذه الآيات لهذا القارئ.');
    const t0 = s.timestamp_from / 1000, t1 = e.timestamp_to / 1000;
    if (maxSeconds && t1 - t0 > maxSeconds) throw new Error(`مدة التلاوة ${Math.round(t1 - t0)} ثانية. قلّل عدد الآيات حتى لا تتجاوز ${maxSeconds} ثانية.`);
    const words = [], plain = [];
    for (let n = from; n <= to; n++) {
      const key = `${ch}:${n}`, vt = tm.get(key), ws = await CQ.verseWords(key);
      const seg = new Map((vt.segments || []).filter(x => x.length >= 3).map(x => [x[0], [x[x.length - 2] / 1000, x[x.length - 1] / 1000]]));
      const timed = ws.every(w => seg.has(w.pos)), a0 = vt.timestamp_from / 1000, a1 = vt.timestamp_to / 1000;
      ws.forEach((w, j) => { const [a, b] = timed ? seg.get(w.pos) : [a0 + (a1 - a0) * j / ws.length, a0 + (a1 - a0) * (j + 1) / ws.length]; words.push({ text: w.text, start: a - t0, end: b - t0 }); });
      words.push({ text: '﴿' + CQ.ar(n) + '﴾', mark: true, start: a1 - t0 - .25, end: a1 - t0 });
      plain.push(ws.map(w => w.text).join(' ') + ' ﴿' + CQ.ar(n) + '﴾');
    }
    return { url: file.audio_url, t0, t1, dur: t1 - t0, words, plain: plain.join(' ') };
  };
  // Plain verse text without audio (for overlays on the viewer's own video).
  CQ.verseText = async (ch, from, to) => {
    const words = [], plain = [];
    for (let n = from; n <= to; n++) { const ws = await CQ.verseWords(`${ch}:${n}`); ws.forEach(w => words.push({ text: w.text, start: -1, end: -1 })); words.push({ text: '﴿' + CQ.ar(n) + '﴾', mark: true, start: -1, end: -1 }); plain.push(ws.map(w => w.text).join(' ') + ' ﴿' + CQ.ar(n) + '﴾'); }
    return { words, plain: plain.join(' ') };
  };
  CQ.refText = (chapter, from, to) => `سورة ${chapter.name_arabic} · ${from === to ? 'الآية ' + CQ.ar(from) : 'الآيات ' + CQ.ar(from) + '–' + CQ.ar(to)}`;
  CQ.decode = async (ac, url, onMsg) => {
    onMsg && onMsg('جارٍ تنزيل ملف التلاوة…');
    const r = await fetch(url); if (!r.ok) throw new Error('تعذّر تنزيل ملف التلاوة.');
    const raw = await r.arrayBuffer();
    return new Promise((res, rej) => ac.decodeAudioData(raw, res, () => rej(new Error('تعذّر قراءة ملف التلاوة.'))));
  };

  /* ---------- images ---------- */
  CQ.loadImage = (src, cors) => new Promise((res, rej) => { const im = new Image(); if (cors) im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = () => rej(new Error('تعذّر تحميل الصورة.')); im.src = src; });

  /* ---------- drawing ---------- */
  CQ.ease = x => x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.pow(1 - x, 3);
  CQ.win = (t, a, b) => CQ.ease((t - a) / (b - a));
  CQ.star8 = (c, x, y, r) => { c.beginPath(); for (let k = 0; k < 2; k++) { const a0 = k * Math.PI / 4; for (let i = 0; i < 4; i++) { const a = a0 + i * Math.PI / 2, px = x + r * Math.cos(a), py = y + r * Math.sin(a); i ? c.lineTo(px, py) : c.moveTo(px, py); } c.closePath(); } c.stroke(); };
  CQ.crescent = (c, cx, cy, r, color) => { c.save(); c.fillStyle = color || '#e8c27a'; c.beginPath(); c.arc(cx, cy, r, 0, 7); c.arc(cx + r * .42, cy - r * .18, r * .86, 0, 7, true); c.fill('evenodd'); c.restore(); };
  CQ.cover = (c, img, x, y, w, h, fy) => {
    const iw0 = img.videoWidth || img.width, ih0 = img.videoHeight || img.height; if (!iw0 || !ih0) return;
    const s = Math.max(w / iw0, h / ih0), iw = iw0 * s, ih = ih0 * s;
    c.drawImage(img, x + (w - iw) / 2, y + (h - ih) * (fy ?? .5), iw, ih);
  };
  CQ.rrect = (c, x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
  CQ.text = (c, t, x, y, font, color, align, dir) => { c.font = font; c.fillStyle = color; c.textAlign = align || 'center'; c.direction = dir || 'rtl'; c.fillText(t, x, y); };
  const stars = [...Array(90)].map((_, i) => ({ fx: Math.sin(i * 91.7) * .5 + .5, fy: (Math.sin(i * 37.3) * .5 + .5) * .8, r: 1 + (i * 7 % 3) * .7, p: i * .9 }));
  CQ.sky = (c, W, H, theme, t) => {
    const th = CQ.THEMES[theme] || CQ.THEMES.night;
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, th.top); g.addColorStop(1, th.bottom); c.fillStyle = g; c.fillRect(0, 0, W, H);
    const rg = c.createRadialGradient(W / 2, H * .42, 10, W / 2, H * .42, Math.max(W, H) * .6); rg.addColorStop(0, th.glow); rg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = rg; c.fillRect(0, 0, W, H);
    c.strokeStyle = th.pattern; c.lineWidth = 2; const sp = 135;
    for (let y = -sp / 2, row = 0; y < H + sp; y += sp * .866, row++) for (let x = (row % 2 ? sp / 2 : 0) - sp / 2; x < W + sp; x += sp) CQ.star8(c, x, y, 30);
    if (t != null) stars.forEach(s => { c.fillStyle = `rgba(253,246,233,${.2 + .45 * (.5 + .5 * Math.sin(t * 1.5 + s.p))})`; c.beginPath(); c.arc(s.fx * W, s.fy * H, s.r, 0, 7); c.fill(); });
  };
  // Blurred, darkened photo or video frame filling the canvas
  CQ.backdrop = (c, W, H, media, t, total, dark) => {
    c.fillStyle = '#070b1c'; c.fillRect(0, 0, W, H);
    if (media) { c.save(); c.filter = `blur(${media.tagName === 'VIDEO' ? 6 : 34}px) brightness(${dark ?? .45})`; const z = 1.15 + .06 * Math.min((t || 0) / (total || 1), 1); CQ.cover(c, media, -(z - 1) * W / 2, -(z - 1) * H / 2, W * z, H * z, .25); c.restore(); }
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(7,11,28,.30)'); g.addColorStop(.55, 'rgba(7,11,28,.50)'); g.addColorStop(1, 'rgba(7,11,28,.82)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  };
  CQ.frame = (c, W, H, color) => { c.strokeStyle = color || 'rgba(232,194,122,.5)'; c.lineWidth = 2.5; const p = Math.round(W * .043); c.strokeRect(p, p, W - p * 2, H - p * 2); };
  CQ.brand = (c, W, y, size, alpha) => {
    c.save(); c.globalAlpha = alpha ?? 1; c.font = `700 ${size}px Amiri, serif`; c.direction = 'ltr'; c.textAlign = 'left';
    const w1 = c.measureText('Cairo ').width, w2 = c.measureText('Quran').width, bx = (W - w1 - w2) / 2;
    c.fillStyle = '#e8c27a'; c.fillText('Cairo ', bx, y); c.fillStyle = '#fdf6e9'; c.fillText('Quran', bx + w1, y); c.restore();
  };
  // Closing card: the whole site, not the radio alone
  CQ.endCard = (c, W, H, alpha, radios) => {
    if (alpha <= 0) return;
    const k = W / 1080, cy = H / 2, ey = (1 - alpha) * 24;
    c.save(); c.globalAlpha = alpha;
    CQ.brand(c, W, cy - 110 * k + ey, 104 * k, alpha);
    ['تلاوات كبار القرّاء', radios || 'إذاعات القرآن الكريم', 'مواقيت الصلاة لمدينتك · الأذكار'].forEach((l, i) => CQ.text(c, l, W / 2, cy - 10 * k + i * 70 * k + ey, `300 ${44 * k}px ${CQ.FONT.ui}`, 'rgba(253,246,233,.86)'));
    CQ.text(c, 'cairoquran.com', W / 2, cy + 230 * k + ey, `400 ${48 * k}px ${CQ.FONT.ui}`, '#e8c27a', 'center', 'ltr');
    c.restore();
  };
  // Lay words out right-to-left in centred lines inside a box; sets w.x, w.y and returns the font size.
  CQ.layoutWords = (c, words, x0, y0, w, h, maxSize, minSize, lh) => {
    lh = lh || 2.05; let size = maxSize, lines;
    for (; size >= minSize; size -= 2) {
      c.font = `${size}px ${CQ.FONT.verse}`; const gap = size * .32; lines = []; let cur = [], ws = 0;
      words.forEach((wd, i) => { c.font = `${size}px ${wd.mark ? CQ.FONT.amiri : CQ.FONT.verse}`; wd.w = c.measureText(wd.text).width; const add = (cur.length ? gap : 0) + wd.w; if (cur.length && ws + add > w) { lines.push({ items: cur, width: ws }); cur = []; ws = 0; } ws += (cur.length ? gap : 0) + wd.w; cur.push(i); });
      if (cur.length) lines.push({ items: cur, width: ws });
      if (lines.length * size * lh <= h) break;
    }
    const L = size * lh, gap = size * .32, top = y0 + (h - lines.length * L) / 2;
    lines.forEach((ln, k) => { let x = x0 + w / 2 + ln.width / 2; const y = top + L * k + L * .66; ln.items.forEach(i => { const wd = words[i]; x -= wd.w; wd.x = x; wd.y = y; x -= gap; }); });
    return size;
  };
  // Draw laid-out words; at = seconds into the recitation (words before 'at' lit, the current one gold). at = null: all lit.
  CQ.drawWords = (c, words, size, at, alpha) => {
    c.save(); c.direction = 'rtl'; c.textAlign = 'left'; c.shadowColor = 'rgba(0,0,0,.55)'; c.shadowBlur = size * .3;
    words.forEach(w => {
      let o = .22, col = '#fdf6e9';
      if (at == null || w.start < 0 || at >= w.start) { o = 1; col = (at != null && w.start >= 0 && at < w.end) || w.mark ? '#e8c27a' : '#fdf6e9'; }
      else if (at >= w.start - .35) o = .22 + .78 * CQ.win(at, w.start - .35, w.start);
      c.font = `${size}px ${w.mark ? CQ.FONT.amiri : CQ.FONT.verse}`;
      c.globalAlpha = o * alpha; c.fillStyle = w.mark ? '#e8c27a' : col; c.fillText(w.text, w.x, w.y);
    });
    c.restore();
  };
  CQ.bars = (c, W, yc, env, t, color) => {
    const n = 48, bw = 10 * W / 1080, gp = 8 * W / 1080, x0 = (W - n * (bw + gp)) / 2; c.fillStyle = color || 'rgba(232,194,122,.75)';
    for (let k = 0; k < n; k++) { const f = Math.max(0, 1 - Math.abs(k - n / 2) / (n / 2)) * .6 + .4; const h = 8 + (env || 0) * 150 * (W / 1080) * f * (0.55 + 0.45 * Math.sin(k * 1.7 + t * 3) ** 2); c.fillRect(x0 + k * (bw + gp), yc - h / 2, bw, h); }
  };
  // Instagram/Facebook Reels interface areas, drawn only on the preview overlay
  CQ.safeZones = (cv, ratio) => {
    const c = cv.getContext('2d'), W = cv.width, H = cv.height; c.clearRect(0, 0, W, H);
    if (ratio !== '9:16') return;
    c.fillStyle = 'rgba(240,138,122,.22)'; c.fillRect(0, 0, W, H * .125); c.fillRect(0, H * .8, W, H * .2); c.fillRect(W * .86, H * .45, W * .14, H * .35);
    c.fillStyle = 'rgba(253,246,233,.85)'; c.font = `400 ${W * .028}px ${CQ.FONT.ui}`; c.textAlign = 'center'; c.direction = 'rtl';
    c.fillText('مساحة يغطيها اسم الحساب والتعليق والأزرار', W / 2, H * .9);
  };

  /* ---------- recording and delivery ---------- */
  CQ.pickMime = () => ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
    .find(m => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
  CQ.startRecorder = (canvas, audioStream, fps) => {
    const mime = CQ.pickMime(); if (!mime) throw new Error('هذا المتصفح لا يدعم تسجيل الفيديو. استخدم Chrome أو Safari بإصدار حديث.');
    const stream = canvas.captureStream(fps || 30); if (audioStream) audioStream.getAudioTracks().forEach(t => stream.addTrack(t));
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8000000, audioBitsPerSecond: 160000 }), chunks = [];
    rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.start(500);
    return { stop: () => new Promise(res => { rec.onstop = () => { const type = mime.split(';')[0]; res(new Blob(chunks, { type })); }; rec.stop(); }), abort: () => { try { rec.state !== 'inactive' && rec.stop(); } catch (e) {} } };
  };
  // Download link plus a Share button that hands the file to Instagram/Facebook on phones
  CQ.deliver = (blob, name, linkEl, shareEl) => {
    const url = URL.createObjectURL(blob); linkEl.href = url; linkEl.download = name;
    const file = new File([blob], name, { type: blob.type });
    const can = navigator.canShare && navigator.canShare({ files: [file] });
    shareEl.hidden = !can;
    shareEl.onclick = async () => { try { await navigator.share({ files: [file], title: 'Cairo Quran' }); } catch (e) {} };
    return url;
  };
  CQ.copy = async (ta, msgEl) => { try { await navigator.clipboard.writeText(ta.value); CQ.say(msgEl, 'نُسخ النص.', 'ok'); } catch (e) { ta.focus(); ta.select(); CQ.say(msgEl, 'النص محدّد، انسخه من القائمة.'); } };
  CQ.store = {
    get: k => { try { return JSON.parse(localStorage.getItem('cq-studio-' + k) || 'null'); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem('cq-studio-' + k, JSON.stringify(v)); } catch (e) {} }
  };
  CQ.hashtags = '#قرآن_كريم #تلاوة_خاشعة #CairoQuran';
})();
