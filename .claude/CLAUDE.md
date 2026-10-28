# Cairo Quran

**New session? Read `.claude/HANDOVER.md` first** (full state, plans and pending decisions, in Arabic).

Ahmed Khalil's project, live in production: the site cairoquran.com (GitHub Pages from `main`) and an Android TV app.
Social: Facebook page "Cairo Quran" (creator page, ~94K followers), Instagram @cairoquran.radio, YouTube @CairoQuran.

## Rules
- **Language:** reply to Ahmed in professional Modern Standard Arabic (headings, bullets, observations separate from
  recommendations, each recommendation says why and how). No colloquial Arabic, no needless English.
- **Live product:** a wrong change is a disaster. Never touch without explicit approval: `index.html`, `quran.apk`,
  `version.json`, `sw.js`, `manifest.json`, `og.jpg`, `CNAME`, icons, `prayer-chime.mp3`.
  `index.html` and the TV app belong to the main (site and app) session.
- **No push to `main` without Ahmed's approval;** work on a branch and open a PR.
- **Content:** no links in captions (Instagram: «الرابط في البايو»; Facebook: first comment, studio posts only),
  no engagement bait, no «مجانًا لوجه الله», no placeholders. Ahmed rejects rights caveats on recitations.
  Closing cards: «تلاوات كبار القرّاء» / «إذاعات القرآن الكريم من مصر والسعودية» / «مواقيت الصلاة لمدينتك · الأذكار» / cairoquran.com.
- **Audience is global** (all Muslims, and non-Muslims too), not Egypt only: backgrounds come from across the Islamic
  world and nature (`background: "commons:<search>"` in `reels.json`), not only Egyptian landmarks.
- **No extra text on videos:** no hook line, series label or explanation above or below the verse. The viewer sees the
  reciter and the verse at once. Series, reflections and questions go in the caption only.
- **Times:** Kuwait time (UTC+3) for every schedule.

## Coordination
- Sessions coordinate on issue #4 (the content channel). Read its latest comments before acting; post results there.
- The main session owns the site, the TV app and the Meta/YouTube accounts. The content session owns `studio/`,
  `.github/content`, `.github/reels` and `.github/social`.

## Studio
`studio/` (cairoquran.com/studio): one platform with images (`#images`), recitation video (`#recite`) and an editor for
your own video (`#edit`). Shared helpers in `studio/common.js`.

## Content pipeline (branch `claude/relaxed-volta-yog6yf`)
- A week lives in `.github/content/<YYYY-MM-DD>/`: `reels.json` (recitation reels), `live.json` (site-screen reels with a
  live station), optional `posts.json` and `assets/`. Arabic guide: `.github/content/README.md`.
- `.github/content/current` lists the weeks to render (one per line). A push renders them on GitHub Actions
  (`content.yml`) and publishes each as release `content-<week>` with MP4s, covers and `schedule.json`.
- QDC recitation ids: 2 AbdulBaset murattal, 1 AbdulBaset mujawwad, 6 Husary, 9 Minshawi murattal, 7 Alafasy.

## Social publisher (`main`)
- `social.yml` posts due items of every `content-<week>` release from `config.from` on (minus `config.exclude`) via the
  Facebook and Instagram APIs. It runs in posting windows (daily 18:23, Fri 05:23, Thu 14:23, Sat 08:23 Kuwait) that
  stay up 3.5 hours and post each item at its minute, plus a 10-minute safety net. Posted items: `published.json` on
  release `social-log`. `insights.yml` collects daily numbers into release `insights`.
- Credentials are repository secrets (`META_TOKEN`, `FB_PAGE_ID`, `IG_USER_ID`, `YT_API_KEY`). Never write them anywhere
  else. `META_TOKEN` may be a user token; the Page token is derived from it. Run `social` by hand with mode `check` to
  see token type, missing permissions and the next 24 hours.
- A week scheduled by hand in Business Suite must be added to `config.exclude`, or it posts twice.
