"""Round 2: Understat via Playwright + FotMob stats APIs for xG."""
from __future__ import annotations

import json
import re
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
        "runId": "xg-round2",
        "hypothesisId": hypothesis_id,
        "location": "probe_xg_round2.py",
        "message": message,
        "data": data,
        "timestamp": int(time.time() * 1000),
    }
    with LOG.open("a", encoding="utf-8") as f:
        f.write(json.dumps(payload, ensure_ascii=False) + "\n")
    print(hypothesis_id, message, json.dumps(data, ensure_ascii=False)[:400])


def extract_understat_blob(html: str, name: str):
    m = re.search(
        rf"var\s+{name}\s*=\s*JSON\.parse\('((?:\\'|[^'])*)'\)",
        html,
    )
    if not m:
        return None
    raw = m.group(1).encode("utf-8").decode("unicode_escape")
    return json.loads(raw)


def probe_understat_playwright() -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        captured = []

        def on_response(resp):
            u = resp.url.lower()
            if any(k in u for k in ("understat", "xg", "json", "api")):
                try:
                    body = resp.text()[:200]
                except Exception as e:
                    body = str(e)
                captured.append({"url": resp.url[:200], "status": resp.status, "body": body})

        page.on("response", on_response)
        for year in ("2025", "2024", "2026"):
            url = f"https://understat.com/league/EPL/{year}"
            page.goto(url, wait_until="networkidle", timeout=90000)
            time.sleep(2)
            html = page.content()
            teams = extract_understat_blob(html, "teamsData")
            players = extract_understat_blob(html, "playersData")
            # also try evaluate
            eval_keys = page.evaluate(
                """() => {
                  const out = {};
                  for (const k of ['teamsData','playersData','datesData']) {
                    try { out[k] = typeof window[k] !== 'undefined'; } catch(e) { out[k]=false; }
                  }
                  out.title = document.title;
                  out.len = document.documentElement.innerHTML.length;
                  // script text sample
                  const scripts = [...document.scripts].map(s => s.textContent||'').join('\\n');
                  out.hasTeamsInScripts = scripts.includes('teamsData');
                  out.hasPlayersInScripts = scripts.includes('playersData');
                  out.hasXg = /expectedGoals|xG|npxG/i.test(scripts) || /expectedGoals|xG|npxG/i.test(document.body.innerText);
                  return out;
                }"""
            )
            sample = None
            if teams and isinstance(teams, dict):
                first = next(iter(teams.values()), None)
                sample = {
                    "keys": list(teams.keys())[:3],
                    "first_title": (first or {}).get("title"),
                    "history_n": len((first or {}).get("history") or []),
                }
            log(
                "C",
                "understat_pw_league",
                {
                    "year": year,
                    "url": url,
                    "has_teams": bool(teams),
                    "has_players": bool(players),
                    "sample": sample,
                    "eval": eval_keys,
                    "captured_n": len(captured),
                },
            )
        # team page
        page.goto("https://understat.com/team/Arsenal/2025", wait_until="networkidle", timeout=90000)
        time.sleep(2)
        html = page.content()
        players = extract_understat_blob(html, "playersData")
        sample_p = None
        if isinstance(players, list) and players:
            sample_p = {k: players[0].get(k) for k in ("player_name", "xG", "xA", "shots", "id")}
        log(
            "C",
            "understat_pw_team",
            {
                "has_players": bool(players),
                "n_players": len(players) if isinstance(players, list) else 0,
                "sample": sample_p,
                "title": page.title(),
            },
        )
        browser.close()


def dig_fotmob() -> None:
    # league overview
    r = requests.get("https://www.fotmob.com/api/data/leagues?id=47&season=2025", headers=UA, timeout=30)
    data = r.json()
    keys = list(data.keys())
    stats = data.get("stats") or data.get("leagueStats") or {}
    # find xg-ish keys recursively shallow
    def find_xg(obj, path="", depth=0, hits=None):
        if hits is None:
            hits = []
        if depth > 4 or len(hits) > 30:
            return hits
        if isinstance(obj, dict):
            for k, v in obj.items():
                p = f"{path}.{k}" if path else k
                if re.search(r"xg|expected.?goal", str(k), re.I):
                    hits.append({"path": p, "type": type(v).__name__, "sample": str(v)[:120]})
                find_xg(v, p, depth + 1, hits)
        elif isinstance(obj, list) and obj and depth < 3:
            find_xg(obj[0], path + "[0]", depth + 1, hits)
        return hits

    hits = find_xg(data)
    log(
        "D",
        "fotmob_league_keys",
        {
            "status": r.status_code,
            "keys": keys,
            "xg_hits": hits[:20],
            "stats_type": type(stats).__name__,
            "stats_keys": list(stats.keys())[:30] if isinstance(stats, dict) else None,
        },
    )

    # team Arsenal 9825
    r2 = requests.get(
        "https://www.fotmob.com/api/data/teams?id=9825&season=2025",
        headers=UA,
        timeout=30,
    )
    tdata = r2.json() if r2.status_code == 200 else {}
    thits = find_xg(tdata)
    log(
        "D",
        "fotmob_team",
        {
            "status": r2.status_code,
            "keys": list(tdata.keys()) if isinstance(tdata, dict) else None,
            "xg_hits": thits[:20],
            "details": (tdata.get("details") or {}),
        },
    )

    # try known stats endpoints
    candidates = [
        "https://www.fotmob.com/api/data/leagues?id=47&season=2025&tab=stats",
        "https://www.fotmob.com/api/data/leagueseasonstats?id=47&season=2025",
        "https://www.fotmob.com/api/data/teamsSeasonStats?id=9825&season=2025",
        "https://www.fotmob.com/api/data/teamStats?id=9825&season=2025",
        "https://www.fotmob.com/api/tltable?leagueId=47&season=2025",
        "https://www.fotmob.com/api/data/stats?id=47&type=players&season=2025",
        "https://www.fotmob.com/api/data/leagueSeasonDetails?id=47&season=2025",
        "https://www.fotmob.com/api/data/leagues?id=47&season=2025/2026",
        "https://www.fotmob.com/api/data/teams?id=9825&season=2025/2026",
        "https://www.fotmob.com/api/data/playerStats?playerId=318944&seasonId=23685",
    ]
    for url in candidates:
        try:
            rr = requests.get(url, headers=UA, timeout=20)
            preview = rr.text[:250].replace("\n", " ")
            has_xg = bool(re.search(r"expectedGoals|\"xG\"|xgPerMatch|expected_goals", rr.text, re.I))
            log(
                "D",
                "fotmob_candidate",
                {"url": url, "status": rr.status_code, "has_xg": has_xg, "preview": preview},
            )
        except Exception as e:
            log("D", "fotmob_candidate", {"url": url, "error": str(e)})

    # From league response, extract table team ids and season ids
    table = data.get("table") or data.get("standings") or {}
    log("D", "fotmob_table_shape", {"table_type": type(table).__name__, "preview": str(table)[:400]})


def dig_fotmob_playwright() -> None:
    """Load FotMob league stats page and capture network for xG."""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(user_agent=UA["User-Agent"])
        page = context.new_page()
        hits = []

        def on_response(resp):
            u = resp.url
            if "fotmob" not in u.lower():
                return
            try:
                ct = (resp.headers.get("content-type") or "").lower()
                if "json" not in ct and "javascript" not in ct and "/api/" not in u:
                    return
                body = resp.text()
            except Exception:
                return
            if re.search(r"expectedGoals|\"xG\"|xgPer90|npxG|expected_goals", body, re.I):
                hits.append(
                    {
                        "url": u[:250],
                        "status": resp.status,
                        "snip": body[:300].replace("\n", " "),
                    }
                )

        page.on("response", on_response)
        urls = [
            "https://www.fotmob.com/leagues/47/overview/premier-league",
            "https://www.fotmob.com/leagues/47/stats/premier-league",
            "https://www.fotmob.com/teams/9825/overview/arsenal",
            "https://www.fotmob.com/teams/9825/squad/arsenal",
        ]
        for url in urls:
            try:
                page.goto(url, wait_until="networkidle", timeout=90000)
                time.sleep(3)
                # click stats tabs if present
                for label in ("Stats", "Players", "Expected goals", "xG"):
                    try:
                        page.get_by_text(label, exact=False).first.click(timeout=2000)
                        time.sleep(2)
                    except Exception:
                        pass
                dom = page.evaluate(
                    """() => {
                      const t = document.body.innerText;
                      return {
                        title: document.title,
                        hasXG: /\\bxG\\b|expected goals/i.test(t),
                        snip: (t.match(/.{0,40}xG.{0,40}/i)||[])[0] || null,
                      };
                    }"""
                )
                log("D", "fotmob_pw_page", {"url": url, "dom": dom, "xg_net_n": len(hits)})
            except Exception as e:
                log("D", "fotmob_pw_page", {"url": url, "error": str(e)})
        log("D", "fotmob_pw_xg_network", {"n": len(hits), "items": hits[:15]})
        browser.close()


if __name__ == "__main__":
    dig_fotmob()
    probe_understat_playwright()
    dig_fotmob_playwright()
    print("done")
