/* Studio page 2: recitation reels. Reciter + surah + verses -> recitation with each word lit as it is recited,
   recorded from the canvas in real time. Backgrounds: themed sky, a blurred photo, or the viewer's own video. */
(() => {
  const { $, ar } = CQ;
  const INTRO = 1.6, OUTRO = 3.4, MAX = 90, FPS = 30;
  const cv = $('recCanvas'), c = cv.getContext('2d'), safe = $('recSafe');
  const S = { layout: 'circle', bg: 'night', ratio: '9:16', bars: false, photo: null, bgPhoto: null, bgVideo: null, radios: 'إذاعات القرآن الكريم', busy: false, reciters: [], chapters: [] };
  const msg = t => CQ.say($('recMsg'), ...t);

  // Positions for each aspect ratio; only 9:16 has room for the large photo layouts.
  function geo(W, H, layout) {
    if (H === 1920) {
      if (layout === 'circle') return { brand: 300, photo: { kind: 'circle', cy: 525, r: 157 }, name: 770, box: [880, 1500], ref: 1555, bars: 1650 };
      if (layout === 'card') return { brand: 300, photo: { kind: 'card', y: 350, w: 460, h: 580 }, box: [1110, 1465], ref: 1540, bars: 1640 };
      return { brand: 300, photo: { kind: 'chip', cy: 440 }, box: [600, 1330], ref: 1400, bars: 1500 };
    }
    if (H === 1350) return { brand: 150, photo: { kind: 'chip', cy: 250 }, box: [340, 1020], ref: 1085, bars: 1170 };
    return { brand: 120, photo: { kind: 'chip', cy: 205 }, box: [280, 830], ref: 890, bars: 965 };
  }

  function drawReciter(J, G, W, t, dy) {
    const p = G.photo, img = J.photo;
    if (p.kind === 'circle') {
      const cx = W / 2, cy = p.cy + dy, r = p.r;
      c.save(); c.translate(cx, cy); c.rotate(t * .1);
      const cg = c.createConicGradient ? c.createConicGradient(0, 0, 0) : null;
      if (cg) { [0, .25, .5, .75, 1].forEach((q, i) => cg.addColorStop(q, i % 2 ? '#8a6a2e' : '#e8c27a')); c.fillStyle = cg; } else c.fillStyle = '#e8c27a';
      c.beginPath(); c.arc(0, 0, r + 8, 0, 7); c.fill(); c.restore();
      c.save(); c.beginPath(); c.arc(cx, cy, r, 0, 7); c.clip();
      if (img) CQ.cover(c, img, cx - r, cy - r, r * 2, r * 2, .25); else { c.fillStyle = '#141b3d'; c.fillRect(cx - r, cy - r, r * 2, r * 2); CQ.crescent(c, cx, cy, 70); }
      c.restore();
      CQ.text(c, J.reciter, W / 2, G.name + dy, `700 58px ${CQ.FONT.amiri}`, '#fdf6e9');
      CQ.text(c, J.label, W / 2, G.name + 60 + dy, `400 32px ${CQ.FONT.ui}`, '#e8c27a');
    } else if (p.kind === 'card') {
      const z = 1 + .035 * Math.min(t / J.total, 1), w = p.w * z, h = p.h * z, x = (W - w) / 2, y = p.y + dy;
      c.save(); c.shadowColor = 'rgba(0,0,0,.65)'; c.shadowBlur = 90; c.shadowOffsetY = 30; CQ.rrect(c, x, y, w, h, 26); c.fillStyle = '#141b3d'; c.fill(); c.restore();
      c.save(); CQ.rrect(c, x, y, w, h, 26); c.clip(); if (img) CQ.cover(c, img, x, y, w, h, .18); else CQ.crescent(c, W / 2, y + h / 2, 90); c.restore();
      c.strokeStyle = '#e8c27a'; c.lineWidth = 5; CQ.rrect(c, x, y, w, h, 26); c.stroke();
      CQ.text(c, J.reciter, W / 2, y + h + 72, `700 58px ${CQ.FONT.amiri}`, '#fdf6e9');
      CQ.text(c, J.label, W / 2, y + h + 128, `400 32px ${CQ.FONT.ui}`, '#e8c27a');
    } else {
      c.font = `700 58px ${CQ.FONT.amiri}`; const nw = c.measureText(J.reciter).width, pr = 60, gap = 22;
      const xr = W / 2 + (pr * 2 + gap + nw) / 2, cy = p.cy + dy;
      c.save(); c.beginPath(); c.arc(xr - pr, cy, pr, 0, 7); c.clip(); if (img) CQ.cover(c, img, xr - pr * 2, cy - pr, pr * 2, pr * 2, .25); else { c.fillStyle = '#141b3d'; c.fillRect(xr - 2 * pr, cy - pr, 2 * pr, 2 * pr); CQ.crescent(c, xr - pr, cy, 30); } c.restore();
      c.strokeStyle = '#e8c27a'; c.lineWidth = 4; c.beginPath(); c.arc(xr - pr, cy, pr, 0, 7); c.stroke();
      CQ.text(c, J.reciter, xr - pr * 2 - gap, cy + 4, `700 58px ${CQ.FONT.amiri}`, '#fdf6e9', 'right');
      CQ.text(c, J.label, xr - pr * 2 - gap, cy + 52, `400 32px ${CQ.FONT.ui}`, '#e8c27a', 'right');
    }
  }

  function render(J, t, at, env) {
    const W = cv.width, H = cv.height, G = J.geo, endAt = J.total - OUTRO;
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.filter = 'none'; c.globalAlpha = 1;
    if (J.bg === 'photo') CQ.backdrop(c, W, H, J.bgPhoto || J.photo, t, J.total, .42);
    else if (J.bg === 'video' && J.bgVideo) CQ.backdrop(c, W, H, J.bgVideo, t, J.total, .5);
    else CQ.sky(c, W, H, J.bg, t);
    if (J.bars) CQ.bars(c, W, G.bars, env, t);
    CQ.frame(c, W, H);
    const out = CQ.win(t, endAt, endAt + .8), show = 1 - out;
    CQ.brand(c, W, G.brand, 46, CQ.win(t, .3, 1.2) * show);
    c.globalAlpha = CQ.win(t, .4, 1.4) * show;
    drawReciter(J, G, W, t, (1 - CQ.win(t, .4, 1.4)) * 24);
    c.globalAlpha = 1;
    CQ.drawWords(c, J.words, J.size, at, Math.min(1, CQ.win(t, .8, 1.8) + .0001) * show);
    c.globalAlpha = CQ.win(t, 1.2, 2.2) * show;
    CQ.text(c, J.ref, W / 2, G.ref, `400 36px ${CQ.FONT.ui}`, '#e8c27a');
    c.globalAlpha = 1;
    CQ.endCard(c, W, H, CQ.win(t, endAt + .5, endAt + 1.6), S.radios);
    c.fillStyle = `rgba(5,8,22,${1 - CQ.win(t, 0, 1)})`; c.fillRect(0, 0, W, H);
    c.restore();
  }

  function setRatio() {
    const [W, H] = CQ.SIZES[S.ratio]; cv.width = safe.width = W; cv.height = safe.height = H;
    $('recStage').style.aspectRatio = `${W}/${H}`;
    document.querySelectorAll('#recLayout button').forEach(b => { b.disabled = S.ratio !== '9:16' && b.dataset.layout !== 'chip'; });
    CQ.safeZones(safe, $('recSafeToggle').checked ? S.ratio : '');
  }
  const effLayout = () => S.ratio === '9:16' ? S.layout : 'chip';

  function job(base) {
    const r = S.reciters.find(x => x.id === +$('recReciter').value);
    const J = Object.assign({ reciter: CQ.reciterName(r), label: CQ.reciterLabel(r), photo: S.photo, bg: S.bg, bgPhoto: S.bgPhoto, bgVideo: S.bgVideo, bars: S.bars }, base);
    J.geo = geo(cv.width, cv.height, effLayout());
    const [a, b] = J.geo.box;
    J.size = CQ.layoutWords(c, J.words, 110, a, cv.width - 220, b - a, cv.height === 1080 ? 88 : 104, 40);
    return J;
  }
  function idle() {
    setRatio();
    const J = job({ words: [{ text: 'اختر', start: 0, end: 0 }, { text: 'السورة', start: 0, end: 0 }, { text: 'والآيات', start: 0, end: 0 }], ref: 'ثم اضغط «معاينة»', total: 999 });
    if (S.bgVideo && S.bg === 'video') { S.bgVideo.currentTime = Math.min(1, S.bgVideo.duration || 0); }
    render(J, 3, 5, .4);
  }

  async function prepare() {
    const rid = +$('recReciter').value, ch = +$('recSurah').value, chapter = S.chapters.find(x => x.id === ch);
    let from = Math.max(1, Math.min(+$('recFrom').value || 1, chapter.verses_count)), to = Math.max(from, Math.min(+$('recTo').value || from, chapter.verses_count));
    $('recFrom').value = from; $('recTo').value = to;
    msg(['جارٍ جلب التلاوة والتوقيتات…']);
    const R = await CQ.recitation(rid, ch, from, to, MAX);
    return Object.assign(job({ words: R.words, ref: CQ.refText(chapter, from, to), total: INTRO + R.dur + OUTRO }), R);
  }

  async function run(mode) {
    if (S.busy) return; S.busy = true; setBusy(true); if (mode === 'record') $('recResult').hidden = true;
    const ac = new (window.AudioContext || window.webkitAudioContext)(); ac.resume();
    let rec = null, node = null;
    try {
      await CQ.fonts(); setRatio();
      const J = await prepare();
      const buf = await CQ.decode(ac, J.url, t => msg([t]));
      if (mode === 'cover') { render(J, INTRO + J.dur * .98, J.dur + 1, .3); cv.toBlob(b => { CQ.deliver(b, `cairo-quran-cover-${$('recSurah').value}.png`, $('recCoverLink'), $('recCoverShare')); $('recCoverLink').hidden = false; msg(['صورة الغلاف جاهزة. نزّلها واخترها غلافًا للمقطع عند النشر.', 'ok']); }, 'image/png'); return; }
      const an = ac.createAnalyser(); an.fftSize = 1024; const dest = ac.createMediaStreamDestination();
      node = ac.createBufferSource(); node.buffer = buf; node.connect(an); an.connect(dest); an.connect(ac.destination);
      const samples = new Float32Array(an.fftSize);
      if (mode === 'record') rec = CQ.startRecorder(cv, dest.stream, FPS);
      msg([mode === 'record' ? 'جارٍ إنشاء المقطع… اترك الصفحة ظاهرة حتى ينتهي.' : 'معاينة…']);
      if (J.bg === 'video' && S.bgVideo) { S.bgVideo.currentTime = 0; S.bgVideo.loop = true; S.bgVideo.muted = true; S.bgVideo.play().catch(() => {}); }
      await ac.resume(); const clock0 = ac.currentTime + .15; node.start(clock0 + INTRO, J.t0, J.dur);
      let env = 0;
      await new Promise(resolve => {
        const frame = () => {
          const t = Math.max(0, ac.currentTime - clock0), at = t - INTRO;
          if (at >= 0 && at <= J.dur) { an.getFloatTimeDomainData(samples); let q = 0; for (let i = 0; i < samples.length; i++) q += samples[i] * samples[i]; env = env * .6 + Math.min(1, Math.sqrt(q / samples.length) * 4) * .4; } else env *= .85;
          render(J, t, at, env); $('recBar').style.width = Math.min(100, t / J.total * 100) + '%';
          if (t >= J.total + .15) return resolve(); requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      });
      if (rec) {
        const blob = await rec.stop(), ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
        CQ.deliver(blob, `cairo-quran-${$('recSurah').value}-${$('recFrom').value}-${$('recTo').value}.${ext}`, $('recDownload'), $('recShare'));
        $('recPreview').src = URL.createObjectURL(blob);
        $('recCaption').value = `${J.plain}\n\n${J.ref}\nبصوت الشيخ ${J.reciter}${J.label ? ' · ' + J.label : ''}\n\n[اكتب هنا سؤالًا يفتح حوارًا مع المتابعين]\n\n${CQ.hashtags}`;
        $('recResult').hidden = false;
        msg([ext === 'mp4' ? 'المقطع جاهز: شاهده، ثم نزّله أو شاركه مباشرة.' : 'المقطع جاهز بصيغة WebM، ويقبلها فيسبوك. أما إنستجرام فيحتاج MP4، فأنشئه من Safari أو من إصدار حديث من Chrome.', 'ok']);
      } else msg(['انتهت المعاينة. إن أعجبتك فاضغط «إنشاء المقطع».', 'ok']);
    } catch (e) { rec && rec.abort(); msg([e.message || 'حدث خطأ غير متوقع.', 'bad']); }
    finally {
      try { node && node.stop(); } catch (_) {} try { ac.close(); } catch (_) {}
      if (S.bgVideo) S.bgVideo.pause();
      S.busy = false; setBusy(false); $('recBar').style.width = '0';
    }
  }
  const setBusy = on => ['recPreviewBtn', 'recRecordBtn', 'recCoverBtn'].forEach(id => $(id).setAttribute('aria-disabled', on ? 'true' : 'false'));

  async function onReciter() {
    const url = CQ.PHOTOS[+$('recReciter').value]; S.photo = null; $('recThumb').removeAttribute('src');
    $('recPhotoNote').textContent = url ? 'الصورة من Wikimedia Commons.' : 'لا توجد صورة لهذا القارئ؛ ارفع صورة أو يظهر الهلال.';
    if (url) try { S.photo = await CQ.loadImage(url, true); $('recThumb').src = url; } catch (e) {}
    save(); idle();
  }
  function onSurah() {
    const ch = S.chapters.find(x => x.id === +$('recSurah').value); if (!ch) return;
    $('recFrom').max = $('recTo').max = ch.verses_count;
    if (+$('recFrom').value > ch.verses_count) $('recFrom').value = 1;
    if (+$('recTo').value > ch.verses_count || +$('recTo').value < +$('recFrom').value) $('recTo').value = $('recFrom').value;
    save();
  }
  const save = () => CQ.store.set('rec', { r: $('recReciter').value, s: $('recSurah').value, f: $('recFrom').value, t: $('recTo').value, layout: S.layout, bg: S.bg === 'video' ? 'night' : S.bg, ratio: S.ratio, bars: S.bars });

  function wire() {
    const seg = (id, key, fn) => $(id).addEventListener('click', e => { const b = e.target.closest('button'); if (!b || b.disabled) return; fn(b.dataset[key]); document.querySelectorAll(`#${id} button`).forEach(x => x.setAttribute('aria-pressed', x === b)); save(); idle(); });
    seg('recLayout', 'layout', v => S.layout = v);
    seg('recBg', 'bg', v => { S.bg = v; $('recBgPhotoField').hidden = v !== 'photo'; $('recBgVideoField').hidden = v !== 'video'; });
    seg('recRatio', 'ratio', v => S.ratio = v);
    $('recBars').addEventListener('change', e => { S.bars = e.target.checked; save(); idle(); });
    $('recSafeToggle').addEventListener('change', () => CQ.safeZones(safe, $('recSafeToggle').checked ? S.ratio : ''));
    $('recReciter').addEventListener('change', onReciter);
    $('recSurah').addEventListener('change', () => { $('recFrom').value = 1; $('recTo').value = 1; onSurah(); });
    ['recFrom', 'recTo'].forEach(id => $(id).addEventListener('change', () => { onSurah(); }));
    $('recPhoto').addEventListener('change', async e => { const f = e.target.files && e.target.files[0]; if (!f) return; const u = URL.createObjectURL(f); try { S.photo = await CQ.loadImage(u); $('recThumb').src = u; $('recPhotoNote').textContent = 'تُستخدم صورتك المرفوعة.'; idle(); } catch (err) { msg([err.message, 'bad']); } });
    $('recBgPhoto').addEventListener('change', async e => { const f = e.target.files && e.target.files[0]; if (!f) return; try { S.bgPhoto = await CQ.loadImage(URL.createObjectURL(f)); idle(); } catch (err) { msg([err.message, 'bad']); } });
    $('recBgVideo').addEventListener('change', e => { const f = e.target.files && e.target.files[0]; if (!f) return; const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = URL.createObjectURL(f); v.addEventListener('loadeddata', () => { S.bgVideo = v; idle(); }, { once: true }); });
    $('recPreviewBtn').addEventListener('click', () => run('preview'));
    $('recRecordBtn').addEventListener('click', () => run('record'));
    $('recCoverBtn').addEventListener('click', () => run('cover'));
    $('recCopy').addEventListener('click', () => CQ.copy($('recCaption'), $('recMsg')));
  }

  CQ.recite = {
    async init() {
      wire(); await CQ.fonts();
      CQ.site().then(s => { S.radios = s.radios; });
      try {
        [S.reciters, S.chapters] = await Promise.all([CQ.fillReciters($('recReciter')), CQ.fillChapters($('recSurah'))]);
        const v = CQ.store.get('rec');
        if (v) { if (v.r) $('recReciter').value = v.r; if (v.s) $('recSurah').value = v.s; $('recFrom').value = v.f || 1; $('recTo').value = v.t || 1; Object.assign(S, { layout: v.layout || 'circle', bg: v.bg || 'night', ratio: v.ratio || '9:16', bars: !!v.bars }); }
        else { $('recSurah').value = '93'; $('recFrom').value = 1; $('recTo').value = 5; }
        const press = (id, key, val) => document.querySelectorAll(`#${id} button`).forEach(b => b.setAttribute('aria-pressed', b.dataset[key] === val));
        press('recLayout', 'layout', S.layout); press('recBg', 'bg', S.bg); press('recRatio', 'ratio', S.ratio); $('recBars').checked = S.bars;
        $('recBgPhotoField').hidden = S.bg !== 'photo'; $('recBgVideoField').hidden = S.bg !== 'video';
        onSurah(); await onReciter(); setBusy(false); msg(['']);
      } catch (e) { msg(['تعذّر تحميل قوائم القرّاء والسور. تأكد من الاتصال ثم أعد تحميل الصفحة.', 'bad']); idle(); }
    }
  };
})();
