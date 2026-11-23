# Candidate photos for the slideshow, found on Wikimedia Commons without anyone's computer.
# Reads .github/photos/request.tsv (one place per line: c, k, q, en_where, ar_name, ar_where, ar_fact, en_fact),
# searches Commons for each query q, keeps free-licensed landscape photos at least 1600 px wide, and writes to out/:
#   candidates.json  every place with its numbered candidates (title, size, author, licence, thumbnail)
#   sheet-NN.jpg     contact sheets: 4 places per sheet, 6 candidates each (24 per sheet), numbered "row.letter"
# Picking is done by eye from the sheets; the chosen "row.letter" lines then become entries in data/places.js.
import html, json, os, re, sys, time, urllib.parse, urllib.request
from io import BytesIO
from PIL import Image, ImageDraw, ImageFont

REQ = sys.argv[1] if len(sys.argv) > 1 else '.github/photos/request.tsv'
OUT = 'out'
PER_PLACE, PLACES_PER_SHEET = 6, 4
MIN_W, MIN_RATIO, MAX_RATIO = 1600, 1.2, 2.4
UA = 'CairoQuranPhotoCandidates/1.0 (slideshow photo search; github.com/' + os.environ.get('GITHUB_REPOSITORY', 'cairoquran') + ')'
API = 'https://commons.wikimedia.org/w/api.php'
FREE = re.compile(r'^(CC BY(-SA)? [0-9.]+( [A-Za-z]{2,})?|CC0( 1\.0)?|Public domain|PD.*)$', re.I)

def get(url, tries=4):
    for a in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=40) as r:
                return r.read()
        except Exception as e:
            if a == tries - 1: raise
            time.sleep(4 * (a + 1))

def text(v):
    return html.unescape(re.sub(r'<[^>]+>', '', v or '')).strip()

def search(q):
    p = {'action': 'query', 'format': 'json', 'generator': 'search', 'gsrsearch': q + ' filetype:bitmap', 'gsrnamespace': 6,
         'gsrlimit': 30, 'prop': 'imageinfo', 'iiprop': 'url|size|mime|extmetadata', 'iiurlwidth': 330,
         'iiextmetadatafilter': 'Artist|LicenseShortName|Credit'}
    d = json.loads(get(API + '?' + urllib.parse.urlencode(p)))
    pages = sorted((d.get('query') or {}).get('pages', {}).values(), key=lambda x: x.get('index', 0))
    out = []
    for pg in pages:
        ii = (pg.get('imageinfo') or [{}])[0]
        w, h = ii.get('width', 0), ii.get('height', 1)
        meta = ii.get('extmetadata') or {}
        lic = text((meta.get('LicenseShortName') or {}).get('value'))
        by = text((meta.get('Artist') or {}).get('value')) or text((meta.get('Credit') or {}).get('value'))
        if ii.get('mime') != 'image/jpeg' or w < MIN_W or not (MIN_RATIO <= w / h <= MAX_RATIO): continue
        if not FREE.match(lic) or re.search(r'\b(NC|ND)\b', lic): continue
        out.append({'title': pg['title'][5:], 'w': w, 'h': h, 'by': re.sub(r'\s+', ' ', by)[:80], 'lic': lic, 'thumb': ii.get('thumburl')})
        if len(out) == PER_PLACE: break
    return out

def font(size):
    for f in ('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'):
        if os.path.exists(f): return ImageFont.truetype(f, size)
    return ImageFont.load_default()

def sheets(places):
    TW, TH, HEAD, GAP = 330, 220, 30, 8
    f, fs = font(20), font(15)
    groups = [places[i:i + PLACES_PER_SHEET] for i in range(0, len(places), PLACES_PER_SHEET)]
    for n, g in enumerate(groups, 1):
        W = PER_PLACE * (TW + GAP) + GAP
        H = len(g) * (HEAD + TH + GAP) + GAP
        img = Image.new('RGB', (W, H), (12, 14, 30))
        d = ImageDraw.Draw(img)
        for r, pl in enumerate(g):
            y = GAP + r * (HEAD + TH + GAP)
            d.text((GAP, y + 4), '%d  %s · %s  (%s)' % (pl['row'], pl['c'], pl['k'], pl['q']), fill=(232, 194, 122), font=f)
            for j, cand in enumerate(pl['candidates']):
                x = GAP + j * (TW + GAP)
                try:
                    t = Image.open(BytesIO(get(cand['thumb']))).convert('RGB')
                    t.thumbnail((TW, TH))
                    img.paste(t, (x + (TW - t.width) // 2, y + HEAD + (TH - t.height) // 2))
                except Exception:
                    d.rectangle([x, y + HEAD, x + TW, y + HEAD + TH], outline=(120, 40, 40))
                label = '%d.%s  %d' % (pl['row'], 'abcdef'[j], cand['w'])
                d.rectangle([x, y + HEAD, x + 8 + d.textlength(label, font=fs), y + HEAD + 22], fill=(0, 0, 0))
                d.text((x + 4, y + HEAD + 2), label, fill=(255, 255, 255), font=fs)
                time.sleep(0.2)
            if not pl['candidates']:
                d.text((GAP, y + HEAD + 90), 'no candidates', fill=(200, 90, 90), font=f)
        img.save(os.path.join(OUT, 'sheet-%02d.jpg' % n), quality=85)

def main():
    os.makedirs(OUT, exist_ok=True)
    rows = [l.split('\t') for l in open(REQ, encoding='utf-8').read().strip('\n').split('\n') if l.strip()]
    places = []
    for i, r in enumerate(rows):
        c, k, q = r[0], r[1], r[2]
        try: cands = search(q)
        except Exception as e: print('search failed', i, q, e); cands = []
        if len(cands) < 3 and k.lower() != q.lower():          # a narrow query found little: try the place name alone
            try:
                seen = {x['title'] for x in cands}
                cands += [x for x in search(k) if x['title'] not in seen][:PER_PLACE - len(cands)]
            except Exception as e: print('search failed', i, k, e)
        print('%3d %-3s %-40s %d' % (i, c, q[:40], len(cands)))
        places.append({'row': i, 'c': c, 'k': k, 'q': q, 'candidates': cands})
        time.sleep(0.5)
    json.dump(places, open(os.path.join(OUT, 'candidates.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    sheets(places)
    print('places', len(places), 'with candidates', sum(1 for p in places if p['candidates']))

main()
