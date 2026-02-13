from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

if __package__ is None or __package__ == "":
    sys.path.append(str(Path(__file__).resolve().parents[2]))

from scripts.answers.common import (
    ensure_dir,
    exam_uid_from_question,
    now_iso,
    question_uid_from_record,
    read_json,
    write_csv,
    write_json,
)

ALLOWED_OPTIONS = {"A", "B", "C", "D"}


def _normalize_answer_record(raw: dict[str, Any]) -> tuple[dict[str, Any] | None, str]:
    answer_type = str(raw.get("type", "")).strip().upper()
    if answer_type not in {"MCQ", "MSQ", "NAT"}:
        return None, "invalid_type"

    if answer_type == "MCQ":
        answer = str(raw.get("answer", "")).strip().upper()
        if answer not in ALLOWED_OPTIONS:
            return None, "invalid_mcq_answer"
        return {"type": "MCQ", "answer": answer, "tolerance": None}, ""

    if answer_type == "MSQ":
        raw_answer = raw.get("answer", raw.get("answers", []))
        if isinstance(raw_answer, str):
            tokens = [token.strip().upper() for token in raw_answer.replace(",", ";").split(";")]
        elif isinstance(raw_answer, list):
            tokens = [str(token).strip().upper() for token in raw_answer]
        else:
            return None, "invalid_msq_answer"

        normalized: list[str] = []
        for token in tokens:
            if token not in ALLOWED_OPTIONS:
                return None, "invalid_msq_answer"
            if token not in normalized:
                normalized.append(token)
        if len(normalized) < 2:
            return None, "invalid_msq_answer"
        return {"type": "MSQ", "answer": normalized, "tolerance": None}, ""

    value = raw.get("answer", raw.get("value"))
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return None, "invalid_nat_answer"

    tolerance = raw.get("tolerance", {"abs": 0.01})
    abs_tol = 0.01
    if isinstance(tolerance, dict):
        try:
            abs_tol = float(tolerance.get("abs", 0.01))
        except (TypeError, ValueError):
            abs_tol = 0.01
    return {"type": "NAT", "answer": numeric, "tolerance": {"abs": abs_tol}}, ""


def _record_signature(record: dict[str, Any]) -> str:
    return json.dumps(
        {
            "type": record.get("type"),
            "answer": record.get("answer"),
            "tolerance": record.get("tolerance"),
        },
        sort_keys=True,
    )


def _load_records_by_question_uid(path: str | Path) -> dict[str, dict[str, Any]]:
    payload = read_json(path)
    if isinstance(payload, dict) and "records_by_question_uid" in payload:
        table = payload.get("records_by_question_uid", {})
        return table if isinstance(table, dict) else {}
    return payload if isinstance(payload, dict) else {}


def _load_manual_exam_patch(path: str | Path) -> tuple[dict[str, dict[str, Any]], list[dict[str, str]]]:
    patch_path = Path(path)
    if not patch_path.exists():
        return {}, []

    payload = read_json(patch_path)
    if isinstance(payload, dict) and "records_by_exam_uid" in payload:
        raw_records = payload.get("records_by_exam_uid", {})
    elif isinstance(payload, dict):
        raw_records = payload
    else:
        raw_records = {}

    normalized: dict[str, dict[str, Any]] = {}
    invalid: list[dict[str, str]] = []
    for exam_uid, raw in raw_records.items():
        uid = str(exam_uid).strip()
        if not uid or not isinstance(raw, dict):
            invalid.append({"exam_uid": uid, "reason": "invalid_patch_record"})
            continue
        normalized_record, reason = _normalize_answer_record(raw)
        if not normalized_record:
            invalid.append({"exam_uid": uid, "reason": reason or "invalid_patch_record"})
            continue
        normalized[uid] = {
            "answer_uid": str(raw.get("answer_uid", f"exam:{uid}")),
            "type": normalized_record["type"],
            "answer": normalized_record["answer"],
            "tolerance": normalized_record["tolerance"],
            "source": {
                "kind": "manual_exam_patch",
                "note": str(raw.get("note", "")).strip(),
            },
        }
    return normalized, invalid


def build_answers_by_exam_uid(
    questions_path: str | Path,
    answers_by_question_uid_path: str | Path,
    manual_exam_patch_path: str | Path,
    out_path: str | Path,
    conflicts_csv_path: str | Path,
    missing_csv_path: str | Path,
) -> tuple[Path, dict[str, Any]]:
    questions = read_json(questions_path)
    if not isinstance(questions, list):
        questions = []
    answers_by_question_uid = _load_records_by_question_uid(answers_by_question_uid_path)

    records_by_exam_uid: dict[str, dict[str, Any]] = {}
    conflicts: list[dict[str, Any]] = []
    missing_rows: list[dict[str, Any]] = []
    source_question_uid_records = 0
    questions_with_exam_uid = 0
    questions_without_exam_uid = 0

    for question in questions:
        question_uid = str(question.get("question_uid", "")).strip()
        if not question_uid:
            question_uid = question_uid_from_record(question)
        exam_uid = exam_uid_from_question(question)
        if not exam_uid:
            questions_without_exam_uid += 1
            continue
        questions_with_exam_uid += 1

        answer_record = answers_by_question_uid.get(question_uid)
        if not answer_record:
            missing_rows.append(
                {
                    "question_uid": question_uid,
                    "exam_uid": exam_uid,
                    "title": str(question.get("title", "")),
                    "link": str(question.get("link", "")),
                    "year": str(question.get("year", "")),
                    "tags": ";".join(str(tag) for tag in question.get("tags", []) if tag),
                    "reason": "no_question_uid_answer_record",
                }
            )
            continue

        source_question_uid_records += 1
        candidate = {
            "answer_uid": str(answer_record.get("answer_uid", f"exam:{exam_uid}")),
            "type": answer_record.get("type"),
            "answer": answer_record.get("answer"),
            "tolerance": answer_record.get("tolerance"),
            "source": {
                "kind": "question_uid",
                "question_uids": [question_uid],
            },
        }
        existing = records_by_exam_uid.get(exam_uid)
        if not existing:
            records_by_exam_uid[exam_uid] = candidate
            continue

        if _record_signature(existing) == _record_signature(candidate):
            source = existing.get("source") if isinstance(existing.get("source"), dict) else {}
            question_uids = source.get("question_uids", [])
            if isinstance(question_uids, list) and question_uid not in question_uids:
                question_uids.append(question_uid)
                source["question_uids"] = question_uids
                existing["source"] = source
            continue

        conflicts.append(
            {
                "exam_uid": exam_uid,
                "existing_answer_uid": str(existing.get("answer_uid", "")),
                "conflicting_answer_uid": str(candidate.get("answer_uid", "")),
                "existing_signature": _record_signature(existing),
                "conflicting_signature": _record_signature(candidate),
                "question_uid": question_uid,
                "reason": "exam_uid_multiple_answers",
            }
        )

    manual_patch_records, manual_patch_invalid = _load_manual_exam_patch(manual_exam_patch_path)
    manual_patch_applied = 0
    for exam_uid, record in manual_patch_records.items():
        records_by_exam_uid[exam_uid] = record
        manual_patch_applied += 1

    payload = {
        "version": "v1",
        "generated_at": now_iso(),
        "stats": {
            "questions_scanned": len(questions),
            "questions_with_exam_uid": questions_with_exam_uid,
            "questions_without_exam_uid": questions_without_exam_uid,
            "source_question_uid_records": source_question_uid_records,
            "records": len(records_by_exam_uid),
            "conflicts": len(conflicts),
            "manual_patch_applied": manual_patch_applied,
            "manual_patch_invalid": len(manual_patch_invalid),
            "missing_exam_uid_answers": len(missing_rows),
        },
        "records_by_exam_uid": records_by_exam_uid,
    }

    out = Path(out_path)
    ensure_dir(out.parent)
    write_json(out, payload)

    conflicts_out = Path(conflicts_csv_path)
    ensure_dir(conflicts_out.parent)
    write_csv(
        conflicts_out,
        conflicts,
        fieldnames=[
            "exam_uid",
            "existing_answer_uid",
            "conflicting_answer_uid",
            "question_uid",
            "reason",
            "existing_signature",
            "conflicting_signature",
        ],
    )

    missing_out = Path(missing_csv_path)
    ensure_dir(missing_out.parent)
    write_csv(
        missing_out,
        missing_rows,
        fieldnames=[
            "question_uid",
            "exam_uid",
            "title",
            "link",
            "year",
            "tags",
            "reason",
        ],
    )

    summary = {
        "output_path": str(out),
        "conflicts_csv_path": str(conflicts_out),
        "missing_csv_path": str(missing_out),
        "manual_patch_invalid": manual_patch_invalid,
        "stats": payload["stats"],
    }
    return out, summary


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Build exam_uid-indexed answers table.")
    parser.add_argument("--questions", required=True, help="Path to questions JSON.")
    parser.add_argument("--answers-by-question-uid", required=True, help="Path to answers_by_question_uid_v1.json.")
    parser.add_argument(
        "--manual-exam-patch",
        default="data/answers/manual_exam_answers_patch_v1.json",
        help="Manual patch keyed by exam_uid.",
    )
    parser.add_argument(
        "--out",
        default="data/answers/answers_by_exam_uid_v1.json",
        help="Output path for answers_by_exam_uid payload.",
    )
    parser.add_argument(
        "--conflicts-out",
        default="artifacts/review/exam_uid_mapping_conflicts.csv",
        help="CSV output path for exam_uid conflicts.",
    )
    parser.add_argument(
        "--missing-out",
        default="artifacts/review/questions_missing_exam_uid_answers.csv",
        help="CSV output path for questions with exam_uid but no question_uid answer record.",
    )
    return parser


def main() -> None:
    parser = build_arg_parser()
    args = parser.parse_args()
    out_path, summary = build_answers_by_exam_uid(
        questions_path=args.questions,
        answers_by_question_uid_path=args.answers_by_question_uid,
        manual_exam_patch_path=args.manual_exam_patch,
        out_path=args.out,
        conflicts_csv_path=args.conflicts_out,
        missing_csv_path=args.missing_out,
    )
    print(f"Exam UID answers written to {out_path}")
    print(f"Stats: {summary.get('stats', {})}")
    print(f"Conflicts CSV: {summary.get('conflicts_csv_path')}")
    print(f"Missing CSV: {summary.get('missing_csv_path')}")


if __name__ == "__main__":
    main()
