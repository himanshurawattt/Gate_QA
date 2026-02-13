from __future__ import annotations

import argparse
from pathlib import Path
import re
import sys
from typing import Any

if __package__ is None or __package__ == "":
    sys.path.append(str(Path(__file__).resolve().parents[2]))

from scripts.answers.common import ensure_dir, parse_id_str, read_json, uid_from, write_json

NUMERIC_PATTERN = re.compile(r"^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$")
NUMERIC_RANGE_PATTERN = re.compile(
    r"^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*:\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))$"
)
MCQ_PATTERN = re.compile(r"^[A-D]\.?$")
VALID_OPTIONS = {"A", "B", "C", "D"}
UNSUPPORTED_TOKENS = {"N/A", "NA", "TRUE", "FALSE", "X", "XX"}


def _normalize_token(token: str) -> str:
    normalized = re.sub(r"\s+", " ", token.strip().upper())
    normalized = normalized.strip(" .")
    return normalized


def _parse_msq_token(normalized: str) -> tuple[dict[str, Any] | None, str | None]:
    if ";" not in normalized and "," not in normalized and "/" not in normalized:
        return None, None

    candidate = normalized.replace(",", ";").replace("/", ";")
    candidate = re.sub(r"\s*;\s*", ";", candidate).strip(";")
    if not candidate:
        return None, "empty_answer_token"

    parts = [part for part in candidate.split(";") if part]
    if not parts:
        return None, "empty_answer_token"
    if any(not re.fullmatch(r"[A-Z]+", part) for part in parts):
        return None, "unsupported_separator_pattern"
    if any(part not in VALID_OPTIONS for part in parts):
        return None, "invalid_mcq_option"

    deduped: list[str] = []
    for part in parts:
        if part not in deduped:
            deduped.append(part)

    if len(deduped) == 1:
        return {"type": "MCQ", "answer": deduped[0]}, None
    return {"type": "MSQ", "answer": deduped}, None


def parse_answer_token(token: str) -> tuple[dict[str, Any] | None, str | None]:
    normalized = _normalize_token(token)
    if not normalized:
        return None, "empty_answer_token"

    if normalized in UNSUPPORTED_TOKENS:
        return None, "unsupported_literal"

    if MCQ_PATTERN.fullmatch(normalized):
        value = normalized.replace(".", "")
        return {"type": "MCQ", "answer": value}, None

    msq_result, msq_reason = _parse_msq_token(normalized)
    if msq_result or msq_reason:
        return msq_result, msq_reason

    if re.search(r"[A-Z]", normalized):
        if len(normalized) == 1 and normalized not in VALID_OPTIONS:
            return None, "invalid_mcq_option"
        return None, "letters_present_in_numeric_token"

    range_match = NUMERIC_RANGE_PATTERN.fullmatch(normalized)
    if range_match:
        left = float(range_match.group(1))
        right = float(range_match.group(2))
        if abs(left - right) > 1e-9:
            return None, "nat_range_mismatch"
        return {"type": "NAT", "answer": left}, None

    compact = normalized.replace(" ", "")
    if not NUMERIC_PATTERN.fullmatch(compact):
        return None, "not_a_valid_numeric_token"

    try:
        value = float(compact)
    except ValueError:
        return None, "nat_parse_failed"
    return {"type": "NAT", "answer": value}, None


def parse_normalized_row(
    row: dict[str, Any],
    source_meta: dict[str, Any],
    nat_tolerance_abs: float = 0.01,
) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    id_str = str(row.get("id_str", "")).strip()
    id_parts = parse_id_str(id_str)
    if not id_parts:
        return None, {
            "volume": source_meta.get("volume"),
            "page_no": source_meta.get("page_no"),
            "line_index": ",".join(str(index) for index in row.get("source_line_indexes", [])),
            "ocr_line": row.get("raw_text", ""),
            "reason": "invalid_id_format",
            "reason_code": "invalid_id_format",
        }

    parsed_token, reason = parse_answer_token(str(row.get("answer_raw", "")))
    if not parsed_token:
        return None, {
            "volume": source_meta.get("volume"),
            "page_no": source_meta.get("page_no"),
            "line_index": ",".join(str(index) for index in row.get("source_line_indexes", [])),
            "ocr_line": row.get("normalized_text", row.get("raw_text", "")),
            "reason": reason,
            "reason_code": reason,
            "candidate_uid": f"v{source_meta.get('volume')}:{id_str}" if id_str else "",
        }

    chapter_no, subject_code, question_no = id_parts
    volume = int(source_meta.get("volume"))
    uid = uid_from(volume=volume, id_str=id_str)

    id_url_pairs = source_meta.get("id_url_pairs", []) or []
    link_hint = None
    for pair in id_url_pairs:
        if pair.get("id_str") == id_str:
            link_hint = pair.get("question_url")
            break

    record: dict[str, Any] = {
        "uid": uid,
        "id_str": id_str,
        "volume": volume,
        "chapter_no": chapter_no,
        "subject_code": subject_code,
        "question_no": question_no,
        "type": parsed_token["type"],
        "answer": parsed_token["answer"],
        "source": {
            "pdf": f"volume{volume}",
            "page": int(source_meta.get("page_no")),
            "line_index": row.get("source_line_indexes", []),
        },
        "link_hint": link_hint,
    }
    if parsed_token["type"] == "NAT":
        record["tolerance"] = {"abs": nat_tolerance_abs}

    return record, None


def _records_equal(a: dict[str, Any], b: dict[str, Any]) -> bool:
    return (
        a.get("type") == b.get("type")
        and a.get("answer") == b.get("answer")
        and a.get("id_str") == b.get("id_str")
        and a.get("volume") == b.get("volume")
    )


def parse_normalized_dir(
    normalized_dir: str | Path,
    out_dir: str | Path,
    nat_tolerance_abs: float = 0.01,
) -> tuple[Path, Path]:
    in_root = Path(normalized_dir)
    out_root = ensure_dir(out_dir)

    parsed_records: list[dict[str, Any]] = []
    suspicious_lines: list[dict[str, Any]] = []
    seen_records: dict[str, dict[str, Any]] = {}

    page_files = sorted(path for path in in_root.glob("vol*_page_*.json"))
    for path in page_files:
        payload = read_json(path)
        meta = payload.get("meta", {})
        for suspicious in payload.get("suspicious", []):
            suspicious_lines.append(suspicious)

        for row in payload.get("rows", []):
            record, suspicious = parse_normalized_row(
                row=row,
                source_meta=meta,
                nat_tolerance_abs=nat_tolerance_abs,
            )
            if suspicious:
                suspicious_lines.append(suspicious)
                continue
            if not record:
                continue

            current = seen_records.get(record["uid"])
            if not current:
                seen_records[record["uid"]] = record
                parsed_records.append(record)
                continue

            if _records_equal(current, record):
                continue

            suspicious_lines.append(
                {
                    "volume": record["volume"],
                    "page_no": record["source"]["page"],
                    "line_index": ",".join(str(idx) for idx in record["source"]["line_index"]),
                    "ocr_line": row.get("normalized_text", row.get("raw_text", "")),
                    "reason": "duplicate_uid_conflict",
                    "reason_code": "duplicate_uid_conflict",
                    "candidate_uid": record["uid"],
                }
            )

    parsed_path = out_root / "parsed_records.json"
    suspicious_path = out_root / "suspicious_records.json"
    write_json(parsed_path, {"records": parsed_records})
    write_json(suspicious_path, {"suspicious": suspicious_lines})
    write_json(
        out_root / "summary.json",
        {
            "page_count": len(page_files),
            "record_count": len(parsed_records),
            "suspicious_count": len(suspicious_lines),
            "parse_rate": (
                (len(parsed_records) / (len(parsed_records) + len(suspicious_lines)))
                if (len(parsed_records) + len(suspicious_lines)) > 0
                else 0.0
            ),
        },
    )
    return parsed_path, suspicious_path


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Parse normalized answer-key rows into typed records.")
    parser.add_argument("--normalized-dir", required=True, help="Directory produced by normalize_ocr_text.py")
    parser.add_argument("--out", default="artifacts/parsed", help="Output directory.")
    parser.add_argument(
        "--nat-tolerance-abs",
        type=float,
        default=0.01,
        help="Absolute tolerance for NAT answers.",
    )
    return parser


def main() -> None:
    parser = build_arg_parser()
    args = parser.parse_args()
    parsed_path, suspicious_path = parse_normalized_dir(
        normalized_dir=args.normalized_dir,
        out_dir=args.out,
        nat_tolerance_abs=args.nat_tolerance_abs,
    )
    print(f"Parsed records: {parsed_path}")
    print(f"Suspicious rows: {suspicious_path}")


if __name__ == "__main__":
    main()
