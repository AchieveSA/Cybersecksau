# معرض الابتكار المفتوح · AI & Startup Open Expo — Station 1 games

**زاوية الأمن السيبراني والألعاب المصغّرة**: three quick security mini-games on the player's own phone, one shared
leaderboard on the hall TV, and an admin screen for the club members at the table. Cybersecurity Club × Baseerah Club,
KSAU-HS Jeddah. Arabic RTL, in the club's poster look (Cairo 900 / IBM Plex Sans Arabic / Inter, violet ground, glass tiles,
the cyan–magenta glitch on beats only).

Live: https://ksaucsclubavtivity.netlify.app (auto-deploys from `master`).

## Flow

| Route | Who | What |
| --- | --- | --- |
| `/` | player | Landing, «سجّل والعب», the three game tiles (greyed until registered) |
| `/join?s=f1` · `/f1` | player | Registration: name, phone (05xxxxxxxx), optional college/year, consent. Same phone = same player |
| `/play` | player | The three games, best score per game, «ترتيبك الآن #12 من 40» |
| `/play/phish` · `/play/puzzles` · `/play/quiz` | player | صيد الاحتيال · ألغاز أمنية · اختبار أمان |
| `/result/<run>` | player | Score, rank, share card (PNG), replay / next game |
| `/board?s=f1` | TV | Top 10 (refreshes every 3 s), station QR, glitch reveal of the winners |
| `/admin` | club | PIN-gated: open/freeze/close sessions, «إعلان الفائزين», CSV, players, purge phones, reset |
| `/survey` | everyone | The 3-question exit survey |
| `/qr?s=f1` | club | Printable A5 QR card (`?t=survey` for the survey QR) |

Sessions `f1` (الطالبات · 10:00–11:30) and `m1` (الطلاب · 12:00–3:00) exist by default in `draft`; more can be created in `/admin`.

## Rules the server enforces (`server/core.mjs`)

- The server owns the clock, serves one question at a time, checks answers and computes every score. Answers never reach the
  browser before they are submitted (`server/content.mjs` is outside the published folder).
- Scoring for all three games: (base + speed bonus `max(0, 10 − s) × 10`) × streak (×1.5 at 3, ×2 at 5), a wrong answer
  costs the streak, not points; normalised so a flawless instant run is exactly 1,000. Puzzles: up to 300 each + 100 for
  finishing all three in under 4 minutes.
- Best run per game counts; total = sum of the three bests; ties → fewer seconds. Runs longer than the game maximum
  (phish 180 s, quiz 120 s, puzzles 330 s; these allow for the reading pauses between items) are kept but don't count.
- After «إعلان الفائزين» the session is frozen: runs still save but no longer count.
- The board shows «سارة م.» only; phones appear only in `/admin` and the CSV.

## Running it

**Netlify (production).** The site uses Netlify Functions (`netlify/functions/api.mjs`) and Netlify Blobs for storage, so
there is no database to host. One setting is required: in *Site configuration → Environment variables* add **`ADMIN_PIN`**
(use 6+ digits). Without it `/admin` stays locked.

**Locally.** `npm install`, then `ADMIN_PIN=2468 npm run dev` → http://localhost:8888 (data in `.data/dev.json`).
`npm test` runs the server rule tests.

## On the day

1. 09:00: open `/admin`, «تفعيل الفترة» for `f1`, play one full run on an iPhone, an Android and an in-app browser, then
   «إعادة ضبط» `f1` (type `f1` to confirm) and «تفعيل الفترة» again.
2. Put `/board?s=f1` full-screen on the TV. Print `print/qr-f1-female.png` and `print/qr-m1-male.png` (A5) and the survey QR.
3. 11:30: «إعلان الفائزين» for `f1` → check the names → «اعرض على الشاشة». Export CSV. Then open `m1` and switch the TV to
   `/board?s=m1`.
4. 15:00: same for `m1`.
5. A week later: «حذف أرقام الجوال» (names and scores stay for the report).

## Layout

```
public/            the site (Netlify publish dir): pages, css/app.css, js/, fonts/, assets/brand/
server/            core.mjs (API + rules), content.mjs (cards, questions, puzzles), stores.mjs
netlify/functions/ api.mjs: the /api/* function
scripts/           dev-server.mjs: local stand-in for Netlify
tests/             core.test.mjs
print/             A5 QR posters (f1, m1, survey) for the printer
```

Open items from the brief: the event **date** and **venue** are not shown anywhere until confirmed.
