"""
Scrape Premier League team IDs from Scoresway, then download Opta
SeasonStats and Season Expected Goals JSON via Perform Feeds APIs.

Setup:
    cd scripts
    pip install -r requirements.txt
    playwright install chromium
    python scrape_pl_teams.py
"""

from __future__ import annotations

import json
import logging
import re
import time
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlparse

import requests
from playwright.sync_api import BrowserContext, Page, Response, sync_playwright

# --- Constants ----------------------------------------------------------------

TEAMS_PAGE_URL = (
    "https://www.scoresway.com/en_GB/soccer/"
    "premier-league-2026-2027/6pdwluctev9iebv00r4qqukno/teams"
)
OUTLET_ID = "137iv2fgxqg281d2xtb1pl4oyi"
# Public Scoresway widget outlet — seasonstats fallback when 137… is unauthorized.
SCORESWAY_OUTLET_ID = "ft1tiv1inq7v1sk3y9tv12yh5"

SEASONSTATS_PATTERN = (
    f"https://api.performfeeds.com/soccerdata/seasonstats/{OUTLET_ID}"
    "?ctst={ctst}&tmcl={tmcl}&detailed=yes&_rt=b&_fmt=json"
)
SEASON_XG_PATTERN = (
    f"https://api.performfeeds.com/soccerdata/seasonexpectedgoals/{OUTLET_ID}"
    "?tmcl={tmcl}&ctst={ctst}&_fmt=json&_rt=b"
)
SEASONSTATS_FALLBACK_PATTERN = (
    f"https://api.performfeeds.com/soccerdata/seasonstats/{SCORESWAY_OUTLET_ID}"
    "?ctst={ctst}&tmcl={tmcl}&detailed=yes&_rt=c&_fmt=json&sps=widgets"
)

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/131.0.0.0 Safari/537.36"
)
REQUEST_HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-GB,en;q=0.9",
    "Referer": "https://www.scoresway.com/",
    "Origin": "https://www.scoresway.com",
}

TEAM_LIMIT = 2
# If set to a ctst hash, process only that team (smoke test). None = use TEAM_LIMIT.
SMOKE_TEAM_CTST = None
REQUEST_DELAY_SEC = 1.0
PAGE_TIMEOUT_MS = 90_000
PRIVILEGE_ERRORS = {"10300", "10313"}

REPO_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = REPO_ROOT / "output"
CONFIG_PATH = REPO_ROOT / "teams_config.json"

INVALID_FILENAME_CHARS = re.compile(r'[\\/:*?"<>|]+')
WHITESPACE = re.compile(r"\s+")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("scrape_pl_teams")


# --- Helpers ------------------------------------------------------------------


def sanitize_filename(name: str) -> str:
    """Strip invalid path characters and collapse whitespace."""
    cleaned = INVALID_FILENAME_CHARS.sub("_", name.strip())
    cleaned = WHITESPACE.sub(" ", cleaned).strip(" ._")
    return cleaned or "unknown"


def extract_tmcl(url: str) -> str:
    """Extract tournament calendar id from a Scoresway competition URL."""
    parts = urlparse(url).path.strip("/").split("/")
    # …/soccer/<competition-slug>/<tmcl>/teams[/…]
    for i, part in enumerate(parts):
        if part == "teams" and i > 0:
            return parts[i - 1]
    raise ValueError(f"Could not extract tmcl from URL: {url}")


def extract_ctst(href: str) -> str | None:
    """Return the final path segment (team hash) from a team URL."""
    path = urlparse(href).path.rstrip("/")
    if not path:
        return None
    segment = path.rsplit("/", 1)[-1]
    if re.fullmatch(r"[a-z0-9]{16,40}", segment):
        return segment
    return None


def absolute_url(href: str) -> str:
    if href.startswith("http"):
        return href
    return urljoin("https://www.scoresway.com", href)


def is_valid_feed_payload(data: Any) -> bool:
    if not isinstance(data, dict):
        return False
    if data.get("errorCode"):
        return False
    if data.get("httpStatus") in {"403", 403}:
        return False
    return True


def save_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    log.info("Saved → %s", path)


def write_teams_config(tmcl: str, teams: list[dict[str, str]]) -> None:
    config = {
        "tmcl": tmcl,
        "outlet_id": OUTLET_ID,
        "teams_page_url": TEAMS_PAGE_URL,
        "api_url_patterns": {
            "seasonstats": SEASONSTATS_PATTERN,
            "seasonexpectedgoals": SEASON_XG_PATTERN,
        },
        "teams": teams,
    }
    save_json(CONFIG_PATH, config)
    log.info("Wrote config with %d team(s) → %s", len(teams), CONFIG_PATH)


def scrape_teams(page: Page) -> tuple[str, list[dict[str, str]]]:
    """Navigate to the teams page; return (tmcl, [{name, ctst, url}, …])."""
    log.info("Navigating to teams page: %s", TEAMS_PAGE_URL)
    page.goto(TEAMS_PAGE_URL, wait_until="domcontentloaded", timeout=PAGE_TIMEOUT_MS)

    try:
        page.wait_for_load_state("networkidle", timeout=PAGE_TIMEOUT_MS)
    except Exception as exc:  # noqa: BLE001
        log.warning("networkidle wait ended early: %s", exc)
    time.sleep(5)

    tmcl = extract_tmcl(page.url if "/teams" in page.url else TEAMS_PAGE_URL)
    log.info("Extracted tmcl=%s", tmcl)

    selector = 'a[href*="/teams/"]'
    log.info("Waiting for team links (%s)…", selector)
    try:
        page.wait_for_selector(selector, timeout=PAGE_TIMEOUT_MS)
    except Exception:
        log.error(
            "Selector timed out. Current page title=%r url=%s",
            page.title(),
            page.url,
        )
        raise

    anchors = page.query_selector_all(selector)
    log.info("Found %d candidate link(s)", len(anchors))

    by_ctst: dict[str, dict[str, str]] = {}
    for anchor in anchors:
        href = anchor.get_attribute("href") or ""
        ctst = extract_ctst(href)
        if not ctst:
            continue
        text = WHITESPACE.sub(" ", (anchor.inner_text() or "").strip())
        full = absolute_url(href)
        if not text:
            parts = urlparse(full).path.strip("/").split("/")
            text = parts[-2].replace("-", " ").title() if len(parts) >= 2 else ctst
        if ctst not in by_ctst:
            by_ctst[ctst] = {"name": text, "ctst": ctst, "url": full}
            log.info("  Team: %s  →  ctst=%s", text, ctst)

    teams = list(by_ctst.values())
    log.info("Deduplicated team count: %d", len(teams))
    return tmcl, teams


def fetch_json(session: requests.Session, url: str) -> tuple[Any | None, str | None]:
    """GET url; return (data, None) on success or (None, error_message)."""
    log.info("GET %s", url)
    try:
        response = session.get(url, timeout=60)
    except requests.RequestException as exc:
        return None, str(exc)

    try:
        data = response.json()
    except ValueError:
        return None, f"non-JSON status={response.status_code}"

    if isinstance(data, dict) and data.get("errorCode"):
        code = str(data.get("errorCode"))
        return None, f"errorCode={code} status={response.status_code}"

    if not response.ok:
        return None, f"HTTP {response.status_code}"

    if not is_valid_feed_payload(data):
        return None, "invalid feed payload"

    return data, None


def fetch_seasonstats(session: requests.Session, tmcl: str, ctst: str, name: str) -> bool:
    path = OUTPUT_DIR / f"seasonstats - {sanitize_filename(name)}.json"
    primary = SEASONSTATS_PATTERN.format(ctst=ctst, tmcl=tmcl)
    data, err = fetch_json(session, primary)
    if data is not None:
        save_json(path, data)
        return True

    log.warning("seasonstats primary failed for %s (%s); trying Scoresway fallback", name, err)
    fallback = SEASONSTATS_FALLBACK_PATTERN.format(ctst=ctst, tmcl=tmcl)
    data, err2 = fetch_json(session, fallback)
    if data is not None:
        save_json(path, data)
        return True

    log.error("seasonstats failed for %s (%s)", name, err2 or err)
    return False


def _parse_performfeeds_body(text: str) -> Any | None:
    text = text.strip()
    if not text:
        return None
    # JSONP: callback({…});
    if "(" in text and text.endswith(");"):
        start = text.find("(")
        end = text.rfind(")")
        text = text[start + 1 : end]
    try:
        return json.loads(text)
    except ValueError:
        return None


def _looks_like_xg(data: Any) -> bool:
    if not is_valid_feed_payload(data):
        return False
    blob = json.dumps(data)
    return "expectedGoals" in blob or "seasonexpectedgoals" in blob.lower()


def fetch_xg_via_playwright(
    page: Page,
    context: BrowserContext,
    tmcl: str,
    team: dict[str, str],
) -> Any | None:
    """Navigate team page, intercept xG-like responses, and try browser-context GET."""
    name = team["name"]
    ctst = team["ctst"]
    team_url = team["url"]
    xg_url = SEASON_XG_PATTERN.format(ctst=ctst, tmcl=tmcl)
    captured: list[Any] = []

    def on_response(resp: Response) -> None:
        url = resp.url
        if "performfeeds" not in url and "seasonexpectedgoals" not in url:
            return
        interesting = "seasonexpectedgoals" in url or "expectedgoals" in url.lower()
        try:
            body = resp.text()
        except Exception:
            return
        data = _parse_performfeeds_body(body)
        if data is None:
            return
        if interesting or _looks_like_xg(data):
            if is_valid_feed_payload(data):
                captured.append(data)
                log.info("Intercepted usable xG-like payload from %s", url[:120])

    page.on("response", on_response)
    try:
        log.info("Playwright xG fallback: navigating to %s", team_url)
        page.goto(team_url, wait_until="domcontentloaded", timeout=PAGE_TIMEOUT_MS)
        try:
            page.wait_for_load_state("networkidle", timeout=PAGE_TIMEOUT_MS)
        except Exception:
            pass
        time.sleep(3)

        for label in ("Statistics", "Stats", "Players", "Season"):
            try:
                loc = page.get_by_text(label, exact=False)
                if loc.count():
                    loc.first.click(timeout=2500)
                    time.sleep(2)
            except Exception:
                pass

        # Browser-context request with Scoresway referrer
        log.info("Playwright context.request GET xG for %s", name)
        try:
            api_resp = context.request.get(
                xg_url,
                headers={
                    "Accept": "application/json",
                    "Referer": "https://www.scoresway.com/",
                    "Origin": "https://www.scoresway.com",
                },
            )
            data = _parse_performfeeds_body(api_resp.text())
            if data is not None and is_valid_feed_payload(data):
                log.info("context.request returned valid xG for %s", name)
                return data
            if isinstance(data, dict) and data.get("errorCode"):
                log.warning(
                    "context.request xG denied for %s (errorCode=%s)",
                    name,
                    data.get("errorCode"),
                )
        except Exception as exc:  # noqa: BLE001
            log.warning("context.request xG failed for %s: %s", name, exc)

        time.sleep(2)
        if captured:
            return captured[0]
    finally:
        page.remove_listener("response", on_response)

    return None


def fetch_seasonexpectedgoals(
    session: requests.Session,
    page: Page,
    context: BrowserContext,
    tmcl: str,
    team: dict[str, str],
) -> bool:
    name = team["name"]
    ctst = team["ctst"]
    path = OUTPUT_DIR / f"seasonexpectedgoals - {sanitize_filename(name)}.json"
    primary = SEASON_XG_PATTERN.format(ctst=ctst, tmcl=tmcl)
    log.info("Exact seasonexpectedgoals URL: %s", primary)

    data, err = fetch_json(session, primary)
    if data is not None:
        save_json(path, data)
        return True

    # Privilege / auth errors → Playwright fallback
    code_match = re.search(r"errorCode=(\d+)", err or "")
    err_code = code_match.group(1) if code_match else ""
    if err_code in PRIVILEGE_ERRORS or (err and "403" in err):
        log.warning(
            "seasonexpectedgoals primary failed for %s (%s); trying Playwright fallback",
            name,
            err,
        )
        data = fetch_xg_via_playwright(page, context, tmcl, team)
        if data is not None:
            save_json(path, data)
            return True

    log.error(
        "seasonexpectedgoals failed for %s — no privileged feed / intercept "
        "(%s). Not writing a placeholder file.",
        name,
        err,
    )
    return False


def main() -> None:
    log.info("Output directory: %s", OUTPUT_DIR)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    session = requests.Session()
    session.headers.update(REQUEST_HEADERS)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(user_agent=USER_AGENT, locale="en-GB")
        page = context.new_page()
        try:
            tmcl, all_teams = scrape_teams(page)
            if not all_teams:
                log.error("No teams found — aborting.")
                raise SystemExit(1)

            write_teams_config(tmcl, all_teams)

            if SMOKE_TEAM_CTST:
                to_process = [t for t in all_teams if t["ctst"] == SMOKE_TEAM_CTST]
                if not to_process:
                    log.error("SMOKE_TEAM_CTST=%s not found in scraped teams", SMOKE_TEAM_CTST)
                    raise SystemExit(1)
                log.info(
                    "Smoke test: only %s (ctst=%s)",
                    to_process[0]["name"],
                    SMOKE_TEAM_CTST,
                )
            else:
                to_process = all_teams[:TEAM_LIMIT]
                log.info(
                    "Test run: processing first %d of %d team(s)",
                    len(to_process),
                    len(all_teams),
                )

            saved_stats = 0
            saved_xg = 0
            for i, team in enumerate(to_process, start=1):
                name, ctst = team["name"], team["ctst"]
                log.info("[%d/%d] %s (%s)", i, len(to_process), name, ctst)

                if fetch_seasonstats(session, tmcl, ctst, name):
                    saved_stats += 1
                time.sleep(REQUEST_DELAY_SEC)

                if fetch_seasonexpectedgoals(session, page, context, tmcl, team):
                    saved_xg += 1
                time.sleep(REQUEST_DELAY_SEC)

            log.info(
                "Done. Config=%s | seasonstats=%d | seasonexpectedgoals=%d | output=%s",
                CONFIG_PATH,
                saved_stats,
                saved_xg,
                OUTPUT_DIR,
            )
            if saved_stats == 0:
                raise SystemExit(2)
        finally:
            browser.close()


if __name__ == "__main__":
    main()
