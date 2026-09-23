# FPL Lab — תיעוד פרויקט מלא

דשבורד מקומי לניתוח Fantasy Premier League בסגנון Opta / Fantasy Football Scout: טבלאות צפופות, פילטרים גלובליים + לפי עמודה, דלתות קבוצה, העלאה מרובת קבצים, ומחיקת נתונים מלאה.

**גרסה נוכחית:** `v1.8.1` (מסונכרן עם `package.json` ועם Git Tags מקומיים)  
**עודכן לאחרונה:** My Team zero-GW squad fallback · Δ xGI Variance · Sticky Player/Team/Next/Avg FDR · Next 3|5 layout · Column filter precision · Favorite Players · Metric header tooltips · Fixture Tracker

---

## תוכן עניינים

1. [סקירה](#1-סקירה)
2. [הרצה מהירה](#2-הרצה-מהירה)
3. [סטאק טכני](#3-סטאק-טכני)
4. [מבנה תיקיות](#4-מבנה-תיקיות)
5. [ארכיטקטורת נתונים](#5-ארכיטקטורת-נתונים)
6. [מנוע הדלתא](#6-מנוע-הדלתא)
7. [מיפוי שדות Opta](#7-מיפוי-שדות-opta)
8. [ממשק משתמש](#8-ממשק-משתמש)
9. [פילטרי עמודות בטבלה](#9-פילטרי-עמודות-בטבלה)
10. [העלאת נתונים (יחיד + Batch)](#10-העלאת-נתונים-יחיד--batch)
11. [מחיקת כל הנתונים — Clear data](#11-מחיקת-כל-הנתונים--clear-data)
12. [API](#12-api)
13. [נוסחאות מיוחדות](#13-נוסחאות-מיוחדות)
14. [POC — Manchester City](#14-poc--manchester-city)
15. [פתרון בעיות נפוצות](#15-פתרון-בעיות-נפוצות)
16. [מגבלות ידועות](#16-מגבלות-ידועות)
17. [זרימת עבודה מומלצת](#17-זרימת-עבודה-מומלצת)
18. [יומן שינויים](#18-יומן-שינויים)
19. [גרסאות — Semantic Versioning](#19-גרסאות--semantic-versioning)

---

## 1. סקירה

| נושא | פירוט |
|------|--------|
| מטרה | ניתוח שחקנים וקבוצות PL עם סטטיסטיקות מצטברות / לדלתא לפי Gameweek |
| מקור נתונים | קבצי Opta JSON: `SeasonStats` + `ExpectedGoals` |
| אחסון | קובץ מקומי `data/store.json` (ללא SQLite) |
| Baseline | ההעלאה הראשונה = מצטבר עד GW3 (בלוק GW1–GW3 בלתי ניתן לפיצול) |
| ריבוי קבוצות | Snapshot לכל `teamId` + `throughGameweek` — ניתן להעלות את כל הליגה בבת אחת |
| POC | Manchester City ב־`data/samples/` + העלאות ב־UI |

### יכולות עיקריות

- תצוגות **Players** (Attack / Set Pieces / Defending) ו־**Teams** (Defensive / Offensive)
- **Δ xGI Variance** — עמודה ב־Attack: Actual Returns (G+A) − xGI; סף ±0.75 ל־UNDER/OVER/ALIGNED; צבע הפוך (ירוק=פוטנציאל, אדום=סיכון רגרסיה) + tooltip
- **Fixture Tracker** (`/fixtures`) — מטריצת FDR לפי GW עד סוף העונה, presets Next 5/10/Full Season, Offensive|Defensive
- **H2H Compare** (`/h2h`) — השוואת שני שחקני שדה (ללא GKP), רדאר אחוזונים (פוליגון) עם תוויות ערכים גולמיים, מטריצת מנצחים
- פילטרים גלובליים: Gameweek, Position, Team, Search, **Favorites**
- **Favorite Players** — כוכב ליד שם שחקן + chip "Favorites" (סינון in-memory בלבד, נמחק ב־refresh)
- פילטר **מעל כל עמודה**: מספרים ≥ ערך; טקסט = contains; מספר עמודות = AND
- **Percentile heatmap** בטבלה: Top **2.5%** (ירוק) / Bottom **5%** (אדום, רק כשיש שונות משמעותית)
- מיון בלחיצה על כותרות · כפתור Compare משורת שחקן → `/h2h?a={id}`
- דלתות קבוצה צבעוניות: ΔG, ΔGC, ΔCS
- **Batch upload** — בחירת הרבה קבצי JSON ביחד (לפי קבוצה)
- **Clear all data** — מחיקת כל ה־snapshots והתחלה מחדש
- Paste יחיד לקבוצה אחת · Load Man City GW1–3 מדוגמה

---

## 2. הרצה מהירה

```bash
cd C:\Work\CURSOR\FPL
npm install
npm run dev
```

פתחו: [http://localhost:3000](http://localhost:3000)

בטעינה **ראשונה בלבד** (כש־`seeded: false`) נטענים אוטומטית קבצי הדוגמה של Man City מ־`data/samples/` כ־**through GW3**.  
אחרי **Clear all data** ה־store נשאר ריק (לא נזרע מחדש אוטומטית).

| פקודה | תפקיד |
|--------|--------|
| `npm run dev` | שרת פיתוח (Turbopack) |
| `npm run build` | בניית production |
| `npm start` | הרצת build |
| `npm run lint` | ESLint |

---

## 3. סטאק טכני

| שכבה | טכנולוגיה |
|------|-----------|
| Framework | Next.js 15 (App Router) + React 19 + TypeScript |
| עיצוב | Tailwind CSS v4 + **FPL Lab Precision Analytics** design tokens |
| Typography | Inter (UI) · JetBrains Mono + `tnum` (מספרים / ctst) |
| UI | Radix (Tabs, Dialog, Popover, Tooltip) + Lucide |
| אחסון | JSON file store — `data/store.json` |
| אין | DB חיצוני, auth, FPL API חי |

---

## 4. מבנה תיקיות

```
FPL/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                    # Player Data (Dashboard)
│   ├── fixtures/page.tsx           # Fixture Tracker
│   ├── h2h/page.tsx                # H2H Player Comparison
│   ├── my-team/page.tsx            # My Team (squad + stats / intel tabs)
│   ├── opta-batch/page.tsx
│   ├── globals.css                 # צבעים + הסתרת spinners בפילטרים
│   └── api/
│       ├── stats/route.ts          # GET — שחקנים/קבוצות מסוננים (+ nextFixtures)
│       ├── fixtures/route.ts       # GET — מטריצת Fixture Tracker (team × GW)
│       ├── meta/route.ts           # GET — GW מקסימלי, קבוצות, snapshots
│       ├── ingest/route.ts         # POST — העלאת snapshot (קבוצה אחת)
│       ├── seed/route.ts           # POST — טעינת Man City GW1–3 מדוגמאות
│       ├── clear/route.ts          # POST — מחיקת כל ה־snapshots
│       └── teams-config/route.ts   # GET — קריאת teams_config.json (אם קיים)
├── components/
│   ├── Dashboard.tsx
│   ├── filters/                    # GW, Position, Team, Search (+ Favorites chip ב־Dashboard)
│   ├── upload/UploadPortal.tsx     # העלאה יחידה + batch + clear
│   ├── players/PlayerTables.tsx    # + Star favorites · Compare → /h2h?a= · Δ xGI · sticky Team
│   ├── teams/TeamTables.tsx        # ΔG / ΔGC / ΔCS · team accents
│   ├── my-team/                    # MyTeamView, LastFixturesStats, NewsGrid, SquadDialog, MiniBar
│   ├── analytics/                  # XGIVarianceBadge (signed Δ xGI + tooltip)
│   ├── fixtures/FixtureTrackerView.tsx
│   ├── h2h/                        # H2HCompareView, radar, matrix, slots…
│   ├── layout/                     # AppShell, AppHeader, AppSidebar, AppNavLinks
│   └── ui/
│       ├── data-table.tsx          # cumulative sticky · Next 3|5 · filters · heatmap · tooltips
│       ├── fixture-badges.tsx      # FDR chips + Avg FDR + horizon sync
│       ├── team-accent.tsx         # פס צבע מותג ליד שם קבוצה
│       ├── tooltip.tsx             # Radix Tooltip (metric headers + FDR chips)
│       └── button, dialog, tabs, …
├── lib/
│   ├── types.ts                    # + Squad / PlayerIntel types
│   ├── utils.ts
│   ├── heatmap.ts                  # percentile + heatmap class helpers (shared)
│   ├── squad/                      # rules, use-my-team (localStorage), player-intel
│   ├── h2h/                        # metrics.ts, radar.ts
│   ├── constants/
│   │   ├── teams.ts                # TEAM_ACCENTS · TEAM_ID_TO_CODE · resolveTeamAccent
│   │   └── metrics.ts              # METRIC_DESCRIPTIONS · metricDescription()
│   ├── parsers/                    # seasonStats, expectedGoals
│   ├── mapping/                    # positions, playerStats (DC/G, xCS)
│   ├── delta/engine.ts             # דלתאות שבועיות + אגרגציה
│   ├── fdr/
│   │   ├── engine.ts               # Off/Def FDR + rateFixture + nextFixtures
│   │   └── matrix.ts               # GW pack + Fixture Tracker matrix
│   ├── ingest/batch.ts             # זיהוי סוג JSON + pairing לפי teamId
│   └── store/db.ts                 # read/write/clear/seed
├── data/
│   ├── store.json                  # DB מקומי
│   ├── player-news.json            # Mock Expected XI / fitness / press quotes (My Team Tab 2)
│   ├── tournament-schedule.json
│   └── samples/
│       ├── SeasonStats - Man City.json
│       └── ExpectedGoals - Man City.json
├── README.md
└── Plan/PROJECT.md                 # קובץ זה
```

---

## 5. ארכיטקטורת נתונים

```
Upload Portal (single / batch / clear)
        │
        ├─► POST /api/ingest   (לכל קבוצה)
        ├─► POST /api/seed
        └─► POST /api/clear
                │
                ▼
        data/store.json  (CumulativeSnapshots)
                │
                ▼
          Delta Engine
                │
                ▼
     GET /api/stats + Global Filters
                │
                ▼
   DataTable (column filters ≥ + sort)
```

### מבנה Snapshot

| שדה | משמעות |
|-----|--------|
| `throughGameweek` | מצטבר עד GW זה |
| `teamId` / `teamName` / `shortName` | מזהה Opta |
| `seasonStatsRaw` / `expectedGoalsRaw` | JSON גולמי |
| `teamStats` | סטטים קנוניים ברמת קבוצה |
| `players[]` | שחקנים עם סטטים קנוניים |
| `uploadedAt` | חותמת זמן |

### מבנה Store

```json
{
  "snapshots": [ /* CumulativeSnapshot[] */ ],
  "seeded": true
}
```

| `seeded` | משמעות |
|----------|--------|
| `false` | טעינה ראשונה — ייזרע Man City אוטומטית |
| `true` | כבר אותחל; גם אם `snapshots` ריק (אחרי Clear) — **לא** ייזרע מחדש |

שחקנים ממוזגים לפי Opta `id`. אם יש `currentTeamOnly` עם Appearances > 0 — משתמשים בו.

### מזהה שורת שחקן ב־UI

```
PlayerRow.id = "{teamId}:{optaPlayerId}"
```

מונע אזהרת React על `key` כפול כשאותו שחקן מופיע בשתי קבוצות.

---

## 6. מנוע הדלתא

### כלל בסיסי

```
GW_n_Stats = Cumulative_GW_n − Cumulative_GW_(n−1)
```

### Baseline (GW1–GW3)

- ההעלאה הראשונה (through GW3) = **בלוק אחד** `[1 … 3]`.
- אין פיצול אמיתי ל־GW1/2/3 בנפרד.
- כל טווח שחופף ל־1…3 כולל את הבלוק פעם אחת.

### GW4 ומעלה

`cum(N) − cum(N−1)` = דלתא לשבוע(ות) שביניהם.

### אגרגציית טווח

סיכום בלוקים ב־`[from, to]`. מדדים יחסיים (DC/G) מחושבים מחדש מהסכומים.

מימוש: [`lib/delta/engine.ts`](lib/delta/engine.ts)

---

## 7. מיפוי שדות Opta

מיזוג SeasonStats + ExpectedGoals לפי `player.id`.  
עדיפות ל־EG בשדות בעיטות / xG.

### Attack

| עמודה | מקור |
|-------|------|
| Apps | Appearances / Games Played |
| Mins | Time Played / minsPlayed |
| Shots | totalScoringAtt |
| SoT | ontargetScoringAtt |
| SIB | סכום attIbox* |
| BC | bigChanceScored + bigChanceMissed |
| xG / xA | expectedGoals / expectedAssists |
| G / A | goals / goalAssist |
| xGI | xG + xA |
| npxGI | expectedGoalsNonpenalty + xA |
| GI | Goals + Assists |
| Δ xGI | actualReturns (G+A) − xGI; ≤−0.75 UNDERPERFORMING · ≥+0.75 OVERPERFORMING · else ALIGNED |
| KP | totalAttAssist |
| BCC | bigChanceCreated |

### Set Pieces

Corners · FK Taken · FK Goals · Pens (0 אם חסר ב־JSON)

### Defending

Clr / Blk / Int / Tck / Rec · DC/G · CS · Saves (GKP בלבד)

### קבוצות

xG, G, xGC, GC, CS, xCS (Poisson), ΔG, ΔGC, ΔCS

עמדות: Goalkeeper→GKP · Defender→DEF · Midfielder→MID · Forward→FWD

---

## 8. ממשק משתמש

**Design system:** FPL Lab Precision Analytics — Analytical Minimalist / Sports Terminal (גבולות 1px, צפיפות גבוהה, heatmap רך).

**Universal App Shell:** Header קבוע (`FplLabLogo`, Engine badge, snapshots, Batch Links, Upload) + Sidebar (`Player Data`, **H2H Compare**, **Fixture Tracker** `/fixtures`, **My Team** `/my-team`, Squad Planner = Coming Soon, **Regression Lab** = Coming Soon) + Feed Latency.

### פילטרים גלובליים

| פילטר | התנהגות |
|--------|----------|
| Gameweek From/To | אגרגציה לפי מנוע הדלתא |
| POS | All / GKP / DEF / MID / FWD (+ counters) |
| Team | כל הקבוצות שב־store |
| Favorites | Chip "Favorites" (Players בלבד) — מציג רק שחקנים שסומנו בכוכב; מצב in-memory ב־`Dashboard` (לא localStorage / store); נשמר בין טאבי Attack / Set Pieces / Defending |
| Search | שם שחקן או קבוצה (⌘K) |

### תצוגות

**Players:** Attack · Set Pieces · Defending (+ Goalkeeping / Creativity / Bonus — UI placeholders)  
**Teams:** Defensive (xGC, GC, ΔGC, xCS, CS, ΔCS) · Offensive (xG, G, ΔG)  
**Fixture Tracker (`/fixtures`):** מטריצת team × GW מ־`startGw = latestCompleteGw + 1` עד GW38 · presets Next 5 / Next 10 / Full Season · Offensive|Defensive · sticky Team + N-AVG (מיון) · DGW stacked chips / BGW dashed · מיון Team A–Z ו־N-AVG  
**My Team (`/my-team`):** סגל מקומי עד 15 שחקנים ב־`localStorage` (`fpl_lab_my_team`, מפתחות `teamId:playerId`) · מגבלות 2 GKP / 5 DEF / 5 MID / 3 FWD + מקס 3 לקבוצה · Mini-bar לפי עמדה · **Tab 1 — Last Fixtures Stats** (sticky POS/PLAYER/TEAM/NEXT/FDR, מדדים, heatmap מול כל הליגה, placeholder לשורות חסרות) · **Tab 2 — News & Team Intel** (`MyTeamNewsGrid`: Expected XI / Fitness / Press Quote מ־`data/player-news.json`) · `SquadDialog` לעריכה  
**H2H Compare (`/h2h`):** בחירת שני שחקני שדה (ללא GKP) · Per 90 / Total · רדאר אחוזונים דינמי לפי זיווג עמדות (SVG, 6 צירים) · Archetype panel · מטריצת מנצחים (Opta בלבד — ללא ownership/price/FPL points)

**Percentile Radar — כללים:**
| שכבה | התנהגות |
|------|----------|
| פוליגון / נקודות | סקאלת אחוזונים 0–100 מול peers בעמדות הזיווג (`mins ≥ 180`) |
| תוויות צירים | ערכים סטטיסטיים גולמיים מפורמטים: `[Label] ([A] vs [B])` — למשל `xGI (0.32 vs 0.83)`, לא אחוזונים |
| סטים | **Defensive** (אין FWD): DC/G · Mins/App · xGI · BCC+KP · Set Pieces · CS · **Attacking** (יש FWD): G+A · Mins/App · xGI · BCC+KP · Set Pieces · Shots |
| TOTAL / PER 90 | משפיע על תוויות + אחוזונים של xGI / BCC+KP / Set Pieces / CS / G+A / Shots; **DC/G** ו־**Mins/App** תמיד rates |
| דיוק תצוגה | מספרים שלמים (`CS`, Set Pieces, Shots, G+A, BCC+KP); 1–2 ספרות אחרי הנקודה (`Mins/App`, `xGI`, `DC/G`) |  
**Insights:** Bento cards — xG underperformers · Top KP · FDR green run

### עיצוב טבלה

| כלל | פירוט |
|-----|--------|
| כותרת | `bg-primary`, uppercase, מיון asc/desc; hover על קיצורי מטריקות → tooltip כהה (`METRIC_DESCRIPTIONS`) |
| Sticky | **Player → Team → Next → Avg FDR** (cumulative `left`, צל על העמודה האחרונה); עמודות שגוללות מתחת ל־sticky מוסתרות כדי למנוע אייקון פילטר יתום; כוכב Favorite · Compare ב־hover → `/h2h?a={id}` |
| מספריים | יישור ממורכז, JetBrains Mono + `tnum`; Δ xGI עם סימן מפורש (`+`/`−`) וצבע הפוך (emerald under / rose over) |
| Heatmap | דינמי לפי שורות מסוננות; **Top 2.5%** (`≥ P97.5`) = emerald; **Bottom 5%** (`≤ P5`) = rose רק כש־`p5 > 0` ויש שונות; Apps/Mins/Δ xGI ללא heatmap |
| FDR | Next chips use Overall FDR (`fdrOverall`); header toggle Next 3\|5 (רוחב sticky 168/320) + Avg FDR; ב־Players האופק נשמר ב־`Dashboard` בין טאבים (session); palette `#15803D` / `#16A34A` / `#64748B` / `#DC2626` / `#991B1B` (1–5, easy→hard) |
| Team accents | פס אנכי `TEAM_ACCENTS` ליד `teamShort` / שם קבוצה (Players + Teams) דרך `TeamAccentLabel` |
| Metric tooltips | Radix Tooltip על כותרות מקוצרות ב־Player Data (Players + Teams, כל תתי־הטאבים); delay ~180ms; לא משפיע על sort/filter |
| פילטר | אייקון tune → Radix Popover (slider + Top 10%/25%) |

---

## 9. פילטרי עמודות בטבלה

אין שורת קלטים קבועה. לכל עמודה מספרית: אייקון filter ב־header → Popover עם סף, presets, Reset / Apply. פילטרים פעילים מוצגים כ־pills מעל הטבלה.

| סוג | כלל |
|-----|-----|
| מספרי | ערך ≥ הסף; ריק = בלי פילטר; `null` לא עובר |
| Top 10% / 25% | סף לפי אחוזון בעמודת הנתונים הנוכחית |
| מספר עמודות | **AND** |

דוגמה: G=`1` ו־A=`1` → לפחות גול אחד וגם אסיסט אחד.

מעבר בין טאבים מאפס את פילטרי העמודות.

---

## 10. העלאת נתונים (יחיד + Batch)

חלון **Upload data** ([`components/upload/UploadPortal.tsx`](components/upload/UploadPortal.tsx)):

### העלאה יחידה

1. Through gameweek  
2. Paste SeasonStats ו/או ExpectedGoals  
3. **Ingest & refresh**

### Batch — כמה קבצים ביחד

1. Through gameweek (למשל `3`)  
2. ב־SeasonStats: multi-select כל קבצי `seasonstats - *.json`  
3. (אופציונלי) ב־ExpectedGoals: multi-select כל קבצי ה־xG  
4. מוצג: `Ready to ingest N teams`  
5. **Ingest N teams**

לוגיקה ([`lib/ingest/batch.ts`](lib/ingest/batch.ts)):

1. זיהוי סוג קובץ לפי `contestant.stat[0].name` (SeasonStats) מול `.type` (ExpectedGoals)  
2. קיבוץ לפי `contestant.id`  
3. לכל קבוצה — `POST /api/ingest`  
4. סיכום: `Ingested 18/20 teams…` + רשימת כשלונות  
5. רענון דשבורד בסוף; בסגירה אוטומטית רק אם הכל הצליח

קבצים בלי בן־זוג (רק Season או רק EG) עדיין נקלטים.

### Load Man City GW1–3

`POST /api/seed` — טוען מחדש את הדוגמה מ־`data/samples/`.

---

## 11. מחיקת כל הנתונים — Clear data

כפתור אדום **Clear all data** בחלון Upload:

1. אישור `confirm` בדפדפן  
2. `POST /api/clear` → `data/store.json` = `{ snapshots: [], seeded: true }`  
3. איפוס שדות/קבצים בטופס  
4. רענון הדשבורד (טבלאות ריקות)  
5. **לא** נזרע Man City אוטומטית — אפשר Batch upload מחדש או Load Man City

מימוש: [`app/api/clear/route.ts`](app/api/clear/route.ts) + `clearStore()` ב־[`lib/store/db.ts`](lib/store/db.ts)

`ensureSeeded()`: אם `seeded === true` מחזיר את ה־store כמו שהוא (גם כשריק).

---

## 12. API

| Method | נתיב | תפקיד |
|--------|------|--------|
| `GET` | `/api/meta` | maxGameweek, teams, snapshotCount, seeded |
| `GET` | `/api/stats?from=&to=&position=&teams=&q=` | שחקנים + קבוצות (פילטרים גלובליים) + `nextFixtures` (עד 5) |
| `GET` | `/api/fixtures` | מטריצת Fixture Tracker: `latestUploadedGw`, `startGw`, `endGw`, `teams[].byGw` |
| `POST` | `/api/ingest` | גוף: `{ throughGameweek, seasonStats?, expectedGoals? }` |
| `POST` | `/api/seed` | טעינת Man City GW1–3 מדוגמאות |
| `POST` | `/api/clear` | מחיקת כל ה־snapshots |
| `GET` | `/api/teams-config` | קריאת `teams_config.json` אם קיים (אופציונלי) |

פילטרי עמודות רצים בצד הלקוח אחרי `/api/stats`.

---

## 13. נוסחאות מיוחדות

### DC/G

| עמדה | נוסחה |
|------|--------|
| DEF | `(Clr + Blk + Int + Tck) / Apps` |
| MID / FWD | `(Clr + Blk + Int + Tck + Rec) / Apps` |
| GKP | `—` |

Saves רק ל־GKP.

### xCS

```
xCS ≈ gamesPlayed × exp(−(xGC / gamesPlayed))
```

### דלתות קבוצה (overperformance)

| עמודה | נוסחה | דוגמה City GW1–3 |
|-------|--------|------------------|
| ΔG | G − xG | 7 − 6.59 ≈ +0.41 |
| ΔGC | xGC − GC | 2.68 − 2 ≈ +0.68 |
| ΔCS | CS − xCS | 1 − 1.23 ≈ −0.23 |

חיובי = ירוק (טוב לקבוצה) · שלילי = אדום.

---

## 14. POC — Manchester City

`data/samples/`:

- `SeasonStats - Man City.json`
- `ExpectedGoals - Man City.json`

| מדד | ערך מצופה |
|-----|-----------|
| Goals | 7 |
| xG | ~6.59 |
| GC | 2 |
| xGC | ~2.68 |
| CS | 1 |
| Games | 3 |

| שחקן | בדיקה |
|------|--------|
| Guéhi DEF | DC/G בלי Recoveries |
| Haaland FWD | DC/G עם Recoveries |
| Donnarumma GKP | Saves כן, DC/G = — |

---

## 15. פתרון בעיות נפוצות

| תופעה | פתרון |
|--------|--------|
| Duplicate key ב־React | תוקן: `id = teamId:playerId` |
| עמודות רחבות / גלילה | תוקן: רוחב צר + פילטרים קטנים |
| אחרי Clear חוזר Man City | לא אמור — `seeded: true` מונע seed; אם כן — בדקו את `store.json` |
| רוצים להתחיל מחדש | Upload → **Clear all data** → Batch upload |
| קובץ parse נכשל ב־batch | מופיע בסיכום Failed; שאר הקבוצות נקלטו |

---

## 16. מגבלות ידועות

- אין פיצול אמיתי של GW1/2/3 מה־baseline המצטבר  
- אין FPL API רשמי / auth  
- xCS = אומדן Poisson  
- שדות Set Pieces חסרים ב־JSON → 0  
- `store.json` משתנה בזמן ריצה — גיבוי ידני לפי הצורך  
- פילטרי עמודות = client-side בלבד  

---

## 17. זרימת עבודה מומלצת

1. (אופציונלי) **Clear all data** לעונה נקייה  
2. **GW3** — Batch: כל SeasonStats (+ ExpectedGoals) עם through = 3  
3. כל GW הבא — Batch מצטבר עם through = N  
4. סינון GW / עמדה / קבוצה  
5. פילטרי עמודות (למשל G≥1 ו־A≥1)  
6. ניתוח Attack / Defending / Teams + דלתות  

---

## 18. יומן שינויים

Baseline נוכחי: **v1.8.1**. שינויים עתידיים יתויגו לפי כללי SemVer בסעיף 19.

| גרסה | נושא | מה נוסף / השתנה |
|------|------|------------------|
| v1.8.1 | My Team zero-GW fallback | סגל 15 נשאר גלוי תחת כל פילטר GW; roster מלא + `buildEmptyPlayerRow` כשאין דלתא/דקות; טבלת Last Fixtures מציגה `—` ל־apps/mins=0 (למשל João Pedro ב־GW5) |
| v1.8.0 | My Team page | Route `/my-team` + sidebar (`Users`); סגל ב־`localStorage` (`fpl_lab_my_team`); מגבלות עמדה/קבוצה; Mini-bar + SquadDialog; Tab 1 Last Fixtures Stats (sticky + heatmap ליגה מלאה + empty slots) |
| v1.8.0 | News & Team Intel | Tab 2 על `/my-team`: `MyTeamNewsGrid` · Expected XI / Fitness / Press Quote · mock `data/player-news.json` + `resolvePlayerIntel` · badges emerald / caution / rose |
| v1.8.0 | Shared heatmap helpers | חילוץ `percentileAt` / heatmap classes ל־`lib/heatmap.ts`; DataTable מייבא משם |
| v1.7.0 | Δ xGI Variance | עמודה `Δ xGI` ב־Attack: `actualReturns − xGI`, סף ±0.75 (`UNDERPERFORMING` / `OVERPERFORMING` / `ALIGNED`); טקסט חתום emerald/rose + tooltip; שדות ב־`PlayerRow` + חישוב ב־`lib/delta/engine.ts` |
| v1.7.0 | Sticky Player Data layout | סדר sticky מצטבר Player → Team → Next → Avg FDR; רוחבי Next 3\|5; הסתרת עמודות שגוללות מתחת לקצה ה־sticky (בלי פילטר Apps יתום) |
| v1.6.2 | Column filter precision | פילטר עמודות לפי `digits`: שלמים (`Apps`/`KP`/`Shots` וכו׳) ב־step 1 ותצוגה בלי עשרונים; עשרוניים (`xG`/`xA`/`xGI`/`npxGI`/`DC/G`) נשארים ב־2 ספרות |
| v1.6.1 | Next 3\|5 tab persistence | הרמת `nextHorizon` ל־`Dashboard`; controlled props ב־`DataTable` דרך PlayerTables — הבחירה נשמרת בין Attack / Set Pieces / Defending בתוך הסשן (מתאפסת ב־refresh) |
| v1.6.0 | Favorite Players | כוכב Lucide ליד שם שחקן (`teamId:playerId`); chip "Favorites" בפילטרים הגלובליים; סינון client-side לכל טאבי Players; מצב in-memory בלבד (מתאפס ב־refresh); ללא שינויי API/store |
| v1.5.1 | Metric header tooltips | `METRIC_DESCRIPTIONS` ב־`lib/constants/metrics.ts`; Radix Tooltip על קיצורי עמודות ב־Player Data (Players + Teams, כל תתי־הטאבים); עיצוב כהה מינימליסטי, delay 180ms, בלי לשבור sort/filter |
| v1.5.1 | Regression Lab (Coming Soon) | פריט Sidebar מתחת ל־Squad Planner (`TrendingUp`, disabled + pill) |
| v1.5.0 | Fixture Tracker | Route `/fixtures` + sidebar activation; `lib/fdr/matrix.ts` greedy GW pack; `GET /api/fixtures`; Next 5/10/Full Season presets; Offensive\|Defensive FDR; sticky Team + N-AVG sort; DGW/BGW cells |
| v1.5.0 | Next 3\|5 + Avg FDR | Sticky header segment toggle on Player Data / Teams; `/api/stats` returns 5 upcoming fixtures; `Avg FDR` column from `fdrOverall` mean |
| v1.5.0 | Team brand accents | `TEAM_ACCENTS` + `TEAM_ID_TO_CODE` + `resolveTeamAccent`; `TeamAccentLabel` on Players `teamShort` and Teams sticky name |
| v1.5.0 | FDR palette 1–5 | Shared `FDR_COLORS` recalibrated to `#15803D` / `#16A34A` / `#64748B` / `#DC2626` / `#991B1B`; dual Off/Def via `rateFixture` |
| v1.4.0 | Dynamic H2H Radar & Player Data | Position-based 6-axis percentile radar (DEF/MID defensive set vs MID/FWD attacking set; DEF vs FWD → attacking); polygon stays percentile-scaled while **axis labels show raw formatted stats** (`xGI (0.32 vs 0.83)`); TOTAL/PER 90 wired into radar getters; Clean Sheets (CS) on Players Defending tab; GKP excluded from H2H pickers; sidebar rename Player Matrix → **Player Data** |
| v1.3.1 | Heatmap Top 2.5% | Player Matrix green highlight narrowed from Top 5% (P95) to Top **2.5%** (P97.5); bottom 5% rose gate unchanged |
| v1.3.0 | H2H Player Comparison | Dedicated 2-player H2H comparison page, percentile radar spider chart, dynamic winner highlights, and archetype arbitrage analysis |
| v1.2.0 | Precision Analytics UI | Complete system-wide redesign, Universal App Shell + Sidebar, Popover column filters, Percentile Heatmaps, Bento insight cards, and Opta Batch Links redesign |
| v1.1.0 | FDR engine | `lib/fdr/engine.ts` + `data/tournament-schedule.json` — next-3 attack/defense ratings |
| v1.1.0 | Next 3 UI | עמודת Next 3 עם FDR badges + tooltips בטבלאות Players / Teams |
| v1.1.0 | Stats API | `nextFixtures` על `PlayerRow` / `TeamRow` ב־`/api/stats` |
| v1.0.0 | Core dashboard | דשבורד Players / Teams, פילטרים גלובליים, מנוע דלתא GW |
| v1.0.0 | Data store | `data/store.json`, ingest / seed / clear, baseline GW1–3 |
| v1.0.0 | Teams deltas | ΔG, ΔGC, ΔCS עם צבע (ירוק+/אדום−) |
| v1.0.0 | Column filters | שורת ≥ / חיפוש, AND בין עמודות |
| v1.0.0 | Alignment | מספריים ממורכזים |
| v1.0.0 | Compact layout | עמודות ושדות פילטר צרים |
| v1.0.0 | Row keys | `teamId:playerId` (מניעת duplicate key) |
| v1.0.0 | Multi-team store | Snapshot לכל קבוצה |
| v1.0.0 | Batch upload | multi-select JSON + pairing לפי `teamId` |
| v1.0.0 | Clear all data | מחיקת snapshots בלי re-seed אוטומטי |
| v1.0.0 | Site footer | אינדיקציית גרסה + © Or Oz. All rights reserved. |
| v1.0.0 | Versioning | SemVer מקומי דרך Git Tags + סנכרון `package.json` |

---

## 19. גרסאות — Semantic Versioning

הפרויקט משתמש ב־**Semantic Versioning** (`MAJOR.MINOR.PATCH`) עם תיוג מקומי ב־**Git Tags** (למשל `v1.0.0`). שדה `version` ב־`package.json` והפוטר באתר נשארים מסונכרנים עם הגרסה המתויגת.

| סוג | תבנית | מתי |
|-----|--------|-----|
| Major | `X.0.0` | שחרור גדול או שינוי ארכיטקטוני שובר |
| Minor | `X.Y.0` | פיצ'רים משמעותיים חדשים |
| Patch | `X.Y.Z` | תיקוני באגים, tweaks ושיפורים קטנים |

### תיוג מקומי (Git Tags)

```bash
# אחרי commit של המצב הנוכחי:
git tag -a v1.0.0 -m "Baseline release v1.0.0"
git tag -l "v*"
git show v1.0.0
```

גרסאות הבאות: עדכנו `package.json` → commit → `git tag -a vX.Y.Z -m "…"`.

---

*FPL Lab · v1.8.1 · Precision Analytics · Next.js 15 · `C:\Work\CURSOR\FPL`*
