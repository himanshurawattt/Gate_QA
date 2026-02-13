from __future__ import annotations

import argparse
import csv
from pathlib import Path

from scripts.answers.common import now_iso, write_json


def build_unsupported_questions(
    missing_csv_path: str | Path,
    out_path: str | Path,
) -> Path:
    rows: list[dict[str, str]] = []
    with Path(missing_csv_path).open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            rows.append({key: str(value or "") for key, value in row.items()})

    records_by_question_uid: dict[str, dict[str, str]] = {}
    for row in rows:
        question_uid = row.get("question_uid", "").strip()
        if not question_uid:
            continue
        records_by_question_uid[question_uid] = {
            "link": row.get("link", "").strip(),
            "reason": row.get("reason", "").strip(),
            "exam_uid": row.get("exam_uid", "").strip(),
            "type": row.get("type", "").strip(),
        }

    payload = {
        "version": "v1",
        "generated_at": now_iso(),
        "stats": {
            "records": len(records_by_question_uid),
            "source_missing_rows": len(rows),
        },
        "question_uids": sorted(records_by_question_uid.keys()),
        "records_by_question_uid": records_by_question_uid,
    }

    out = Path(out_path)
    write_json(out, payload)
    return out


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Build unsupported question UID list from current missing answers CSV."
    )
    parser.add_argument(
        "--missing-csv",
        default="artifacts/review/questions_missing_answers.csv",
        help="Missing answers CSV from validate_answers.",
    )
    parser.add_argument(
        "--out",
        default="data/answers/unsupported_question_uids_v1.json",
        help="Output unsupported UID JSON path.",
    )
    return parser


def main() -> None:
    parser = build_arg_parser()
    args = parser.parse_args()
    out_path = build_unsupported_questions(
        missing_csv_path=args.missing_csv,
        out_path=args.out,
    )
    print(f"Unsupported question list written to {out_path}")


if __name__ == "__main__":
    main()
