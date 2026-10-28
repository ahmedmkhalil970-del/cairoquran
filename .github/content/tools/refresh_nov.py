# Writes reels.json for the weeks of 9, 16 and 23 November in the refreshed format: weekly series (metadata and caption
# only; the video shows no extra text), a reflection line in the caption for «آية وتدبّر», and a background photo from
# across the Islamic world and nature ("commons:<search>", freely licensed, credited automatically).
# live.json (site-screen reels, Tuesdays and Saturdays) is left as it is. Run from the repository root.
import json, datetime as dt
R = {
 2: ('عبد الباسط عبد الصمد', 'مرتّل', ['bas','murattal'], 'عبد_الباسط_عبد_الصمد', 'https://upload.wikimedia.org/wikipedia/commons/b/b9/Abdul_Basit_Abd_us-Samad_in_South_Africa_in_1966_%283%29_%28cropped%29.jpg', 'abdulbasit'),
 1: ('عبد الباسط عبد الصمد', 'مجوّد', ['bas','mujawwad'], 'عبد_الباسط_عبد_الصمد', 'https://upload.wikimedia.org/wikipedia/commons/b/b9/Abdul_Basit_Abd_us-Samad_in_South_Africa_in_1966_%283%29_%28cropped%29.jpg', 'abdulbasit-mujawwad'),
 6: ('محمود خليل الحصري', 'مرتّل', ['husar','murattal'], 'الحصري', 'https://upload.wikimedia.org/wikipedia/commons/7/70/Hussary.jpg', 'husary'),
 9: ('محمد صديق المنشاوي', 'مرتّل', ['minshaw','murattal'], 'المنشاوي', 'https://upload.wikimedia.org/wikipedia/commons/e/ee/Elminshwey.jpg', 'minshawi'),
 7: ('مشاري راشد العفاسي', 'مرتّل', ['afasy'], 'العفاسي', 'https://upload.wikimedia.org/wikipedia/commons/2/24/%D0%9C%D0%B8%D1%88%D0%B0%D1%80%D0%B8_%D0%A0%D0%B0%D1%88%D0%B8%D0%B4.jpg', 'alafasy'),
}
SURAH = {1:('الفاتحة','fatiha'),2:('البقرة','baqarah'),3:('آل عمران','imran'),7:('الأعراف','araf'),9:('التوبة','tawbah'),14:('إبراهيم','ibrahim'),18:('الكهف','kahf'),21:('الأنبياء','anbiya'),25:('الفرقان','furqan'),33:('الأحزاب','ahzab'),108:('الكوثر','kawthar')}
SERIES_TAG = {'دعاء من القرآن':'دعاء_من_القرآن','قارئ الأسبوع':'قارئ_الأسبوع','آية وتدبّر':'تدبر','من أذكار المساء':'أذكار_المساء','جمعة مباركة':'سورة_الكهف'}
AR = ['الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت','الأحد']
MON = {11:'نوفمبر',12:'ديسمبر'}
# date: (series, recitation, verses, background, hook, note, question, title)
P = {
 '2026-11-09': ('قارئ الأسبوع', 6, ['21:83'], 'commons:Sheikh Zayed Grand Mosque Abu Dhabi', 'الحصري… أول من سجّل المصحف كاملًا مرتّلًا', None, 'دعاء أيوب عليه السلام بعد سنوات من الصبر. لمن تدعو بالشفاء الليلة؟', '﴿وأنت أرحم الراحمين﴾'),
 '2026-11-11': ('آية وتدبّر', 9, ['2:45'], 'commons:Masjid al-Haram Kaaba', 'كيف تهون عليك الصلاة؟', 'الصبر والصلاة عونٌ على كل أمر، وتخفّ الصلاة على من خشع قلبه لله', 'متى شعرت أن الصلاة أخفّ عليك من أي وقت مضى؟', '﴿واستعينوا بالصبر والصلاة﴾'),
 '2026-11-12': ('من أذكار المساء', 7, ['2:255'], 'commons:Milky Way night sky desert', 'آية الكرسي… أعظم آية في كتاب الله', None, 'هل تجعلها آخر ما تقرؤه قبل النوم؟', 'آية الكرسي'),
 '2026-11-13': ('جمعة مباركة', 2, ['18:109'], 'commons:Ocean waves sunset', 'لو كان البحر حبرًا… ما نفدت كلمات الله', None, 'أي آية من سورة الكهف تستوقفك كل جمعة؟', '﴿قل لو كان البحر مدادا﴾'),
 '2026-11-15': ('دعاء من القرآن', 7, ['25:74'], "commons:Prophet's Mosque Medina", 'دعاء لكل بيت: قرّة العين في الزوج والذرية', None, 'لمن تدعو به من أهلك الليلة؟', '﴿ربنا هب لنا من أزواجنا وذرياتنا﴾'),
 '2026-11-16': ('قارئ الأسبوع', 9, ['1:1','1:2','1:3','1:4','1:5','1:6','1:7'], 'commons:Hassan II Mosque Casablanca', 'المنشاوي… صاحب الصوت الباكي', None, 'نقرؤها سبع عشرة مرة كل يوم. أي آية منها تتوقف عندها؟', 'سورة الفاتحة'),
 '2026-11-18': ('آية وتدبّر', 2, ['3:139'], 'commons:Sunrise over mountains clouds', 'رسالة لكل قلب متعب', 'نزلت بعد أُحد: لا تضعفوا ولا تحزنوا، فالعلوّ لكم ما دمتم على الإيمان', 'ما الذي يعيد إليك قوتك حين تضعف؟', '﴿ولا تهنوا ولا تحزنوا﴾'),
 '2026-11-19': ('من أذكار المساء', 9, ['2:285'], 'commons:Blue Mosque Istanbul', 'من خواتيم البقرة… من قرأ الآيتين في ليلة كفتاه', None, 'هل تختم يومك بخواتيم سورة البقرة؟', '﴿آمن الرسول بما أنزل إليه من ربه﴾'),
 '2026-11-20': ('جمعة مباركة', 7, ['18:23','18:24'], 'commons:Forest fog morning', 'قبل أن تقول: سأفعل غدًا', None, 'كم مرة نسيت أن تقول «إن شاء الله» في خطة كبيرة؟', '﴿ولا تقولن لشيء إني فاعل ذلك غدا﴾'),
 '2026-11-22': ('دعاء من القرآن', 6, ['14:40','14:41'], 'commons:Dome of the Rock Jerusalem', 'دعاء إبراهيم عليه السلام لنفسه ولذريته ولوالديه', None, 'من أول من تدعو له حين تدعو لوالديك؟', '﴿رب اجعلني مقيم الصلاة ومن ذريتي﴾'),
 '2026-11-23': ('قارئ الأسبوع', 1, ['108:1','108:2','108:3'], 'commons:Badshahi Mosque Lahore', 'عبد الباسط… الحنجرة الذهبية', None, 'أقصر سورة في القرآن. هل تحفظ معناها؟', 'سورة الكوثر · تلاوة مجوّدة'),
 '2026-11-25': ('آية وتدبّر', 7, ['9:51'], 'commons:Sahara desert dunes', 'آية تُسكت كل قلق', 'ما يصيب المؤمن مكتوب عند الله، فيطمئن قلبه ويتوكل عليه', 'متى احتجت إلى هذه الآية؟', '﴿قل لن يصيبنا إلا ما كتب الله لنا﴾'),
 '2026-11-26': ('من أذكار المساء', 7, ['2:286'], 'commons:Faisal Mosque Islamabad', 'خاتمة سورة البقرة: لا يكلف الله نفسًا إلا وسعها', None, 'أي دعاء في هذه الآية أقرب إلى قلبك؟', '﴿لا يكلف الله نفسا إلا وسعها﴾'),
 '2026-11-27': ('جمعة مباركة', 6, ['18:1'], 'commons:Putra Mosque Putrajaya', 'جمعة مباركة… هل قرأت الكهف اليوم؟', None, 'في أي وقت من الجمعة تقرأ سورة الكهف؟', '﴿الحمد لله الذي أنزل على عبده الكتاب﴾'),
 '2026-11-29': ('دعاء من القرآن', 9, ['7:23'], 'commons:Mountain lake reflection', 'الكلمات التي تاب بها آدم وزوجه', None, 'ما الذنب الذي تتمنى أن يُغفر لك الليلة؟', '﴿ربنا ظلمنا أنفسنا﴾'),
 '2026-11-30': ('قارئ الأسبوع', 7, ['33:41','33:42'], 'commons:Selimiye Mosque Edirne', 'مشاري العفاسي… صوت يعرفه ملايين البيوت', None, 'ما الذكر الذي يلازم لسانك صباحًا ومساءً؟', '﴿اذكروا الله ذكرا كثيرا﴾'),
 '2026-12-01': ('دعاء من القرآن', 2, ['3:8'], 'commons:Great Mosque of Kairouan', 'دعاء الثبات بعد الهداية', None, 'هل تدعو به كل يوم؟', '﴿ربنا لا تزغ قلوبنا بعد إذ هديتنا﴾'),
}
WEEKS = {'2026-11-09': ('2026-11-09', '2026-11-16'), '2026-11-16': ('2026-11-16', '2026-11-23'), '2026-11-23': ('2026-11-23', '2026-12-02')}
for w, (a, b) in WEEKS.items():
    live = {x['at'][:10]: x for x in json.load(open(f'.github/content/{w}/live.json'))}
    d, end, n, out = dt.date.fromisoformat(a), dt.date.fromisoformat(b), 0, []
    while d < end:
        n += 1
        k = d.isoformat()
        if k in live:   # keep the live reel's numbering in step with its day
            live[k]['id'] = f'{n}-' + live[k]['id'].split('-', 1)[1]
        elif k in P:
            series, rid, verses, bg, hook, note, q, title = P[k]
            name, label, expect, rtag, photo, slug = R[rid]
            ch = int(verses[0].split(':')[0]); sname, sslug = SURAH[ch]
            h = 7 if d.weekday() == 4 else 20
            tags = [SERIES_TAG[series], 'سورة_' + sname.replace(' ', '_'), rtag, 'قرآن_كريم', 'CairoQuran']
            tags = list(dict.fromkeys(tags))   # no duplicate hashtags
            out.append(dict(id=f'{n}-{slug}-{sslug}-{verses[0].split(":")[1]}', at=f'{k}T{h:02d}:00:00+03:00',
                when=f'{AR[d.weekday()]} {d.day} {MON[d.month]} · ' + ('7:00 صباحًا' if h == 7 else '8:00 مساءً'),
                type='reel', platforms=['facebook','instagram','youtube'], style='place', background=bg,
                series=series,
                reciter=name, label=label, recitation=rid, expect=expect, verses=verses, surah='سورة ' + sname, photo=photo,
                title=f'{title} | {series} | Cairo Quran',
                caption='{{verse}}\n\n{{ref}}\nبصوت الشيخ ' + name + (f'\n\n{note}.' if note else '') + f'\n\n{q}\n\n' + ' '.join('#' + t for t in tags)))
        d += dt.timedelta(days=1)
    json.dump(out, open(f'.github/content/{w}/reels.json', 'w'), ensure_ascii=False, indent=2)
    json.dump(list(live.values()), open(f'.github/content/{w}/live.json', 'w'), ensure_ascii=False, indent=2)
    print(w, len(out), 'reels', len(live), 'live')
