"""Round 3: extract FotMob xG schema + Understat window objects."""
from __future__ import annotations

import json
import time
from pathlib import Path

import requests
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
LOG = ROOT / "debug-bf151f.log"
UA = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json",
}


def log(hypothesis_id: str, message: str, data: dict) -> None:
    payload = {
        "sessionId": "bf151f",
        "runId": "xg-round3",
        "hypothesisId": hypothesis_id,
        "location": "probe_xg_round3.py",
        "message": message,
        "data": data,
        "timestamp": int(time.time() * 1000),
    }
    with LOG.open("a", encoding="utf-8") as f:
        f.write(json.dumps(payload, ensure_ascii=False) + "\n")
    print(hypothesis_id, message, json.dumps(data, ensure_ascii=False)[:500])


def fotmob_xg_schema() -> None:
    for season in ("2025", "2026", "2025/2026", "2026/2027"):
        r = requests.get(
            f"https://www.fotmob.com/api/data/leagues?id=47&season={season}",
            headers=UA,
            timeout=30,
        )
        data = r.json()
        table = (data.get("table") or [{}])[0].get("data", {}).get("table", {})
        xg = table.get("xg") or []
        all_keys = sorted({k for row in xg[:3] for k in row.keys()}) if xg else []
        sample = xg[:2]
        # stats section
        stats = data.get("stats") or {}
        stats_keys = list(stats.keys()) if isinstance(stats, dict) else None
        players = None
        teams_stats = None
        if isinstance(stats, dict):
            players = stats.get("players")
            teams_stats = stats.get("teams")
        log(
            "D",
            "fotmob_xg_table",
            {
                "season": season,
                "n_xg_rows": len(xg),
                "keys": all_keys,
                "sample": sample,
                "stats_keys": stats_keys,
                "players_type": type(players).__name__,
                "teams_stats_type": type(teams_stats).__name__,
            },
        )

    # team page stats for Arsenal / Bournemouth
    for tid, name in [(9825, "Arsenal"), (8678, "Bournemouth")]:
        r = requests.get(
            f"https://www.fotmob.com/api/data/teams?id={tid}&season=2026/2027",
            headers=UA,
            timeout=30,
        )
        data = r.json()
        stats = data.get("stats") or {}
        # dig into stats for player xG
        summary = {
            "keys": list(data.keys()),
            "stats_keys": list(stats.keys()) if isinstance(stats, dict) else None,
        }
        if isinstance(stats, dict):
            # common shapes
            for k in ("players", "team", "seasons", "toplists", "stats"):
                v = stats.get(k)
                if v is not None:
                    summary[f"stats.{k}"] = type(v).__name__
                    if isinstance(v, list) and v:
                        summary[f"stats.{k}[0]"] = (
                            list(v[0].keys()) if isinstance(v[0], dict) else str(v[0])[:100]
                        )
                    elif isinstance(v, dict):
                        summary[f"stats.{k}.keys"] = list(v.keys())[:40]
            # dump shallow json size
            blob = json.dumps(stats)
            summary["stats_len"] = len(blob)
            # find xg paths
            def walk(obj, path="", depth=0, hits=None):
                if hits is None:
                    hits = []
                if depth > 6 or len(hits) > 40:
                    return hits
                if isinstance(obj, dict):
                    for kk, vv in obj.items():
                        p = f"{path}.{kk}" if path else kk
                        if "xg" in str(kk).lower() or "expected" in str(kk).lower():
                            hits.append(
                                {
                                    "path": p,
                                    "val": vv
                                    if not isinstance(vv, (dict, list))
                                    else (list(vv.keys())[:10] if isinstance(vv, dict) else f"list[{len(vv)}]"),
                                }
                            )
                        walk(vv, p, depth + 1, hits)
                elif isinstance(obj, list) and obj and depth < 5:
                    walk(obj[0], path + "[0]", depth + 1, hits)
                return hits

            summary["xg_hits"] = walk(stats)
        # squad
        squad = data.get("squad") or {}
        summary["squad_keys"] = list(squad.keys()) if isinstance(squad, dict) else type(squad).__name__
        log("D", f"fotmob_team_stats_{name}", summary)


def understat_window() -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("https://understat.com/league/EPL/2025", wait_until="networkidle", timeout=90000)
        time.sleep(2)
        info = page.evaluate(
            """() => {
              const td = window.teamsData;
              const pd = window.playersData;
              let teamSample = null;
              if (td && typeof td === 'object') {
                const ids = Object.keys(td);
                const first = td[ids[0]];
                teamSample = {
                  n: ids.length,
                  id0: ids[0],
                  title: first && first.title,
                  historyN: first && first.history && first.history.length,
                  history0: first && first.history && first.history[0],
                };
              }
              let playerSample = null;
              if (Array.isArray(pd) && pd.length) {
                playerSample = {
                  n: pd.length,
                  p0: {
                    id: pd[0].id,
                    player_name: pd[0].player_name,
                    team_title: pd[0].team_title,
                    xG: pd[0].xG,
                    xA: pd[0].xA,
                    shots: pd[0].shots,
                    key_passes: pd[0].key_passes,
                    npxG: pd[0].npxG,
                    xGChain: pd[0].xGChain,
                    xGBuildup: pd[0].xGBuildup,
                  }
                };
              }
              return {
                tdType: typeof td,
                pdType: Array.isArray(pd) ? 'array' : typeof pd,
                teamSample,
                playerSample,
              };
            }"""
        )
        log("C", "understat_window_2025", info)

        page.goto("https://understat.com/team/Arsenal/2025", wait_until="networkidle", timeout=90000)
        time.sleep(2)
        info2 = page.evaluate(
            """() => {
              const pd = window.playersData;
              const sample = Array.isArray(pd) && pd[0] ? pd[0] : null;
              return {
                pdType: Array.isArray(pd) ? 'array' : typeof pd,
                n: Array.isArray(pd) ? pd.length : 0,
                sample,
                keys: sample ? Object.keys(sample) : null,
              };
            }"""
        )
        log("C", "understat_window_arsenal_2025", info2)

        page.goto("https://understat.com/league/EPL/2026", wait_until="networkidle", timeout=90000)
        time.sleep(2)
        info3 = page.evaluate(
            """() => {
              const td = window.teamsData;
              const pd = window.playersData;
              let nTeams = td && typeof td === 'object' ? Object.keys(td).length : 0;
              let nPlayers = Array.isArray(pd) ? pd.length : 0;
              let p0 = Array.isArray(pd) && pd[0] ? {name: pd[0].player_name, xG: pd[0].xG, team: pd[0].team_title} : null;
              return {nTeams, nPlayers, p0, tdType: typeof td};
            }"""
        )
        log("C", "understat_window_2026", info3)
        browser.close()


def fotmob_stats_api_via_pw() -> None:
    """Capture API URLs when visiting league stats page."""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        apis = []

        def on_response(resp):
            u = resp.url
            if "/api/" in u:
                try:
                    body = resp.text()
                except Exception:
                    body = ""
                apis.append(
                    {
                        "url": u[:300],
                        "status": resp.status,
                        "has_xg": ("xG" in body or "expectedGoals" in body or '"xg"' in body.lower()),
                        "len": len(body),
                        "snip": body[:180].replace("\n", " "),
                    }
                )

        page.on("response", on_response)
        page.goto(
            "https://www.fotmob.com/leagues/47/stats/expected-goals/premier-league",
            wait_until="networkidle",
            timeout=90000,
        )
        time.sleep(3)
        # try player stats
        try:
            page.goto(
                "https://www.fotmob.com/leagues/47/stats/premier-league",
                wait_until="networkidle",
                timeout=90000,
            )
            time.sleep(2)
        except Exception:
            pass
        log("D", "fotmob_stats_apis", {"n": len(apis), "items": apis[:40]})
        browser.close()


if __name__ == "__main__":
    fotmob_xg_schema()
    understat_window()
    fotmob_stats_api_via_pw()
    print("done")
