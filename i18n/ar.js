/* Cairo Quran · Arabic strings.
   Every language is one file like this one: window.I18N.<code> = { ... }.
   Text that lives in index.html as markup (data-i18n="key") needs no entry here for Arabic: the page keeps the
   Arabic it was written with and uses it when switching back. This file holds the strings built by the script.
   To add a language, copy en.js to <code>.js, translate it, list the code in LANGS (index.html, <head>) and load the file.
   Anything missing in a language falls back to English, then Arabic. */
(function () {
  var D = window.I18N = window.I18N || {};
  D.ar = {
    name: 'العربية',                       // shown on the language button of the other languages
    langAria: 'تغيير اللغة',
    dir: 'rtl',
    numLocale: 'ar-EG', dateLocale: 'ar-EG', hijriLocale: 'ar-EG-u-ca-islamic-umalqura',
    title: 'Cairo Quran · قرآن وأذان وأذكار',
    description: 'Cairo Quran: إذاعة القرآن الكريم من القاهرة وإذاعات كبار القرّاء، مع مواقيت الصلاة وتنبيه بموعدها وأذكار الصباح والمساء.',

    prayer: { fajr: 'الفجر', sunrise: 'الشروق', dhuhr: 'الظهر', asr: 'العصر', maghrib: 'المغرب', isha: 'العشاء' },
    prayerOf: function (name) { return 'صلاة ' + name; },
    am: 'صباحًا', pm: 'مساءً',
    cityLabel: function (name) { return 'مواقيت الصلاة · ' + name; },
    countdown: function (name, hm) { return 'باقٍ على ' + name + ' ' + hm; },

    occasion: { arafah: 'يوم عرفة', eidAdha: 'عيد الأضحى', hijriNewYear: 'رأس السنة الهجرية', ashura: 'يوم عاشوراء' },
    daysWord: function (n, nf) {
      if (n === 1) return 'يوم واحد';
      if (n === 2) return 'يومان';
      if (n <= 10) return nf(n) + ' أيام';
      return nf(n) + ' يومًا';
    },
    ramadanDay: function (d) { return 'رمضان كريم 🌙 · اليوم ' + d + ' من رمضان'; },
    eidFitr: 'عيد فطر مبارك 🌙',
    arafahToday: 'يوم عرفة · خير الدعاء دعاء يوم عرفة',
    eidAdhaToday: 'عيد أضحى مبارك 🌙',
    newYearToday: 'كل عام وأنتم بخير · سنة هجرية مباركة',
    ashuraToday: 'يوم عاشوراء',
    nextOccasion: function (days, name) { return 'باقٍ ' + days + ' على ' + name + ' تقريبًا'; },
    rcdTomorrow: '🌙 رمضان غدًا إن شاء الله',
    rcdInTwo: '🌙 رمضان بعد يومين إن شاء الله',
    rcdUntil: '🌙 باقٍ على رمضان',
    rcdUnit: function (n) { return n <= 10 ? 'أيام' : 'يومًا'; },
    imsak: function (t) { return ' · الإمساك ' + t; },
    iftarIn: function (t) { return ' · الإفطار بعد ' + t; },

    pickerStation: 'ماذا تحب أن تسمع؟',
    pickerCity: 'اختر مدينتك',
    pickerCitySub: 'تُحسب المواقيت بالطريقة الرسمية لكل دولة',
    settings: 'الإعدادات',
    adhanItem: function (on) { return on ? 'تنبيه الصلاة: مفعّل ✓' : 'تنبيه الصلاة: متوقف'; },
    adhkarItem: function (on) { return on ? 'شريط الأذكار: ظاهر ✓' : 'شريط الأذكار: مخفي'; },
    langItem: function (nextName) { return 'اللغة: العربية · ' + nextName; },
    tvChipStation: '▲ تغيير المحطة', tvChipCity: '▼ تغيير المدينة',

    adhkarLabel: { morning: 'أذكار الصباح', evening: 'أذكار المساء', sleep: 'أذكار النوم' },
    counter: function (pass, reps, nf) { return nf(pass) + ' من ' + nf(reps); },

    st: {
      ready: 'جاهز للتشغيل', connecting: 'جارٍ الاتصال بالبث…', live: 'على الهواء مباشرة', loading: 'جارٍ التحميل…',
      paused: 'متوقف مؤقتًا', prayerTime: function (name) { return 'موعد صلاة ' + name; }
    },
    reconnect: function (code) { return 'انقطع البث، إعادة المحاولة…' + (code ? ' (' + code + ')' : ''); },
    appVersion: function (v) { return 'نسخة التطبيق ' + v; },
    mediaArtist: 'Cairo Quran · بث مباشر',
    playLabel: 'تشغيل', stopLabel: 'إيقاف', playAria: 'تشغيل البث', stopAria: 'إيقاف البث',
    gateHintTouch: 'اضغط زر التشغيل لبدء البث',
    gateResumeTouch: 'اضغط زر التشغيل لاستئناف البث', gateResumeTv: 'اضغط OK لاستئناف البث',
    adhanHintTv: 'اضغط OK للإخفاء', adhanHintWeb: 'اضغط في أي مكان للإخفاء',

    visitsToday: 'زوار اليوم', visitsTotal: 'إجمالي الزيارات',
    shareText: 'Cairo Quran 📻 إذاعة القرآن الكريم وإذاعات كبار القرّاء، مع مواقيت الصلاة لمدينتك وتنبيه بموعدها وأذكار الصباح والمساء.',
    copied: 'تم النسخ ✓', copyManual: 'انسخه يدويًا', copyLink: 'نسخ الرابط', contactCopied: 'تم ✓', contactCopy: 'نسخ',
    appAdded: 'تمت الإضافة ✓ هتلاقي Cairo Quran على الشاشة الرئيسية.',
    updCodeHint: function (alt, code) { return (alt ? 'أو ' : 'للتحديث: ') + 'افتح تطبيق Downloader واكتب <span class="code">' + code + '</span>'; },
    updDownloading: function (pct) { return 'جارٍ تحميل التحديث… ' + pct + '٪'; },
    updDownloadingNoPct: 'جارٍ تحميل التحديث…',
    updDone: 'اكتمل التحميل، جارٍ فتح شاشة التثبيت…',
    updPermission: 'مرة واحدة فقط: فعّل السماح لهذا التطبيق بالتثبيت، ثم اضغط رجوع',
    updInstall: 'اضغط «تثبيت» في الشاشة التالية',
    updFailed: function (hint) { return 'تعذّر التحديث الآن. حاول مرة أخرى، ' + hint; },
    updRetry: 'حاول مرة أخرى',

    photoCredit: function (by, lic) { return 'صورة: ' + (by ? by + ' · ' : '') + lic + ' · ويكيميديا كومنز'; },
    licenses: { PD: 'ملكية عامة' },
    digits: true                              // show the facts under photos with Arabic-Indic digits
  };
})();
