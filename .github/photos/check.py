# Checks that every photo added on this branch (compared with main) loads from Wikimedia, in the same way the page asks for it.
# Prints one line per failure and exits 1 if any photo does not load.
import re, subprocess, sys, time, urllib.request
TH = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/'
UA = 'photo-check/1.0 (slideshow photo check)'

def paths(text):
    return re.findall(r'"p":"([^"]+)"', text)

main = subprocess.run(['git', 'show', 'origin/main:data/places.js'], capture_output=True, text=True).stdout
cur = open('data/places.js', encoding='utf-8').read()
old = set(paths(main))
new = [p for p in paths(cur) if p not in old]
bad = 0
for p in new:
    u = p if p.startswith('http') else TH + p
    ok, err = False, ''
    for a in range(3):
        try:
            r = urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': UA}), timeout=40)
            if r.status == 200 and r.headers.get('Content-Type', '').startswith('image/') and len(r.read()) > 20000:
                ok = True
            break
        except Exception as e:
            err = str(e)
            time.sleep(3 * (a + 1))
    if not ok:
        bad += 1
        print('FAIL', u, err)
    time.sleep(0.4)
print('checked', len(new), 'failed', bad)
sys.exit(1 if bad else 0)
