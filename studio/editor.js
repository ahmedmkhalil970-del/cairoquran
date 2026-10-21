/* Studio page 3: the viewer's own video. Trim, frame for Reels (crop or fit), colour look, title,
   a verse (static, or with a recitation whose words light up in time), brand and the closing card;
   then record the result and download or share it. */
(() => {
  const { $ } = CQ;
  const FPS = 30, OUTRO = 3.4, INTRO = .6, MAX = 90;
  const cv = $('edCanvas'), c = cv.getContext('2d'), safe = $('edSafe');
  const LOOKS = { none: 'none', warm: 'sepia(.25) saturate(1.15) brightness(1.02)', bw: 'grayscale(1) contrast(1.08)', dim: 'brightness(.72)', soft: 'contrast(.92) saturate(.9) brightness(1.05)' };
  const S = { video: null, src: null, ac: null, gain: null, dest: null, ratio: '9:16', fit: 'fill', look: 'none', verse: 'none', busy: false, radios: 'إذاعات القرآن الكريم', reciters: [], chapters: [], text: null };
  const msg = (t, k) => CQ.say($('edMsg'), t, k);
  const num = id => +$(id).value;

  function geo(W, H) {
    if (H === 1920) return { brand: 300, title: 420, box: [H * .52, H * .76], ref: H * .785, sub: H * .815 };
    if (H === 1350) return { brand: 140, title: 235, box: [H * .55, H * .83], ref: H * .87, sub: H * .92 };
    return { brand: 115, title: 200, box: [H * .55, H * .82], ref: H * .865, sub: H * .92 };
  }

  function drawVideo(v, W, H, t) {
    const vw = v.videoWidth, vh = v.videoHeight; if (!vw) { c.fillStyle = '#070b1c'; c.fillRect(0, 0, W, H); return; }
    if (S.fit === 'fit') {
      CQ.backdrop(c, W, H, v, 0, 1, .5);
      const s = Math.min(W / vw, H / vh), w = vw * s, h = vh * s;
      c.save(); c.filter = LOOKS[S.look]; c.drawImage(v, (W - w) / 2, (H - h) / 2, w, h); c.restore();
    } else {
      const z = num('edZoom'), s = Math.max(W / vw, H / vh) * z, w = vw * s, h = vh * s;
      const x = (W - w) / 2 + (w - W) / 2 * num('edPanX'), y = (H - h) / 2 + (h - H) / 2 * num('edPanY');
      c.save(); c.filter = LOOKS[S.look]; c.fillStyle = '#000'; c.fillRect(0, 0, W, H); c.drawImage(v, x, y, w, h); c.restore();
    }
  }

  function render(t, at, total, endAt) {
    const W = cv.width, H = cv.height, G = geo(W, H), v = S.video;
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.filter = 'none';
    if (v) drawVideo(v, W, H, t); else { CQ.sky(c, W, H, 'night', t); CQ.text(c, 'ارفع فيديو للبدء', W / 2, H / 2, `400 ${W * .05}px ${CQ.FONT.ui}`, 'rgba(253,246,233,.7)'); }
    const hasText = S.text || $('edTitle').value.trim() || $('edSub').value.trim();
    if (hasText) { const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(7,11,28,.45)'); g.addColorStop(.3, 'rgba(7,11,28,0)'); g.addColorStop(.48, 'rgba(7,11,28,0)'); g.addColorStop(1, 'rgba(7,11,28,.82)'); c.fillStyle = g; c.fillRect(0, 0, W, H); }
    const out = endAt != null ? CQ.win(t, endAt, endAt + .8) : 0, show = 1 - out;
    if ($('edBrand').checked) CQ.brand(c, W, G.brand, 46, show);
    const title = $('edTitle').value.trim();
    if (title) { c.globalAlpha = show; c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 20; CQ.text(c, title, W / 2, G.title, `600 ${num('edTitleSize')}px ${CQ.FONT.ui}`, '#fdf6e9'); c.shadowBlur = 0; c.globalAlpha = 1; }
    if (S.text) {
      CQ.drawWords(c, S.text.words, S.text.size, S.verse === 'recite' ? at : null, show);
      c.globalAlpha = show; CQ.text(c, S.text.ref, W / 2, G.ref, `400 34px ${CQ.FONT.ui}`, '#e8c27a'); c.globalAlpha = 1;
    }
    const sub = $('edSub').value.trim();
    if (sub) { c.globalAlpha = show; CQ.text(c, sub, W / 2, G.sub, `400 32px ${CQ.FONT.ui}`, 'rgba(253,246,233,.9)'); c.globalAlpha = 1; }
    if (endAt != null && $('edEnd').checked && t > endAt) {
      const a = CQ.win(t, endAt, endAt + 1); c.fillStyle = `rgba(7,11,28,${.82 * a})`; c.fillRect(0, 0, W, H);
      CQ.endCard(c, W, H, CQ.win(t, endAt + .4, endAt + 1.5), S.radios);
    }
    if (t != null && t < .6) { c.fillStyle = `rgba(5,8,22,${1 - CQ.win(t, 0, .6)})`; c.fillRect(0, 0, W, H); }
    c.restore();
  }

  function setRatio() {
    const [W, H] = CQ.SIZES[S.ratio]; cv.width = safe.width = W; cv.height = safe.height = H;
    $('edStage').style.aspectRatio = `${W}/${H}`;
    CQ.safeZones(safe, $('edSafeToggle').checked ? S.ratio : '');
    if (S.text) layoutText();
  }
  function layoutText() { const G = geo(cv.width, cv.height); S.text.size = CQ.layoutWords(c, S.text.words, 90, G.box[0], cv.width - 180, G.box[1] - G.box[0], cv.height === 1920 ? 84 : 72, 34); }
  function still() { if (S.busy) return; setRatio(); render(1.5, 1e9, null, null); }

  function trimRange() {
    const d = S.video ? S.video.duration : 0; let a = Math.max(0, Math.min(num('edStart'), d)), b = Math.max(a + .5, Math.min(num('edEnd2') || d, d));
    return [a, Math.min(b, d)];
  }

  async function loadVerse() {
    S.text = null; if (S.verse === 'none') return null;
    const ch = num('edSurah'), chapter = S.chapters.find(x => x.id === ch); if (!chapter) return null;
    let from = Math.max(1, Math.min(num('edFrom') || 1, chapter.verses_count)), to = Math.max(from, Math.min(num('edTo') || from, chapter.verses_count));
    $('edFrom').value = from; $('edTo').value = to;
    const ref = CQ.refText(chapter, from, to);
    if (S.verse === 'static') { const T = await CQ.verseText(ch, from, to); S.text = { words: T.words, plain: T.plain, ref }; }
    else { const R = await CQ.recitation(num('edReciter'), ch, from, to, MAX); S.text = { words: R.words, plain: R.plain, ref, R }; }
    layoutText(); return S.text;
  }

  function ensureAudio() {
    if (!S.ac) { S.ac = new (window.AudioContext || window.webkitAudioContext)(); S.dest = S.ac.createMediaStreamDestination(); }
    if (S.video && !S.src) { S.src = S.ac.createMediaElementSource(S.video); S.gain = S.ac.createGain(); S.src.connect(S.gain); S.gain.connect(S.dest); S.gain.connect(S.ac.destination); }
    S.ac.resume();
  }

  async function run(record) {
    if (S.busy) return; if (!S.video) { msg('ارفع فيديو أولًا.', 'bad'); return; }
    S.busy = true; setBusy(true); if (record) $('edResult').hidden = true;
    ensureAudio(); const ac = S.ac;
    let rec = null, node = null;
    try {
      await CQ.fonts(); setRatio();
      msg('جارٍ التجهيز…'); await loadVerse();
      const v = S.video, [a, b] = trimRange(), clip = b - a;
      const R = S.text && S.text.R;
      let buf = null; if (R) buf = await CQ.decode(ac, R.url, msg);
      const body = R ? INTRO + R.dur : clip, endAt = $('edEnd').checked ? body : null, total = body + (endAt != null ? OUTRO : 0);
      S.gain.gain.value = num('edVolOrig');
      v.muted = false; v.loop = false; v.currentTime = a;
      await new Promise(res => { if (!v.seeking) res(); else v.addEventListener('seeked', res, { once: true }); });
      if (record) rec = CQ.startRecorder(cv, S.dest.stream, FPS);
      msg(record ? 'جارٍ إنشاء المقطع… اترك الصفحة ظاهرة حتى ينتهي.' : 'معاينة…');
      await ac.resume(); const clock0 = ac.currentTime + .1;
      if (buf) { node = ac.createBufferSource(); node.buffer = buf; const g = ac.createGain(); g.gain.value = num('edVolRec'); node.connect(g); g.connect(S.dest); g.connect(ac.destination); node.start(clock0 + INTRO, R.t0, R.dur); }
      await v.play().catch(() => {});
      await new Promise(resolve => {
        const frame = () => {
          const t = Math.max(0, ac.currentTime - clock0);
          if (v.currentTime >= b - .03) { if (t < body - .05) { v.currentTime = a; v.play().catch(() => {}); } else v.pause(); }
          if (endAt != null && t >= endAt && !v.paused) v.pause();
          render(t, t - INTRO, total, endAt); $('edBar').style.width = Math.min(100, t / total * 100) + '%';
          if (t >= total + .1) return resolve(); requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      });
      v.pause();
      if (rec) {
        const blob = await rec.stop(), ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
        CQ.deliver(blob, `cairo-quran-video.${ext}`, $('edDownload'), $('edShare'));
        $('edPreview').src = URL.createObjectURL(blob);
        $('edCaption').value = (S.text ? `${S.text.plain}\n\n${S.text.ref}${R ? '\nبصوت الشيخ ' + $('edReciter').selectedOptions[0].text : ''}\n\n` : '') + `${$('edTitle').value.trim() ? $('edTitle').value.trim() + '\n\n' : ''}${CQ.hashtags}`;
        $('edResult').hidden = false;
        msg(ext === 'mp4' ? 'المقطع جاهز: شاهده، ثم نزّله أو شاركه مباشرة.' : 'المقطع جاهز بصيغة WebM، ويقبلها فيسبوك. أما إنستجرام فيحتاج MP4، فأنشئه من Safari أو من إصدار حديث من Chrome.', 'ok');
      } else msg('انتهت المعاينة.', 'ok');
    } catch (e) { rec && rec.abort(); msg(e.message || 'حدث خطأ غير متوقع.', 'bad'); }
    finally { try { node && node.stop(); } catch (_) {} if (S.video) S.video.pause(); S.busy = false; setBusy(false); $('edBar').style.width = '0'; still(); }
  }
  const setBusy = on => ['edPreviewBtn', 'edRecordBtn'].forEach(id => $(id).setAttribute('aria-disabled', on ? 'true' : 'false'));

  function onFile(f) {
    if (!f) return;
    const v = document.createElement('video'); v.playsInline = true; v.preload = 'auto'; v.crossOrigin = 'anonymous'; v.src = URL.createObjectURL(f);
    v.addEventListener('loadedmetadata', () => {
      if (S.video) { try { S.src && S.src.disconnect(); } catch (e) {} S.src = null; }
      S.video = v;
      const d = v.duration; ['edStart', 'edEnd2'].forEach(id => { $(id).max = d.toFixed(1); });
      $('edStart').value = 0; $('edEnd2').value = Math.min(d, 60).toFixed(1); showTrim();
      $('edInfo').textContent = `${f.name} · ${Math.round(d)} ثانية · ${v.videoWidth}×${v.videoHeight}`;
      v.currentTime = Math.min(1, d / 3);
      v.addEventListener('seeked', still, { once: true });
      setBusy(false);
    }, { once: true });
    v.addEventListener('error', () => msg('تعذّر قراءة الفيديو. جرّب ملف MP4 أو MOV.', 'bad'), { once: true });
  }
  function showTrim() { const [a, b] = trimRange(); $('edTrimOut').textContent = `من ${a.toFixed(1)} إلى ${b.toFixed(1)} ثانية · المدة ${(b - a).toFixed(1)} ثانية`; }

  function wire() {
    $('edFile').addEventListener('change', e => onFile(e.target.files && e.target.files[0]));
    const seg = (id, key, fn) => $(id).addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; fn(b.dataset[key]); document.querySelectorAll(`#${id} button`).forEach(x => x.setAttribute('aria-pressed', x === b)); still(); });
    seg('edRatio', 'ratio', v => S.ratio = v);
    seg('edFit', 'fit', v => { S.fit = v; $('edFrameFields').hidden = v !== 'fill'; });
    seg('edLook', 'look', v => S.look = v);
    seg('edVerse', 'verse', v => { S.verse = v; $('edVerseFields').hidden = v === 'none'; $('edReciterField').hidden = v !== 'recite'; $('edVolRecField').hidden = v !== 'recite'; S.text = null; if (v !== 'none') loadVerse().then(still).catch(e => msg(e.message, 'bad')); });
    ['edZoom', 'edPanX', 'edPanY', 'edTitleSize'].forEach(id => $(id).addEventListener('input', still));
    ['edTitle', 'edSub'].forEach(id => $(id).addEventListener('input', still));
    ['edBrand', 'edEnd'].forEach(id => $(id).addEventListener('change', still));
    $('edSafeToggle').addEventListener('change', () => CQ.safeZones(safe, $('edSafeToggle').checked ? S.ratio : ''));
    ['edStart', 'edEnd2'].forEach(id => $(id).addEventListener('input', () => { showTrim(); if (S.video && !S.busy) { S.video.currentTime = id === 'edStart' ? num('edStart') : Math.max(0, num('edEnd2') - .1); S.video.addEventListener('seeked', still, { once: true }); } }));
    ['edSurah', 'edFrom', 'edTo', 'edReciter'].forEach(id => $(id).addEventListener('change', () => { if (id === 'edSurah') { $('edFrom').value = 1; $('edTo').value = 1; } if (S.verse !== 'none') loadVerse().then(still).catch(e => msg(e.message, 'bad')); }));
    $('edPreviewBtn').addEventListener('click', () => run(false));
    $('edRecordBtn').addEventListener('click', () => run(true));
    $('edCopy').addEventListener('click', () => CQ.copy($('edCaption'), $('edMsg')));
  }

  CQ.editor = {
    async init() {
      wire(); setBusy(true); await CQ.fonts();
      CQ.site().then(s => { S.radios = s.radios; });
      try { [S.reciters, S.chapters] = await Promise.all([CQ.fillReciters($('edReciter')), CQ.fillChapters($('edSurah'))]); $('edSurah').value = '94'; $('edFrom').value = 5; $('edTo').value = 6; } catch (e) { msg('تعذّر تحميل قوائم القرّاء والسور. يمكنك تحرير الفيديو دون آية.', 'bad'); }
      still();
    }
  };
})();
