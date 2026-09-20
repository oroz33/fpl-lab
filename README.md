# FPL Lab

Local Fantasy Premier League analysis dashboard with **Precision Analytics** — a high-density sports-terminal UI inspired by Opta / StatsPerform, powered by a weekly cumulative → delta Opta ingestion pipeline.

**Current version:** `v1.7.0`

## Quick start

### One-click start (Windows)

Double-click **`start-dev.bat`** — opens [http://localhost:3000](http://localhost:3000) and runs `npm run dev`. Leave the console open; press **Ctrl+C** to stop.

### Manual start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Full documentation (Hebrew): **[Plan/PROJECT.md](./Plan/PROJECT.md)**
## Weekly upload

**Upload Opta Feed** in the UI:

1. Set **Cumulative through gameweek**
2. Multi-select SeasonStats and/or ExpectedGoals JSON (or paste one team)
3. **Ingest** — pairs by team id and refreshes without restart
4. **Clear all data** — wipe snapshots and re-upload from scratch

Delta: `GW_n = Cumulative_n − Cumulative_(n−1)`. First upload through GW3 = inseparable GW1–3 baseline.

## Highlights

- Universal App Shell (header + sidebar) · Player Data · H2H Compare (`/h2h`) · Opta Batch Links · Squad Planner / Regression Lab (Coming Soon)
- Players: Attack / Set Pieces / Defending · Teams: Defensive / Offensive (+ ΔG / ΔGC / ΔCS)
- Metric header tooltips · Popover column filters (threshold / Top 10% / Top 25%) · percentile heatmaps (**Top 2.5%** emerald / Bottom 5% rose) · FDR Next 3|5 + Avg FDR · **Fixture Tracker** (`/fixtures`) · team accent bars
- Dual-player H2H: SVG percentile radar, winner matrix, archetype panel
- Bento forensic insight cards · Batch multi-file ingest · Clear all data

## Stack

Next.js 15 · Tailwind CSS v4 · Radix UI · Inter + JetBrains Mono · local JSON store (`data/store.json`)

## Design system

**FPL Lab Precision Analytics** — analytical minimalist / sports terminal: 1px crisp borders, Inter for chrome, JetBrains Mono + `tnum` for metrics, soft desaturated percentile tints (no rainbow spreadsheets).
