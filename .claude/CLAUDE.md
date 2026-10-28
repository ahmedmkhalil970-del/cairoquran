# Cairo Quran

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
- `social.yml` runs every 10 minutes and posts due items from the releases listed in `.github/social/config.json`
  via the Facebook, Instagram and YouTube APIs. What was posted is in `published.json` on release `social-log`.
- Credentials are repository secrets (`META_TOKEN`, `FB_PAGE_ID`, `IG_USER_ID`, `YT_*`). Never write them anywhere else.
- To publish a new week: add its release tag to `config.json`. Run the workflow by hand with mode `check` to verify.
- Releases listed there must not also be scheduled by hand in Business Suite, or they post twice.
