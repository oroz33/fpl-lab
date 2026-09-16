"""Probe Scoresway + open sources for PL xG availability. Writes NDJSON to debug-bf151f.log."""

from __future__ import annotations

import json
import re
import time
from pathlib import Path

import requests
from playwright.sync_api import sync_playwright

LOG = Path(r"C:\Work\CURSOR\FPL\debug-bf151f.log")
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)


def alog(hid: str, msg: str, data: dict) -> None:
    payload = {
        "sessionId": "bf151f",
        "runId": "xg-explore",
        "hypothesisId": hid,
        "location": "probe_xg_sources.py",
        "message": msg,
        "data": data,
        "timestamp": int(time.time() * 1000),
    }
    with LOG.open("a", encoding="utf-8") as f:
        f.write(json.dumps(payload, ensure_ascii=False) + "\n")
    print(hid, msg, json.dumps(data)[:200])


def probe_scoresway() -> None:
    team_url = (
        "https://www.scoresway.com/en_GB/soccer/premier-league-2026-2027/"
        "6pdwluctev9iebv00r4qqukno/teams/arsenal-fc/4dsgumo7d4zupm2ugsvm4zm4d"
    )
    stats_url = (
        "https://www.scoresway.com/en_GB/soccer/premier-league-2026-2027/"
        "6pdwluctev9iebv00r4qqukno/team-stats"
    )
    player_stats = (
        "https://www.scoresway.com/en_GB/soccer/premier-league-2026-2027/"
        "6pdwluctev9iebv00r4qqukno/player-stats"
    )
    captured: list[dict] = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(user_agent=UA, locale="en-GB")
        page = context.new_page()

        def on_resp(resp) -> None:
            u = resp.url.lower()
            if any(k in u for k in ("xg", "expected", "understat", "performfeeds", "opta")):
                try:
                    body = resp.text()[:180]
                except Exception as e:
                    body = str(e)
                captured.append({"url": resp.url[:220], "status": resp.status, "body": body})

        page.on("response", on_resp)

        for url, label in (
            (team_url, "team"),
            (stats_url, "team-stats"),
            (player_stats, "player-stats"),
        ):
            page.goto(url, wait_until="domcontentloaded", timeout=90000)
            time.sleep(4)
            for tab in ("xG", "Expected", "Attack", "Statistics", "Stats"):
                try:
                    loc = page.get_by_text(tab, exact=False)
                    if loc.count():
                        loc.first.click(timeout=2000)
                        time.sleep(2)
                except Exception:
                    pass
            dom = page.evaluate(
                """() => {
                  const text = document.body.innerText || '';
                  const hasXG = /\\bxG\\b|expected goals|Exp\\. Goals/i.test(text);
                  const matches = [...text.matchAll(/xG[^\\n]{0,40}/gi)].slice(0, 15).map(m => m[0]);
                  const winKeys = Object.keys(window).filter(k =>
                    /opta|widget|kickstart|__NEXT|__NUXT|stat/i.test(k)
                  ).slice(0, 40);
                  let next = null;
                  const nd = document.getElementById('__NEXT_DATA__');
                  if (nd) next = nd.textContent.slice(0, 300);
                  return { hasXG, matches, winKeys, next, title: document.title, url: location.href };
                }"""
            )
            alog("A,B", f"scoresway_{label}", {"dom": dom, "captured_n": len(captured)})

        alog(
            "A,B",
            "scoresway_network",
            {
                "n": len(captured),
                "items": captured[:20],
                "feeds": sorted(
                    {
                        i["url"].split("/soccerdata/")[1].split("/")[0]
                        for i in captured
                        if "/soccerdata/" in i["url"]
                    }
                ),
            },
        )
        browser.close()


def probe_understat() -> None:
    headers = {"User-Agent": UA, "Accept": "text/html"}
    years = ["2026", "2025", "2024"]
    for y in years:
        url = f"https://understat.com/league/EPL/{y}"
        try:
            r = requests.get(url, headers=headers, timeout=30)
        except Exception as e:
            alog("C", "understat_league_err", {"year": y, "err": str(e)})
            continue
        # Understat embeds: var teamsData = JSON.parse('...')
        m = re.search(r"teamsData\s*=\s*JSON\.parse\('(.+?)'\)", r.text)
        players = re.search(r"playersData\s*=\s*JSON\.parse\('(.+?)'\)", r.text)
        sample = None
        if m:
            raw = m.group(1).encode("utf-8").decode("unicode_escape")
            try:
                data = json.loads(raw)
                first = next(iter(data.values())) if isinstance(data, dict) else None
                sample = {
                    "keys": list(data.keys())[:5] if isinstance(data, dict) else type(data).__name__,
                    "first_title": (first or {}).get("title") if isinstance(first, dict) else None,
                    "first_xG": (first or {}).get("xG") if isinstance(first, dict) else None,
                    "n": len(data) if hasattr(data, "__len__") else None,
                }
            except Exception as e:
                sample = {"parse_err": str(e), "raw_prefix": raw[:120]}
        alog(
            "C",
            "understat_league",
            {
                "year": y,
                "status": r.status_code,
                "has_teamsData": bool(m),
                "has_playersData": bool(players),
                "sample": sample,
                "len": len(r.text),
            },
        )

    # Team page for Arsenal
    for path in ("Arsenal", "arsenal"):
        url = f"https://understat.com/team/{path}/2026"
        r = requests.get(url, headers=headers, timeout=30)
        m = re.search(r"playersData\s*=\s*JSON\.parse\('(.+?)'\)", r.text)
        alog(
            "C",
            "understat_team",
            {
                "url": url,
                "status": r.status_code,
                "has_playersData": bool(m),
                "title_snip": re.search(r"<title>([^<]+)", r.text).group(1) if r.ok else None,
            },
        )


def probe_fbref() -> None:
    headers = {"User-Agent": UA}
    urls = [
        "https://fbref.com/en/comps/9/stats/Premier-League-Stats",
        "https://fbref.com/en/comps/9/shooting/Premier-League-Stats",
        "https://fbref.com/en/comps/9/2025-2026/shooting/2025-2026-Premier-League-Stats",
        "https://fbref.com/en/comps/9/2026-2027/shooting/2026-2027-Premier-League-Stats",
    ]
    for url in urls:
        try:
            r = requests.get(url, headers=headers, timeout=30)
        except Exception as e:
            alog("D", "fbref_err", {"url": url, "err": str(e)})
            continue
        has_xg = "xg" in r.text.lower() or "npxG" in r.text
        # look for table
        tables = len(re.findall(r"<table", r.text, re.I))
        alog(
            "D",
            "fbref",
            {
                "url": url,
                "status": r.status_code,
                "has_xg": has_xg,
                "tables": tables,
                "len": len(r.text),
                "title": (re.search(r"<title>([^<]+)", r.text) or [None, None])[1],
            },
        )


def probe_fotmob() -> None:
    headers = {"User-Agent": UA, "Accept": "application/json"}
    # FotMob API (undocumented but commonly used)
    urls = [
        "https://www.fotmob.com/api/leagues?id=47&season=2026",
        "https://www.fotmob.com/api/leagues?id=47&season=2025",
        "https://www.fotmob.com/api/data/leagues?id=47",
    ]
    for url in urls:
        try:
            r = requests.get(url, headers=headers, timeout=30)
            preview = r.text[:200]
            alog("D", "fotmob", {"url": url, "status": r.status_code, "preview": preview})
        except Exception as e:
            alog("D", "fotmob_err", {"url": url, "err": str(e)})


def main() -> None:
    probe_understat()
    probe_fbref()
    probe_fotmob()
    probe_scoresway()
    print("done")


if __name__ == "__main__":
    main()
