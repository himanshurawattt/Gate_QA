from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path
from typing import Any

if __package__ is None or __package__ == "":
    sys.path.append(str(Path(__file__).resolve().parents[2]))

from scripts.answers.common import ensure_dir, normalize_ws, read_json, write_json

DEFAULT_PROFILE = {
    "id_delimiters": [".", ":", ","],
    "answer_separators": [";", ",", "/"],
    "lookahead_lines": 4,
    "max_answer_line_length": 96,
    "max_chapter_no": 20,
    "max_subject_code": 120,
    "max_question_no": 120,
}

ID_TRIPLE_PATTERN = re.compile(
    r"(?<![\d])(?P<a>[0-9OolI|]{1,3})\s*[.:,]\s*(?P<b>[0-9OolI|]{1,4})\s*[.:,]\s*(?P<c>[0-9OolI|]{1,4})(?![\d])"
)
HEADER_LIKE_PATTERN = re.compile(r"^[A-Z0-9\s]{8,}$")
ANSWERISH_PATTERN = re.compile(r"^[A-Za-z0-9;:.,/+=\-\s]+$")
NUMERIC_OR_RANGE_PATTERN = re.compile(
    r"^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?::[+-]?(?:\d+(?:\.\d*)?|\.\d+))?$"
)
MSQ_LOOSE_PATTERN = re.compile(r"^[A-D](?:[;,/][A-D])+$")
ANSWER_TOKEN_PATTERN = re.compile(
    r"N\s*/\s*A|NA|[A-D](?:\s*[;,/]\s*[A-D])+|[A-D]|[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:\s*:\s*[+-]?(?:\d+(?:\.\d*)?|\.\d+))?"
)


def _digit_only_normalize(text: str) -> str:
    translation = str.maketrans({"O": "0", "o": "0", "I": "1", "l": "1", "|": "1"})
    return text.translate(translation)


def _load_profile(profile_path: str | Path | None) -> dict[str, Any]:
    profile = dict(DEFAULT_PROFILE)
    if not profile_path:
        return profile
    path = Path(profile_path)
    if not path.exists():
        return profile
    payload = read_json(path)
    if isinstance(payload, dict):
        profile.update(payload)
    return profile


def _normalize_id_match(match: re.Match[str], cfg: dict[str, Any]) -> str | None:
    parts = [
        re.sub(r"\D", "", _digit_only_normalize(match.group("a"))),
        re.sub(r"\D", "", _digit_only_normalize(match.group("b"))),
        re.sub(r"\D", "", _digit_only_normalize(match.group("c"))),
    ]
    if any(not part for part in parts):
        return None

    chapter, subject, question = (int(parts[0]), int(parts[1]), int(parts[2]))
    if chapter <= 0 or subject <= 0 or question <= 0:
        return None
    if chapter > int(cfg.get("max_chapter_no", 20)):
        return None
    if subject > int(cfg.get("max_subject_code", 120)):
        return None
    if question > int(cfg.get("max_question_no", 120)):
        return None
    return f"{chapter}.{subject}.{question}"


def normalize_answer_candidate(answer_text: str, answer_separators: list[str]) -> str:
    cleaned = normalize_ws(answer_text)
    cleaned = cleaned.strip("._ ")
    cleaned = re.sub(r"^[\]\[(){}<>:=]+", "", cleaned)
    cleaned = re.sub(r"[\]\[(){}<>]+$", "", cleaned)
    if not cleaned:
        return ""

    upper = cleaned.upper()
    if re.search(r"\d", upper):
        upper = _digit_only_normalize(upper)
    compact = upper.replace(" ", "")
    if compact in {"N/A", "NA"}:
        return "N/A"

    upper = re.sub(r"(?<=\b[A-D])\.(?=[A-D]\b)", ";", upper)
    for sep in answer_separators:
        upper = upper.replace(sep, ";")
    upper = re.sub(r"\s*;\s*", ";", upper)
    upper = re.sub(r"\s*:\s*", ":", upper)
    upper = re.sub(r"\s+", " ", upper).strip()
    upper = upper.strip(" .")
    return upper


def looks_like_answer_line(raw_text: str, max_len: int) -> bool:
    text = raw_text.strip()
    if not text:
        return False
    if len(text) > max_len:
        return False
    if "=" in text:
        return False
    if not ANSWERISH_PATTERN.fullmatch(text):
        return False

    upper = normalize_ws(text).upper()
    compact = upper.replace(" ", "")
    if HEADER_LIKE_PATTERN.fullmatch(upper) and not ID_TRIPLE_PATTERN.search(upper):
        return False
    if "QUEST" in upper and not ID_TRIPLE_PATTERN.search(upper):
        return False

    if compact in {"A", "B", "C", "D", "N/A", "NA", "TRUE", "FALSE", "X"}:
        return True
    if MSQ_LOOSE_PATTERN.fullmatch(compact):
        return True
    if NUMERIC_OR_RANGE_PATTERN.fullmatch(compact):
        return True

    if re.search(r"[A-Z]{2,}", compact) and compact not in {"NA"}:
        return False
    token_count = len(upper.split(" "))
    if token_count > 6:
        return False
    return bool(re.search(r"[A-D0-9]", compact))


def _extract_id_segments(raw_text: str, cfg: dict[str, Any]) -> list[dict[str, Any]]:
    matches = list(ID_TRIPLE_PATTERN.finditer(raw_text))
    if not matches:
        return []

    segments: list[dict[str, Any]] = []
    for idx, match in enumerate(matches):
        id_str = _normalize_id_match(match, cfg)
        if not id_str:
            continue
        answer_start = match.end()
        answer_end = matches[idx + 1].start() if idx + 1 < len(matches) else len(raw_text)
        answer_slice = raw_text[answer_start:answer_end]
        segments.append(
            {
                "id_str": id_str,
                "answer_slice": answer_slice,
                "span": match.span(),
            }
        )
    return segments


def _split_answer_tokens_from_line(raw_text: str, answer_separators: list[str]) -> list[str]:
    upper = normalize_ws(raw_text).upper()
    if re.search(r"\d", upper):
        upper = _digit_only_normalize(upper)

    tokens: list[str] = []
    for match in ANSWER_TOKEN_PATTERN.finditer(upper):
        token = normalize_answer_candidate(match.group(0), answer_separators)
        if token:
            tokens.append(token)
    return tokens


def _make_suspicious(
    *,
    meta: dict[str, Any],
    line_indexes: list[int],
    ocr_line: str,
    reason_code: str,
    reason_detail: str = "",
    candidate_uid: str = "",
) -> dict[str, Any]:
    return {
        "volume": meta.get("volume"),
        "page_no": meta.get("page_no"),
        "line_index": ",".join(str(idx) for idx in line_indexes),
        "ocr_line": ocr_line,
        "reason": reason_code,
        "reason_code": reason_code,
        "reason_detail": reason_detail,
        "candidate_uid": candidate_uid,
    }


def _emit_row(
    *,
    rows: list[dict[str, Any]],
    meta: dict[str, Any],
    id_str: str,
    answer_token: str,
    source_line_indexes: list[int],
    source_text: list[str],
    confidence_values: list[float],
) -> None:
    row_confidence = 0.0
    if confidence_values:
        row_confidence = sum(confidence_values) / len(confidence_values)

    rows.append(
        {
            "row_index": len(rows),
            "source_line_indexes": source_line_indexes,
            "raw_text": " || ".join(source_text),
            "id_str": id_str,
            "answer_raw": answer_token,
            "normalized_text": f"{id_str} {answer_token}",
            "volume": meta.get("volume"),
            "page_no": meta.get("page_no"),
            "row_confidence": round(row_confidence, 4),
        }
    )


def _flush_expired_pending(
    *,
    pending: list[dict[str, Any]],
    current_line_index: int,
    meta: dict[str, Any],
    suspicious: list[dict[str, Any]],
) -> None:
    while pending and pending[0]["expires_at"] < current_line_index:
        item = pending.pop(0)
        suspicious.append(
            _make_suspicious(
                meta=meta,
                line_indexes=item["source_line_indexes"],
                ocr_line=" || ".join(item["source_text"]),
                reason_code="id_without_answer",
                reason_detail="id_str detected but no answer token found before lookahead window expiry",
                candidate_uid=item["id_str"],
            )
        )


def _assign_tokens_to_pending(
    *,
    pending: list[dict[str, Any]],
    tokens: list[str],
    line_index: int,
    raw_text: str,
    confidence: float,
    rows: list[dict[str, Any]],
    meta: dict[str, Any],
) -> int:
    assigned = 0
    while pending and assigned < len(tokens):
        item = pending.pop(0)
        token = tokens[assigned]
        source_line_indexes = list(item["source_line_indexes"]) + [line_index]
        source_text = list(item["source_text"]) + [raw_text]
        confidence_values = list(item["confidence_values"]) + [confidence]
        _emit_row(
            rows=rows,
            meta=meta,
            id_str=item["id_str"],
            answer_token=token,
            source_line_indexes=source_line_indexes,
            source_text=source_text,
            confidence_values=confidence_values,
        )
        assigned += 1
    return assigned


def normalize_ocr_lines(
    lines: list[dict[str, Any]],
    meta: dict[str, Any],
    profile: dict[str, Any] | None = None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    cfg = dict(DEFAULT_PROFILE)
    if profile:
        cfg.update(profile)

    lookahead = int(cfg.get("lookahead_lines", 4))
    answer_separators = [str(item) for item in cfg.get("answer_separators", [";", ",", "/"])]
    max_answer_len = int(cfg.get("max_answer_line_length", 96))

    rows: list[dict[str, Any]] = []
    suspicious: list[dict[str, Any]] = []
    pending: list[dict[str, Any]] = []

    for idx, entry in enumerate(lines):
        raw_text = str(entry.get("text", "")).strip()
        line_index = int(entry.get("line_index", idx))
        confidence = float(entry.get("confidence", 0.0) or 0.0)
        if not raw_text:
            continue

        _flush_expired_pending(
            pending=pending,
            current_line_index=idx,
            meta=meta,
            suspicious=suspicious,
        )

        id_segments = _extract_id_segments(raw_text, cfg)
        if id_segments:
            # Handle leading orphan answer tokens on the same line before first id.
            prefix = raw_text[: int(id_segments[0]["span"][0])].strip()
            if pending and prefix:
                prefix_tokens = _split_answer_tokens_from_line(prefix, answer_separators)
                assigned = _assign_tokens_to_pending(
                    pending=pending,
                    tokens=prefix_tokens,
                    line_index=line_index,
                    raw_text=raw_text,
                    confidence=confidence,
                    rows=rows,
                    meta=meta,
                )
                if prefix_tokens[assigned:]:
                    suspicious.append(
                        _make_suspicious(
                            meta=meta,
                            line_indexes=[line_index],
                            ocr_line=raw_text,
                            reason_code="orphan_answer_without_id",
                            reason_detail="extra answer tokens remained after assigning to pending ids",
                        )
                    )

            for segment in id_segments:
                id_str = str(segment["id_str"])
                answer_token = normalize_answer_candidate(str(segment["answer_slice"]), answer_separators)
                if answer_token:
                    _emit_row(
                        rows=rows,
                        meta=meta,
                        id_str=id_str,
                        answer_token=answer_token,
                        source_line_indexes=[line_index],
                        source_text=[raw_text],
                        confidence_values=[confidence],
                    )
                    continue

                pending.append(
                    {
                        "id_str": id_str,
                        "source_line_indexes": [line_index],
                        "source_text": [raw_text],
                        "confidence_values": [confidence],
                        "expires_at": idx + lookahead,
                    }
                )
            continue

        if looks_like_answer_line(raw_text, max_answer_len):
            tokens = _split_answer_tokens_from_line(raw_text, answer_separators)
            if pending and tokens:
                assigned = _assign_tokens_to_pending(
                    pending=pending,
                    tokens=tokens,
                    line_index=line_index,
                    raw_text=raw_text,
                    confidence=confidence,
                    rows=rows,
                    meta=meta,
                )
                if tokens[assigned:]:
                    suspicious.append(
                        _make_suspicious(
                            meta=meta,
                            line_indexes=[line_index],
                            ocr_line=raw_text,
                            reason_code="orphan_answer_without_id",
                            reason_detail="answer-like line had more tokens than pending ids",
                        )
                    )
            else:
                suspicious.append(
                    _make_suspicious(
                        meta=meta,
                        line_indexes=[line_index],
                        ocr_line=raw_text,
                        reason_code="orphan_answer_without_id",
                        reason_detail="answer-like line without detectable id_str",
                    )
                )

    _flush_expired_pending(
        pending=pending,
        current_line_index=len(lines) + lookahead + 1,
        meta=meta,
        suspicious=suspicious,
    )
    return rows, suspicious


def normalize_ocr_dir(
    ocr_dir: str | Path,
    out_dir: str | Path,
    profile_path: str | Path | None = None,
) -> Path:
    in_root = Path(ocr_dir)
    out_root = ensure_dir(out_dir)
    profile = _load_profile(profile_path)

    all_rows = 0
    all_suspicious = 0
    page_files = sorted(path for path in in_root.glob("vol*_page_*.json"))
    for path in page_files:
        payload = read_json(path)
        meta = payload.get("meta", {})
        lines = payload.get("lines", [])
        rows, suspicious = normalize_ocr_lines(lines=lines, meta=meta, profile=profile)
        all_rows += len(rows)
        all_suspicious += len(suspicious)
        out_file = out_root / path.name
        write_json(out_file, {"meta": meta, "rows": rows, "suspicious": suspicious})

    summary_path = out_root / "summary.json"
    write_json(
        summary_path,
        {
            "source_ocr_dir": str(ocr_dir),
            "profile_path": str(profile_path) if profile_path else "",
            "page_count": len(page_files),
            "row_count": all_rows,
            "suspicious_count": all_suspicious,
        },
    )
    return summary_path


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Normalize OCR output for answer-key parsing.")
    parser.add_argument("--ocr-dir", required=True, help="Directory containing raw OCR page JSON files.")
    parser.add_argument("--out", default="artifacts/normalized", help="Output directory.")
    parser.add_argument(
        "--profile",
        default="data/answers/ocr_profile_tesseract.json",
        help="Normalization profile JSON (Tesseract/Paddle tuning).",
    )
    return parser


def main() -> None:
    parser = build_arg_parser()
    args = parser.parse_args()
    summary_path = normalize_ocr_dir(
        ocr_dir=args.ocr_dir,
        out_dir=args.out,
        profile_path=args.profile,
    )
    print(f"Normalization summary written to {summary_path}")


if __name__ == "__main__":
    main()
