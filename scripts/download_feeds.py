"""Download all 20 Opta feeds listed in teams_config.json.

Default feed is seasonexpectedgoals (the Opta Batch Links table).
Saves one JSON file per team, same names as the browser Download button.

    python scripts/download_feeds.py
    python scripts/download_feeds.py --feed seasonstats
    python scripts/download_feeds.py --feed both
"""

from __future__ import annotations

import argparse
import json
import re
import time
from collections import Counter
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

import requests

REPO_ROOT = Path(__file__).resolve().parent.parent
CONFIG_PATH = REPO_ROOT / "teams_config.json"
OUTPUT_DIR = REPO_ROOT / "output"
DATA_DIR = REPO_ROOT / "data"

# (feed key, folder under GameWeekX)
GAMEWEEK_FEEDS: tuple[tuple[str, str], ...] = (
    ("seasonexpectedgoals", "EXPECTED GOALS"),
    ("seasonstats", "SEASONSTATS"),
)

ProgressCallback = Callable[[int, int, str], None]

WIDGET_OUTLET = "ft1tiv1inq7v1sk3y9tv12yh5"
PRIVILEGE_ERRORS = {"10300", "10313"}
WIDGET_PATTERNS = {
    "seasonexpectedgoals": (
        f"https://api.performfeeds.com/soccerdata/seasonexpectedgoals/{WIDGET_OUTLET}"
        "?tmcl={tmcl}&ctst={ctst}&_fmt=json&_rt=c&sps=widgets"
    ),
    "seasonstats": (
        f"https://api.performfeeds.com/soccerdata/seasonstats/{WIDGET_OUTLET}"
        "?ctst={ctst}&tmcl={tmcl}&detailed=yes&_rt=c&_fmt=json&sps=widgets"
    ),
}

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-GB,en;q=0.9",
    "Referer": "https://www.scoresway.com/",
    "Origin": "https://www.scoresway.com",
}

INVALID_FILENAME_CHARS = re.compile(r'[\\/:*?"<>|]+')
WHITESPACE = re.compile(r"\s+")


def sanitize_filename(name: str) -> str:
    cleaned = INVALID_FILENAME_CHARS.sub("_", name.strip())
    cleaned = WHITESPACE.sub(" ", cleaned).strip(" ._")
    return cleaned or "unknown"


class PrivilegeError(RuntimeError):
    """Outlet is not allowed to read this feed (Opta 10300 / 10313)."""


def build_url(pattern: str, tmcl: str, ctst: str) -> str:
    return pattern.replace("{tmcl}", tmcl).replace("{ctst}", ctst)


def _read_feed(session: requests.Session, url: str) -> tuple[dict, str]:
    response = session.get(url, timeout=90)
    try:
        data = response.json()
    except ValueError as exc:
        raise RuntimeError(f"non-JSON HTTP {response.status_code}") from exc

    if isinstance(data, dict) and data.get("errorCode"):
        code = str(data.get("errorCode"))
        message = f"errorCode={code} HTTP {response.status_code}"
        if code in PRIVILEGE_ERRORS:
            raise PrivilegeError(message)
        raise RuntimeError(message)
    if not response.ok:
        raise RuntimeError(f"HTTP {response.status_code}")
    if not isinstance(data, dict):
        raise RuntimeError(f"unexpected payload HTTP {response.status_code}")
    return data, response.text


def _payload_from_text(text: str) -> tuple[dict, str]:
    raw = text.strip()
    if raw.endswith(");") and "(" in raw:
        raw = raw[raw.find("(") + 1 : raw.rfind(")")]
    try:
        data = json.loads(raw)
    except ValueError as exc:
        raise RuntimeError("Chrome returned non-JSON") from exc
    if isinstance(data, dict) and data.get("errorCode"):
        code = str(data.get("errorCode"))
        message = f"errorCode={code}"
        if code in PRIVILEGE_ERRORS:
            raise PrivilegeError(f"Chrome {message}")
        raise RuntimeError(f"Chrome {message}")
    if not isinstance(data, dict):
        raise RuntimeError("Chrome returned an unexpected payload")
    return data, raw


def _installed_chrome_proxy() -> dict[str, str] | None:
    """Proxy the installed Chrome uses for Opta, if Surf Security configured one.

    A blank Chrome profile is rejected with 10300. The signed-in browser reaches
    the same URL through this proxy. Credentials stay in the extension store.
    """
    root = (
        Path.home()
        / "AppData"
        / "Local"
        / "Google"
        / "Chrome"
        / "User Data"
        / "Default"
        / "Local Extension Settings"
        / "dpmjncncaehmgjeficalpmlfaenmbeca"
    )
    if not root.is_dir():
        return None
    chunks: list[bytes] = []
    for file in root.iterdir():
        if file.suffix not in {".ldb", ".log"}:
            continue
        try:
            chunks.append(file.read_bytes())
        except OSError:
            continue
    text = b"".join(chunks).decode("utf-8", "ignore")
    found: Counter[tuple[str, str, str]] = Counter()
    for match in re.finditer(r'proxyAddress":"([^"]+)"', text):
        window = text[max(0, match.start() - 500) : match.end() + 200]
        users = re.findall(r'(?:authUser|Username)":"([^"]+)"', window)
        passwords = re.findall(r'(?:authPassword|Password)":"([^"]*)"', window)
        if users and passwords:
            found[(match.group(1), users[0], passwords[0])] += 1
    if not found:
        return None
    ranked = found.most_common(2)
    if len(ranked) == 2 and ranked[0][1] == ranked[1][1]:
        return None
    address, username, password = ranked[0][0]
    return {
        "server": f"http://{address}",
        "username": username,
        "password": password,
    }


def download_expected_goals_via_chrome(
    teams: list[dict[str, str]],
    pattern: str,
    tmcl: str,
    dest_dir: Path,
    on_progress: ProgressCallback | None = None,
    total: int = 40,
) -> tuple[int, str | None]:
    """Open the primary Expected Goals URLs in installed Chrome and save them."""
    from playwright.sync_api import sync_playwright

    saved = 0
    launch: dict = {"channel": "chrome", "headless": False}
    proxy = _installed_chrome_proxy()
    if proxy:
        launch["proxy"] = proxy
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(**launch)
        page = browser.new_page()
        try:
            for index, team in enumerate(teams, start=1):
                name = team["name"]
                if on_progress:
                    on_progress(index, total, name)
                url = build_url(pattern, tmcl, team["ctst"])
                dest = dest_dir / f"seasonexpectedgoals - {sanitize_filename(name)}.json"
                response = page.goto(url, wait_until="domcontentloaded", timeout=60_000)
                if response is None:
                    raise RuntimeError(f"Chrome did not load {name}")
                data, raw = _payload_from_text(response.text())
                _write_feed(data, raw, dest, team["ctst"])
                saved += 1
                if index < len(teams):
                    time.sleep(0.25)
        finally:
            browser.close()
    return saved, None


def _write_feed(data: dict, raw: str, dest: Path, ctst: str) -> str:
    contestant = data.get("contestant")
    contestant_id = contestant.get("id") if isinstance(contestant, dict) else None
    contestant_name = contestant.get("name") if isinstance(contestant, dict) else None
    if contestant_id and contestant_id != ctst:
        raise RuntimeError(f"contestant id {contestant_id} != {ctst}")

    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(raw, encoding="utf-8")
    updated = data.get("lastUpdated", "?")
    return f"{contestant_name or ctst}  lastUpdated={updated}  {dest.stat().st_size} bytes"


def download_one(
    session: requests.Session,
    url: str,
    dest: Path,
    ctst: str,
    fallback_url: str | None = None,
    mode: dict | None = None,
) -> str:
    """Save one feed. On 10300/10313, retry fallback_url once and remember it."""
    try:
        data, raw = _read_feed(session, url)
    except PrivilegeError as primary_error:
        if not fallback_url:
            raise
        try:
            data, raw = _read_feed(session, fallback_url)
        except PrivilegeError as fallback_error:
            raise PrivilegeError(f"{primary_error}; widget {fallback_error}") from fallback_error
        if mode is not None:
            mode["widget"] = True
    return _write_feed(data, raw, dest, ctst)


@dataclass(frozen=True)
class GameWeekResult:
    dest: Path
    saved: int
    total: int
    stopped: bool
    error: str | None = None


def download_gameweek(
    gameweek: int,
    on_progress: ProgressCallback | None = None,
    delay: float = 0.25,
) -> GameWeekResult:
    """Save 20 expected-goals and 20 seasonstats files under data/GameWeekN.

    Stops on the first failed team. Files already written stay on disk.
    """
    if isinstance(gameweek, bool) or not isinstance(gameweek, int) or not 1 <= gameweek <= 38:
        raise ValueError("GameWeek must be an integer from 1 to 38")

    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    teams: list[dict[str, str]] = config["teams"]
    dest_root = DATA_DIR / f"GameWeek{gameweek}"
    jobs: list[tuple[str, str, dict[str, str]]] = [
        (feed, folder, team)
        for feed, folder in GAMEWEEK_FEEDS
        for team in teams
    ]
    total = len(jobs)
    session = requests.Session()
    session.headers.update(HEADERS)
    feed_mode = {feed: {"widget": False} for feed, _folder in GAMEWEEK_FEEDS}
    blocked: dict[str, str] = {}

    saved = 0
    for index, (feed, folder, team) in enumerate(jobs, start=1):
        if feed in blocked:
            continue
        name = team["name"]
        if on_progress:
            on_progress(index, total, name)
        mode = feed_mode[feed]
        primary = build_url(config["api_url_patterns"][feed], config["tmcl"], team["ctst"])
        widget = build_url(WIDGET_PATTERNS[feed], config["tmcl"], team["ctst"])
        url = widget if mode["widget"] else primary
        fallback = None if mode["widget"] else widget
        dest = dest_root / folder / f"{feed} - {sanitize_filename(name)}.json"
        try:
            download_one(
                session,
                url,
                dest,
                team["ctst"],
                fallback_url=fallback,
                mode=mode,
            )
        except PrivilegeError as exc:
            blocked[feed] = f"{name} ({feed}): {exc}"
            continue
        except Exception as exc:  # noqa: BLE001
            return GameWeekResult(
                dest=dest_root,
                saved=saved,
                total=total,
                stopped=True,
                error=f"{name} ({feed}): {exc}",
            )
        saved += 1
        if index < total:
            time.sleep(delay)

    if "seasonexpectedgoals" in blocked:
        try:
            xg_saved, _chrome_note = download_expected_goals_via_chrome(
                teams,
                config["api_url_patterns"]["seasonexpectedgoals"],
                config["tmcl"],
                dest_root / "EXPECTED GOALS",
                on_progress=on_progress,
                total=total,
            )
        except PrivilegeError as exc:
            blocked["seasonexpectedgoals"] = str(exc)
        except Exception as exc:  # noqa: BLE001
            return GameWeekResult(
                dest=dest_root,
                saved=saved,
                total=total,
                stopped=True,
                error=f"Expected Goals (Chrome): {exc}",
            )
        else:
            saved += xg_saved
            if xg_saved == len(teams):
                del blocked["seasonexpectedgoals"]

    if blocked:
        detail = " | ".join(blocked.values())
        if saved:
            detail = f"נשמרו {saved} קבצים. פיד שנחסם: {detail}"
        return GameWeekResult(
            dest=dest_root,
            saved=saved,
            total=total,
            stopped=True,
            error=detail,
        )
    return GameWeekResult(dest=dest_root, saved=saved, total=total, stopped=False)


def main() -> None:
    parser = argparse.ArgumentParser(description="Download Opta feeds for all 20 clubs")
    parser.add_argument(
        "--feed",
        choices=("seasonexpectedgoals", "seasonstats", "both"),
        default="seasonexpectedgoals",
    )
    parser.add_argument("--out", type=Path, default=OUTPUT_DIR)
    parser.add_argument("--delay", type=float, default=0.3)
    args = parser.parse_args()

    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    feeds = (
        ["seasonexpectedgoals", "seasonstats"]
        if args.feed == "both"
        else [args.feed]
    )
    teams: list[dict[str, str]] = config["teams"]
    out: Path = args.out
    out.mkdir(parents=True, exist_ok=True)

    session = requests.Session()
    session.headers.update(HEADERS)

    ok = 0
    failed: list[str] = []
    total = len(teams) * len(feeds)
    n = 0
    for feed in feeds:
        pattern = config["api_url_patterns"][feed]
        for team in teams:
            n += 1
            name = team["name"]
            url = build_url(pattern, config["tmcl"], team["ctst"])
            dest = out / f"{feed} - {sanitize_filename(name)}.json"
            print(f"[{n}/{total}] {feed}  {name}", flush=True)
            try:
                summary = download_one(session, url, dest, team["ctst"])
            except Exception as exc:  # noqa: BLE001
                failed.append(f"{name} ({feed}): {exc}")
                print(f"  FAIL  {exc}", flush=True)
            else:
                ok += 1
                print(f"  OK    {summary}", flush=True)
            if n < total:
                time.sleep(args.delay)

    print(f"Saved {ok}/{total} file(s) to {out}")
    for item in failed:
        print(f"FAILED  {item}")
    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
