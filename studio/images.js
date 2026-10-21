/* Studio page 1: images for Facebook and Instagram (adhkar, verse, Ramadan countdown, Friday, free text).
   Ported from the "استوديو Cairo Quran" artifact; adhkar and verses come from the site's own index.html. */
(() => {
  const { $, ar, FONT } = CQ;
  const SIZES = { square: [1080, 1080], portrait: [1080, 1350], story: [1080, 1920] };
  const EYEBROW = { verse: 'قال الله تعالى', ramadan: 'العد التنازلي لرمضان', friday: '', free: '' };
  const TIME_AR = { morning: 'من أذكار الصباح', evening: 'من أذكار المساء', sleep: 'من أذكار النوم' };
  const cv = $('imgCanvas'), c = cv.getContext('2d');
  const now = new Date();
  const dayIndex = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000);
  let hijriNum = null, hijriLong = null;
  try { hijriNum = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'numeric', timeZone: 'UTC' }); } catch (e) {}
  try { hijriLong = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) {}
  const hijriMD = dt => { if (!hijriNum) return null; const p = hijriNum.formatToParts(dt), g = t => parseInt((p.find(x => x.type === t) || {}).value, 10); return { m: g('month'), d: g('day') }; };
  const daysToRamadan = () => { for (let i = 1; i <= 400; i++) { const h = hijriMD(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + i, 12))); if (!h) return 0; if (h.m === 9 && h.d === 1) return i; } return 0; };
  const hijriToday = () => { try { return hijriLong ? hijriLong.format(now) : ''; } catch (e) { return ''; } };

  const hour = now.getHours();
  const S = { kind: 'dhikr', time: hour < 12 ? 'morning' : hour < 20 ? 'evening' : 'sleep', di: dayIndex, vi: dayIndex, size: 'portrait', theme: 'night', hijri: true, scale: 1, days: daysToRamadan() || 1, bg: null, adhkar: null, verses: null };
  const list = () => S.kind === 'verse' ? S.verses : (S.adhkar && S.adhkar[S.time]) || [];
  const idx = () => S.kind === 'verse' ? S.vi : S.di;

  function fill() {
    const t = $('imgText'), r = $('imgRef'), L = list();
    if (S.kind === 'dhikr' && L.length) { S.di = ((S.di % L.length) + L.length) % L.length; t.value = L[S.di][0]; r.value = L[S.di][1]; }
    else if (S.kind === 'verse' && L.length) { S.vi = ((S.vi % L.length) + L.length) % L.length; t.value = L[S.vi][0]; r.value = 'سورة ' + L[S.vi][1]; }
    else if (S.kind === 'ramadan') { t.value = 'اللهم بلّغنا رمضان'; r.value = 'تقريبًا · بحسب تقويم أم القرى'; $('imgDays').value = S.days; }
    else if (S.kind === 'friday') { t.value = 'لا تنسوا قراءة سورة الكهف\nوالإكثار من الصلاة على النبي ﷺ'; r.value = ''; }
    else if (S.kind === 'free') { t.value = 'اكتب هنا النص الذي تريد نشره'; r.value = ''; }
  }
  function sync() {
    const set = (sel, key, val) => document.querySelectorAll(sel).forEach(b => b.setAttribute('aria-pressed', b.dataset[key] === val));
    set('#imgKind button', 'kind', S.kind); set('#imgTime button', 'time', S.time); set('#imgSize button', 'size', S.size); set('#imgTheme button', 'theme', S.theme);
    $('imgTimeField').hidden = S.kind !== 'dhikr';
    $('imgNav').hidden = !(S.kind === 'dhikr' || S.kind === 'verse');
    $('imgDaysField').hidden = S.kind !== 'ramadan';
    if (!$('imgNav').hidden) $('imgCount').textContent = ar(idx() + 1) + ' من ' + ar(list().length || 1);
    $('imgPhotoField').hidden = S.theme !== 'photo';
  }

  function wrap(text, maxW) {
    const lines = [];
    text.split('\n').forEach(par => {
      const words = par.trim().split(/[ \t]+/).filter(Boolean); let line = '';
      words.forEach(w => { const test = line ? line + ' ' + w : w; if (c.measureText(test).width <= maxW || !line) line = test; else { lines.push(line); line = w; } });
      if (line) lines.push(line);
    });
    return lines;
  }
  function fit(text, fam, weight, maxW, maxH, maxSize, minSize, lh) {
    let size = maxSize, lines = [];
    for (; size >= minSize; size -= 2) { c.font = `${weight} ${size}px ${fam}`; lines = wrap(text, maxW); if (lines.length * size * lh <= maxH) break; }
    if (size < minSize) { size = minSize; c.font = `${weight} ${size}px ${fam}`; lines = wrap(text, maxW); }
    return { size, lines };
  }
  const center = (t, y, font, color, dir) => CQ.text(c, t, cv.width / 2, y, font, color, 'center', dir);

  function draw() {
    const [W, H] = SIZES[S.size]; cv.width = W; cv.height = H;
    const T = CQ.THEMES[S.theme === 'photo' ? 'night' : S.theme];
    c.textBaseline = 'alphabetic';
    if (S.theme === 'photo' && S.bg) {
      CQ.cover(c, S.bg, 0, 0, W, H, .35);
      const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(7,11,28,.55)'); g.addColorStop(.5, 'rgba(7,11,28,.45)'); g.addColorStop(1, 'rgba(7,11,28,.8)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    }
    else {
      const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, T.top); g.addColorStop(1, T.bottom); c.fillStyle = g; c.fillRect(0, 0, W, H);
      const rg = c.createRadialGradient(W / 2, H * .16, 10, W / 2, H * .16, W * .75); rg.addColorStop(0, T.glow); rg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = rg; c.fillRect(0, 0, W, H);
      c.strokeStyle = T.pattern; c.lineWidth = 2; const step = 135;
      for (let y = -step / 2, row = 0; y < H + step; y += step * .866, row++) for (let x = (row % 2 ? step / 2 : 0) - step / 2; x < W + step; x += step) CQ.star8(c, x, y, 30);
    }
    const pad = Math.round(W * .045);
    c.strokeStyle = T.line; c.lineWidth = 2.5; c.strokeRect(pad, pad, W - pad * 2, H - pad * 2);
    c.globalAlpha = .35; c.lineWidth = 1.5; c.strokeRect(pad + 12, pad + 12, W - pad * 2 - 24, H - pad * 2 - 24); c.globalAlpha = 1;

    const story = S.size === 'story', safe = story ? 170 : 0;
    const brandY = pad + 108 + safe;
    CQ.brand(c, W, brandY, 58);
    const eyebrow = S.kind === 'dhikr' ? TIME_AR[S.time] : EYEBROW[S.kind];
    let top = brandY + 40;
    if (eyebrow) {
      const ey = brandY + 78; c.font = `400 32px ${FONT.ui}`; c.direction = 'rtl'; const ew = c.measureText(eyebrow).width;
      center(eyebrow, ey, `400 32px ${FONT.ui}`, T.gold);
      c.strokeStyle = T.line; c.lineWidth = 2; c.beginPath();
      c.moveTo(W / 2 + ew / 2 + 22, ey - 11); c.lineTo(W / 2 + ew / 2 + 82, ey - 11); c.moveTo(W / 2 - ew / 2 - 22, ey - 11); c.lineTo(W / 2 - ew / 2 - 82, ey - 11); c.stroke();
      top = ey + 30;
    }
    const urlY = H - pad - 44 - safe;
    center('cairoquran.com', urlY, `400 30px ${FONT.ui}`, T.soft, 'ltr');
    let bottom = urlY - 56;
    if (S.hijri) { const hd = hijriToday(); if (hd) { center(hd, urlY - 50, `300 28px ${FONT.ui}`, T.soft); bottom = urlY - 100; } }

    const text = $('imgText').value.trim(), ref = $('imgRef').value.trim(), maxW = W - pad * 2 - 150;
    if (S.kind === 'ramadan') {
      const n = Math.max(1, parseInt($('imgDays').value, 10) || S.days);
      const unit = n === 1 ? 'رمضان غدًا إن شاء الله' : n === 2 ? 'رمضان بعد يومين إن شاء الله' : (n <= 10 ? 'أيام على رمضان' : 'يومًا على رمضان');
      const avail = bottom - top; let big = story ? 360 : (S.size === 'portrait' ? 280 : 230);
      const parts = () => Math.max(110, big * .45) + (n > 2 ? big * .92 : 0) + 120 + (text ? 100 : 0) + (ref ? 56 : 0);
      while (parts() > avail - 20 && big > 120) big -= 10;
      let y = top + Math.max(10, (avail - parts()) / 2);
      CQ.crescent(c, W / 2, y + 48, 44, T.gold); y += Math.max(110, big * .45);
      if (n > 2) { center(ar(n), y + big * .76, `600 ${big}px ${FONT.ui}`, T.gold); y += big * .92; }
      center(unit, y + 78, `700 ${n > 2 ? 76 : 84}px ${FONT.ruqaa}`, T.ink); y += 120;
      if (text) { center(text, y + 64, `700 52px ${FONT.amiri}`, T.ink); y += 100; }
      if (ref) center(ref, y + 36, `300 28px ${FONT.ui}`, T.soft);
      return;
    }
    const titleSize = story ? 124 : 104, titleH = S.kind === 'friday' ? titleSize * 1.5 : 0;
    const shown = S.kind === 'verse' ? '﴿' + text + '﴾' : text, refH = ref ? 76 : 0, lh = 1.85;
    const weight = S.kind === 'friday' ? 400 : 700;
    const f = fit(shown, FONT.amiri, weight, maxW, bottom - top - refH - titleH - 40, (story ? 82 : 72) * S.scale, 26, lh);
    const blockH = titleH + f.lines.length * f.size * lh + refH;
    let y = top + Math.max(10, (bottom - top - blockH) / 2);
    if (titleH) { center('جمعة مباركة', y + titleSize * .95, `700 ${titleSize}px ${FONT.ruqaa}`, T.gold); y += titleH; }
    y += f.size * 1.15;
    c.font = `${weight} ${f.size}px ${FONT.amiri}`; c.fillStyle = T.ink; c.direction = 'rtl'; c.textAlign = 'center';
    c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = 18; f.lines.forEach(l => { c.fillText(l, W / 2, y); y += f.size * lh; }); c.shadowBlur = 0;
    if (ref) center(ref, y - f.size * lh + 30 + refH * .6, `400 32px ${FONT.ui}`, T.gold);
  }

  function caption() {
    const text = $('imgText').value.trim(), ref = $('imgRef').value.trim(), tag = CQ.hashtags;
    if (S.kind === 'dhikr') return `${TIME_AR[S.time]}\n\n${text}${ref ? '\n(' + ref + ')' : ''}\n\n${S.time === 'morning' ? '#أذكار_الصباح' : S.time === 'evening' ? '#أذكار_المساء' : '#أذكار_النوم'} #أذكار ${tag}`;
    if (S.kind === 'verse') return `قال الله تعالى:\n﴿${text}﴾${ref ? '\n[' + ref + ']' : ''}\n\n#تدبر ${tag}`;
    if (S.kind === 'ramadan') { const n = Math.max(1, parseInt($('imgDays').value, 10) || S.days); return `${n === 1 ? 'رمضان غدًا إن شاء الله' : n === 2 ? 'رمضان بعد يومين إن شاء الله' : 'باقٍ ' + ar(n) + (n <= 10 ? ' أيام' : ' يومًا') + ' على رمضان تقريبًا'}\n${text}\n\n#رمضان #اللهم_بلغنا_رمضان ${tag}`; }
    if (S.kind === 'friday') return `جمعة مباركة\n\n${text}\n\n#جمعة_مباركة #سورة_الكهف ${tag}`;
    return `${text}${ref ? '\n' + ref : ''}\n\n${tag}`;
  }

  let timer = 0, url = '';
  function render() {
    draw(); $('imgCaption').value = caption();
    cv.toBlob(b => {
      if (!b) return;
      if (url) URL.revokeObjectURL(url);
      const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      url = CQ.deliver(b, `cairo-quran-${S.kind}-${stamp}.png`, $('imgDownload'), $('imgShare'));
    }, 'image/png');
  }
  const later = () => { clearTimeout(timer); timer = setTimeout(render, 150); };
  const save = () => CQ.store.set('img', { kind: S.kind, time: S.time, size: S.size, theme: S.theme, hijri: S.hijri, scale: S.scale });

  function wire() {
    const seg = (id, key, fn) => $(id).addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; fn(b.dataset[key]); sync(); render(); save(); });
    seg('imgKind', 'kind', v => { S.kind = v; fill(); });
    seg('imgTime', 'time', v => { S.time = v; S.di = 0; fill(); });
    seg('imgSize', 'size', v => { S.size = v; });
    seg('imgTheme', 'theme', v => { S.theme = v; });
    $('imgPrev').addEventListener('click', () => { if (S.kind === 'verse') S.vi--; else S.di--; fill(); sync(); render(); });
    $('imgNext').addEventListener('click', () => { if (S.kind === 'verse') S.vi++; else S.di++; fill(); sync(); render(); });
    ['imgText', 'imgRef', 'imgDays'].forEach(id => $(id).addEventListener('input', later));
    $('imgHijri').addEventListener('change', e => { S.hijri = e.target.checked; render(); save(); });
    $('imgScale').addEventListener('input', e => { S.scale = +e.target.value; later(); save(); });
    $('imgPhoto').addEventListener('change', async e => { const f = e.target.files && e.target.files[0]; if (!f) return; try { S.bg = await CQ.loadImage(URL.createObjectURL(f)); render(); } catch (err) { CQ.say($('imgMsg'), err.message, 'bad'); } });
    $('imgCopy').addEventListener('click', () => CQ.copy($('imgCaption'), $('imgMsg')));
  }

  CQ.images = {
    async init() {
      const saved = CQ.store.get('img'); if (saved) Object.assign(S, saved);
      wire(); await CQ.fonts();
      const site = await CQ.site();
      S.adhkar = site.adhkar || { morning: [['سُبْحَانَ اللَّهِ وَبِحَمْدِهِ', 'مائة مرة']], evening: [['سُبْحَانَ اللَّهِ وَبِحَمْدِهِ', 'مائة مرة']], sleep: [['بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا', 'مرة واحدة']] };
      S.verses = site.verses || [['أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ', 'الرعد · ٢٨']];
      $('imgHijri').checked = S.hijri; $('imgScale').value = S.scale;
      fill(); sync(); render();
    }
  };
})();
