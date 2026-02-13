from __future__ import annotations

import argparse
import concurrent.futures
import csv
import re
import sys
from dataclasses import dataclass
from html import unescape
from pathlib import Path
from typing import Any
from urllib.error import URLError
from urllib.request import Request, urlopen

if __package__ is None or __package__ == "":
    sys.path.append(str(Path(__file__).resolve().parents[2]))

from scripts.answers.common import ensure_dir, now_iso, read_json, write_csv, write_json

ALLOWED_OPTIONS = {"A", "B", "C", "D"}
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) GateQAAnswerBackfill/1.0"

ANSWER_WIDGET_PATTERN = re.compile(
    r"<span>\s*Answer:\s*</span>\s*<button[^>]*>(.*?)</button>",
    re.IGNORECASE | re.DOTALL,
)
HTML_TAG_PATTERN = re.compile(r"<[^>]+>")
WHITESPACE_PATTERN = re.compile(r"\s+")
SEPARATOR_PATTERN = re.compile(r"\s*(?:,|;|/|&|\band\b)\s*", re.IGNORECASE)
SELECTED_BLOCK_PATTERN = re.compile(
    r"qa-a-list-item-selected.*?qa-a-item-content[^>]*>(.*?)<div class=\"qa-post-when-container",
    re.IGNORECASE | re.DOTALL,
)
FALLBACK_PATTERNS = [
    re.compile(r"Correct\s*Answer\s*[:\-]?\s*([A-D](?:\s*[,;/]\s*[A-D])*)", re.IGNORECASE),
    re.compile(r"Correct\s*Option\s*[:\-]?\s*([A-D](?:\s*[,;/]\s*[A-D])*)", re.IGNORECASE),
    re.compile(r"(?:the\s+)?answer\s*(?:is|=|:)\s*\(?\s*([A-D])\s*\)?", re.IGNORECASE),
    re.compile(r"Option\s*\(?\s*([A-D])\s*\)?\s*(?:is\s*(?:correct|right|true)|\.)", re.IGNORECASE),
    re.compile(r"\b([A-D])\)\s*(?:all are valid|is correct|is the correct)", re.IGNORECASE),
    re.compile(r"Correct\s*Answer\s*[:\-]?\s*([-+]?\d+(?:\.\d+)?)", re.IGNORECASE),
    re.compile(r"(?:final\s+)?answer\s*(?:is|=|:)\s*([-+]?\d+(?:\.\d+)?)", re.IGNORECASE),
]


@dataclass
class ParseResult:
    answer_type: str
    answer: Any
    method: str
    raw_value: str
    tolerance_abs: float | None = None


def _strip_html(raw_html: str) -> str:
    no_tags = HTML_TAG_PATTERN.sub(" ", raw_html or "")
    text = unescape(no_tags)
    return WHITESPACE_PATTERN.sub(" ", text).strip()


def _normalize_token(raw_value: str) -> str:
    token = _strip_html(raw_value).upper().strip()
    token = token.replace("(", " ").replace(")", " ")
    token = token.replace("[", " ").replace("]", " ")
    token = token.replace("{", " ").replace("}", " ")
    token = token.replace("$", " ")
    token = WHITESPACE_PATTERN.sub(" ", token).strip()
    return token


def _parse_token(raw_value: str, method: str) -> ParseResult | None:
    token = _normalize_token(raw_value)
    if not token:
        return None

    range_match = re.fullmatch(
        r"([-+]?\d+(?:\.\d+)?)\s*:\s*([-+]?\d+(?:\.\d+)?)",
        token,
    )
    if range_match:
        lower = float(range_match.group(1))
        upper = float(range_match.group(2))
        if lower > upper:
            lower, upper = upper, lower
        center = (lower + upper) / 2.0
        tolerance = abs(upper - lower) / 2.0
        if tolerance < 1e-12:
            tolerance = 0.01
        return ParseResult(
            answer_type="NAT",
            answer=center,
            method=method,
            raw_value=token,
            tolerance_abs=tolerance,
        )

    parts = [part.strip() for part in SEPARATOR_PATTERN.split(token) if part.strip()]
    if len(parts) > 1 and all(part in ALLOWED_OPTIONS for part in parts):
        deduped: list[str] = []
        for part in parts:
            if part not in deduped:
                deduped.append(part)
        if len(deduped) >= 2:
            return ParseResult(
                answer_type="MSQ",
                answer=deduped,
                method=method,
                raw_value=token,
            )

    if token in ALLOWED_OPTIONS:
        return ParseResult(
            answer_type="MCQ",
            answer=token,
            method=method,
            raw_value=token,
        )

    numeric_match = re.fullmatch(r"[-+]?\d+(?:\.\d+)?", token)
    if numeric_match:
        return ParseResult(
            answer_type="NAT",
            answer=float(numeric_match.group(0)),
            method=method,
            raw_value=token,
            tolerance_abs=0.01,
        )

    return None


def _parse_from_widget(html: str) -> ParseResult | None:
    match = ANSWER_WIDGET_PATTERN.search(html)
    if not match:
        return None
    return _parse_token(match.group(1), method="gateoverflow_widget")


def _extract_selected_answer_text(html: str) -> str:
    match = SELECTED_BLOCK_PATTERN.search(html)
    if not match:
        return ""
    return _strip_html(match.group(1))


def _parse_from_selected_answer_text(html: str) -> ParseResult | None:
    answer_text = _extract_selected_answer_text(html)
    if not answer_text:
        return None

    for pattern in FALLBACK_PATTERNS:
        match = pattern.search(answer_text)
        if not match:
            continue
        parsed = _parse_token(match.group(1), method="selected_answer_text")
        if parsed:
            return parsed

    tail = answer_text[-200:]
    match = re.search(r"\bOption\s*\(?\s*([A-D])\s*\)?\b", tail, re.IGNORECASE)
    if match:
        parsed = _parse_token(match.group(1), method="selected_answer_tail_option")
        if parsed:
            return parsed

    return None


def _fetch_html(url: str, timeout_seconds: float) -> str:
    req = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(req, timeout=timeout_seconds) as response:
        content_type = response.headers.get_content_charset() or "utf-8"
        return response.read().decode(content_type, errors="replace")


def _is_type_compatible(expected_type: str, parsed_type: str) -> bool:
    normalized_expected = str(expected_type or "").strip().upper()
    if not normalized_expected:
        return True
    if normalized_expected == parsed_type:
        return True
    return False


def _load_records_by_question_uid(path: Path) -> dict[str, dict[str, Any]]:
    if not path.exists():
        return {}
    payload = read_json(path)
    if isinstance(payload, dict) and "records_by_question_uid" in payload:
        records = payload.get("records_by_question_uid", {})
        return records if isinstance(records, dict) else {}
    return payload if isinstance(payload, dict) else {}


def _load_manual_patch(path: Path) -> dict[str, dict[str, Any]]:
    if not path.exists():
        return {}
    payload = read_json(path)
    if isinstance(payload, dict) and "records_by_question_uid" in payload:
        records = payload.get("records_by_question_uid", {})
        return records if isinstance(records, dict) else {}
    return payload if isinstance(payload, dict) else {}


def _build_manual_patch_record(parsed: ParseResult, link: str) -> dict[str, Any]:
    record: dict[str, Any] = {
        "type": parsed.answer_type,
        "answer": parsed.answer,
        "note": f"auto_backfill:{parsed.method}:{link}",
    }
    if parsed.answer_type == "NAT":
        record["tolerance"] = {"abs": float(parsed.tolerance_abs or 0.01)}
    return record


def _build_answers_by_question_uid_record(
    question_uid: str,
    parsed: ParseResult,
    link: str,
) -> dict[str, Any]:
    tolerance = {"abs": float(parsed.tolerance_abs or 0.01)} if parsed.answer_type == "NAT" else None
    return {
        "answer_uid": f"auto:{question_uid}",
        "type": parsed.answer_type,
        "answer": parsed.answer,
        "tolerance": tolerance,
        "source": {
            "pdf": "gateoverflow_backfill",
            "page": 0,
            "line_index": [],
            "link": link,
            "method": parsed.method,
        },
    }


def _read_missing_rows(path: Path) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            rows.append({key: str(value or "") for key, value in row.items()})
    return rows


def backfill_gateoverflow_answers(args: argparse.Namespace) -> dict[str, Any]:
    missing_rows = _read_missing_rows(Path(args.missing_csv))
    answers_by_question_uid_path = Path(args.answers_by_question_uid)
    manual_patch_path = Path(args.manual_patch)

    answers_payload = read_json(answers_by_question_uid_path)
    existing_answers = _load_records_by_question_uid(answers_by_question_uid_path)
    manual_patch_records = _load_manual_patch(manual_patch_path)

    candidates: list[dict[str, str]] = []
    for row in missing_rows:
        question_uid = row.get("question_uid", "").strip()
        link = row.get("link", "").strip()
        if not question_uid.startswith("go:"):
            continue
        if not link.startswith("http"):
            continue
        candidates.append(row)

    report_rows: list[dict[str, Any]] = []
    applied_records: dict[str, dict[str, Any]] = {}

    def _process_row(row: dict[str, str]) -> tuple[str, str, ParseResult | None, str]:
        question_uid = row.get("question_uid", "").strip()
        link = row.get("link", "").strip()
        if question_uid in existing_answers:
            return question_uid, link, None, "already_in_answers_by_question_uid"
        if question_uid in manual_patch_records:
            return question_uid, link, None, "already_in_manual_patch"
        try:
            html = _fetch_html(link, timeout_seconds=float(args.timeout))
        except (URLError, TimeoutError, ValueError, OSError) as exc:
            return question_uid, link, None, f"fetch_error:{type(exc).__name__}"

        parsed = _parse_from_widget(html)
        if not parsed:
            if args.enable_fallback_parser:
                parsed = _parse_from_selected_answer_text(html)
            if not parsed:
                return question_uid, link, None, "no_parseable_answer"

        expected_type = row.get("type", "")
        if not _is_type_compatible(expected_type, parsed.answer_type):
            if bool(args.ignore_type_mismatch):
                return question_uid, link, parsed, "applied_with_type_override"
            return (
                question_uid,
                link,
                None,
                f"type_mismatch:expected={expected_type or 'unknown'}:parsed={parsed.answer_type}",
            )
        return question_uid, link, parsed, "applied"

    with concurrent.futures.ThreadPoolExecutor(max_workers=int(args.workers)) as executor:
        futures = [executor.submit(_process_row, row) for row in candidates]
        for future in concurrent.futures.as_completed(futures):
            question_uid, link, parsed, status = future.result()
            if parsed:
                patch_record = _build_manual_patch_record(parsed, link=link)
                manual_patch_records[question_uid] = patch_record
                applied_records[question_uid] = _build_answers_by_question_uid_record(
                    question_uid=question_uid,
                    parsed=parsed,
                    link=link,
                )
                report_rows.append(
                    {
                        "question_uid": question_uid,
                        "link": link,
                        "status": status,
                        "method": parsed.method,
                        "type": parsed.answer_type,
                        "answer": parsed.answer if parsed.answer_type != "MSQ" else ";".join(parsed.answer),
                        "raw_value": parsed.raw_value,
                    }
                )
            else:
                report_rows.append(
                    {
                        "question_uid": question_uid,
                        "link": link,
                        "status": status,
                        "method": "",
                        "type": "",
                        "answer": "",
                        "raw_value": "",
                    }
                )

    report_rows.sort(key=lambda item: (item["status"], item["question_uid"]))

    for question_uid, record in applied_records.items():
        existing_answers[question_uid] = record

    if isinstance(answers_payload, dict) and "records_by_question_uid" in answers_payload:
        answers_payload["records_by_question_uid"] = existing_answers
    elif isinstance(answers_payload, dict):
        answers_payload = {"records_by_question_uid": existing_answers}
    else:
        answers_payload = {"records_by_question_uid": existing_answers}

    stats = answers_payload.get("stats", {}) if isinstance(answers_payload.get("stats"), dict) else {}
    stats["records"] = len(existing_answers)
    stats["gateoverflow_backfill_applied"] = len(applied_records)
    answers_payload["stats"] = stats

    write_json(
        manual_patch_path,
        {
            "records_by_question_uid": manual_patch_records,
        },
    )
    write_json(answers_by_question_uid_path, answers_payload)

    report_csv_path = Path(args.report_csv)
    summary_json_path = Path(args.summary_json)
    write_csv(
        report_csv_path,
        report_rows,
        fieldnames=[
            "question_uid",
            "link",
            "status",
            "method",
            "type",
            "answer",
            "raw_value",
        ],
    )

    status_counts: dict[str, int] = {}
    for row in report_rows:
        status = row["status"]
        status_counts[status] = status_counts.get(status, 0) + 1

    summary = {
        "generated_at": now_iso(),
        "missing_csv": str(args.missing_csv),
        "answers_by_question_uid": str(answers_by_question_uid_path),
        "manual_patch": str(manual_patch_path),
        "report_csv": str(report_csv_path),
        "candidates": len(candidates),
        "applied": len(applied_records),
        "status_counts": status_counts,
        "fallback_parser_enabled": bool(args.enable_fallback_parser),
    }
    write_json(summary_json_path, summary)
    return summary


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Backfill missing answers from GateOverflow answer widgets into local answer maps."
    )
    parser.add_argument(
        "--missing-csv",
        default="artifacts/review/questions_missing_answers.csv",
        help="Input missing answers CSV generated by validate_answers.py",
    )
    parser.add_argument(
        "--answers-by-question-uid",
        default="data/answers/answers_by_question_uid_v1.json",
        help="answers_by_question_uid JSON path to update in-place.",
    )
    parser.add_argument(
        "--manual-patch",
        default="data/answers/manual_answers_patch_v1.json",
        help="Manual patch file to merge/update with auto-extracted rows.",
    )
    parser.add_argument(
        "--report-csv",
        default="artifacts/review/gateoverflow_backfill_report.csv",
        help="Per-question extraction report CSV output path.",
    )
    parser.add_argument(
        "--summary-json",
        default="artifacts/review/gateoverflow_backfill_summary.json",
        help="Summary JSON output path.",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=12,
        help="Concurrent fetch worker count.",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=20.0,
        help="HTTP timeout in seconds.",
    )
    parser.add_argument(
        "--enable-fallback-parser",
        action="store_true",
        help="Use strict selected-answer text fallback when answer widget is absent.",
    )
    parser.add_argument(
        "--ignore-type-mismatch",
        action="store_true",
        help="Apply parsed answers even when CSV type disagrees with parsed type.",
    )
    return parser


def main() -> None:
    parser = build_arg_parser()
    args = parser.parse_args()
    summary = backfill_gateoverflow_answers(args)
    print(f"Backfill summary: {summary}")


if __name__ == "__main__":
    main()
