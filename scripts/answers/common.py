from __future__ import annotations

import csv
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ID_PATTERN = re.compile(r"\b(\d+)\.(\d+)\.(\d+)\b")
GATEOVERFLOW_ID_PATTERN = re.compile(r"gateoverflow\.in/(\d+)")
GATE_CSE_LINK_PATTERN = re.compile(
    r"gate-cse-(?P<year>\d{4})(?:-set-(?P<set>\d+))?-(?P<section>ga-)?question-(?P<question>[^/?#]+)",
    re.IGNORECASE,
)
GATE_CSE_YEAR_TAG_PATTERN = re.compile(r"gatecse-(?P<year>\d{4})(?:-set(?P<set>\d+))?", re.IGNORECASE)
GATE_CSE_TITLE_PATTERN = re.compile(r"GATE\s+CSE\s+(?P<year>\d{4})(?:\s+Set\s*(?P<set>\d+))?", re.IGNORECASE)
GATE_CSE_TITLE_QUESTION_PATTERN = re.compile(
    r"(?P<section>GA\s+)?Question\s*[: ]\s*(?P<question>[0-9]+(?:\.[0-9]+)?(?:-[A-Za-z0-9]+)*)",
    re.IGNORECASE,
)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def ensure_dir(path: str | Path) -> Path:
    directory = Path(path)
    directory.mkdir(parents=True, exist_ok=True)
    return directory


def read_json(path: str | Path) -> Any:
    with Path(path).open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: str | Path, payload: Any) -> None:
    out_path = Path(path)
    ensure_dir(out_path.parent)
    with out_path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, ensure_ascii=False)


def write_csv(path: str | Path, rows: list[dict[str, Any]], fieldnames: list[str]) -> None:
    out_path = Path(path)
    ensure_dir(out_path.parent)
    with out_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow({key: row.get(key, "") for key in fieldnames})


def normalize_ws(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def parse_id_str(id_str: str) -> tuple[int, int, int] | None:
    match = ID_PATTERN.fullmatch(id_str.strip())
    if not match:
        return None
    chapter_no, subject_code, question_no = (int(part) for part in match.groups())
    return chapter_no, subject_code, question_no


def uid_from(volume: int, id_str: str) -> str:
    return f"v{volume}:{id_str}"


def stable_local_question_hash(title: str, question_html: str, link: str) -> str:
    raw = f"{title.strip()}||{question_html.strip()}||{link.strip()}"
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:16]


def question_uid_from_record(question: dict[str, Any]) -> str:
    go_id = extract_gateoverflow_numeric_id(str(question.get("link", "")))
    if go_id:
        return f"go:{go_id}"
    return f"local:{stable_local_question_hash(str(question.get('title', '')), str(question.get('question', '')), str(question.get('link', '')))}"


def extract_gateoverflow_numeric_id(url: str) -> str | None:
    if "/tag/" in url or "/questions/" in url:
        return None
    match = GATEOVERFLOW_ID_PATTERN.search(url)
    if not match:
        return None
    return match.group(1)


def canonical_gateoverflow_url(question_id: str) -> str:
    return f"https://gateoverflow.in/{question_id}"


def flatten_page_ranges(page_ranges: list[Any] | None) -> list[int]:
    if not page_ranges:
        return []

    pages: set[int] = set()
    for item in page_ranges:
        if isinstance(item, int):
            pages.add(item)
            continue

        if isinstance(item, list) and len(item) == 2:
            start, end = int(item[0]), int(item[1])
            pages.update(range(start, end + 1))
            continue

        if isinstance(item, dict) and "start" in item and "end" in item:
            start, end = int(item["start"]), int(item["end"])
            pages.update(range(start, end + 1))
            continue

    return sorted(pages)


def _normalize_set_no(raw_set: str | int | None) -> str:
    if raw_set is None:
        return "1"
    try:
        normalized = int(str(raw_set).strip())
        if normalized <= 0:
            return "1"
        return str(normalized)
    except (TypeError, ValueError):
        return "1"


def normalize_exam_question_token(raw_token: str) -> str:
    token = str(raw_token or "").strip().lower()
    if not token:
        return ""
    token = token.replace("_", "-").replace("–", "-").replace("—", "-")
    token = re.sub(r"[^a-z0-9.\-]+", "-", token)
    token = re.sub(r"-{2,}", "-", token).strip("-.")
    parts = re.split(r"([.-])", token)
    normalized_parts: list[str] = []
    for part in parts:
        if part in {".", "-"}:
            normalized_parts.append(part)
            continue
        if part.isdigit():
            normalized_parts.append(str(int(part)))
            continue
        normalized_parts.append(part)
    return "".join(normalized_parts).strip("-.")


def _year_and_set_from_year_tag(year_tag: str) -> tuple[str | None, str]:
    match = GATE_CSE_YEAR_TAG_PATTERN.search(str(year_tag or "").strip())
    if not match:
        return None, "1"
    return match.group("year"), _normalize_set_no(match.group("set"))


def _build_exam_uid(*, year: str, set_no: str, section: str, question_token: str) -> str:
    return f"cse:{year}:set{_normalize_set_no(set_no)}:{section}:q{question_token}"


def exam_uid_from_link(link: str, *, fallback_year_tag: str | None = None) -> str | None:
    raw_link = str(link or "").strip().rstrip("/")
    if not raw_link:
        return None
    slug = raw_link.split("/")[-1]
    match = GATE_CSE_LINK_PATTERN.search(slug)
    if not match:
        return None
    year = match.group("year")
    set_no = match.group("set")
    year_tag_year, year_tag_set = _year_and_set_from_year_tag(str(fallback_year_tag or ""))
    if year_tag_year and year_tag_year == year and not set_no:
        set_no = year_tag_set
    question_token = normalize_exam_question_token(match.group("question"))
    if not question_token:
        return None
    section = "ga" if match.group("section") else "main"
    return _build_exam_uid(year=year, set_no=set_no or "1", section=section, question_token=question_token)


def exam_uid_from_title(title: str, *, fallback_year_tag: str | None = None) -> str | None:
    raw_title = str(title or "").strip()
    if not raw_title:
        return None

    year_match = GATE_CSE_TITLE_PATTERN.search(raw_title)
    year_tag_year, year_tag_set = _year_and_set_from_year_tag(str(fallback_year_tag or ""))
    if year_match:
        year = year_match.group("year")
        set_no = _normalize_set_no(year_match.group("set") or year_tag_set)
    elif year_tag_year:
        year = year_tag_year
        set_no = year_tag_set
    else:
        return None

    question_match = GATE_CSE_TITLE_QUESTION_PATTERN.search(raw_title)
    if not question_match:
        return None
    question_token = normalize_exam_question_token(question_match.group("question"))
    if not question_token:
        return None
    section = "ga" if question_match.group("section") else "main"
    return _build_exam_uid(year=year, set_no=set_no, section=section, question_token=question_token)


def exam_uid_from_question(question: dict[str, Any]) -> str | None:
    if not isinstance(question, dict):
        return None
    existing = str(question.get("exam_uid", "")).strip()
    if existing:
        return existing

    year_tag = str(question.get("year", "")).strip()
    from_link = exam_uid_from_link(str(question.get("link", "")), fallback_year_tag=year_tag)
    if from_link:
        return from_link

    return exam_uid_from_title(str(question.get("title", "")), fallback_year_tag=year_tag)
