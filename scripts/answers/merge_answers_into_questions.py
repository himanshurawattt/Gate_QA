from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any

if __package__ is None or __package__ == "":
    sys.path.append(str(Path(__file__).resolve().parents[2]))

from scripts.answers.common import exam_uid_from_question, ensure_dir, question_uid_from_record, read_json, write_json


def merge_answers_into_questions(
    questions_path: str | Path,
    answers_path: str | Path,
    answers_by_exam_uid_path: str | Path | None,
    out_path: str | Path,
) -> Path:
    questions: list[dict[str, Any]] = read_json(questions_path)
    answers_payload = read_json(answers_path)
    if "records_by_question_uid" in answers_payload:
        records_by_question_uid: dict[str, dict[str, Any]] = answers_payload.get("records_by_question_uid", {})
    else:
        # Backward compatibility: plain map payload.
        records_by_question_uid = answers_payload if isinstance(answers_payload, dict) else {}

    records_by_exam_uid: dict[str, dict[str, Any]] = {}
    if answers_by_exam_uid_path and Path(answers_by_exam_uid_path).exists():
        exam_payload = read_json(answers_by_exam_uid_path)
        if isinstance(exam_payload, dict) and "records_by_exam_uid" in exam_payload:
            table = exam_payload.get("records_by_exam_uid", {})
            if isinstance(table, dict):
                records_by_exam_uid = table
        elif isinstance(exam_payload, dict):
            records_by_exam_uid = exam_payload

    merged_count = 0
    merged_by_question_uid = 0
    merged_by_exam_uid = 0
    for question in questions:
        question_uid = str(question.get("question_uid", "")).strip()
        if not question_uid:
            question_uid = question_uid_from_record(question)
            question["question_uid"] = question_uid
        exam_uid = exam_uid_from_question(question) or ""
        if exam_uid:
            question["exam_uid"] = exam_uid

        record = records_by_question_uid.get(question_uid)
        source = "question_uid"
        if not record and exam_uid:
            record = records_by_exam_uid.get(exam_uid)
            source = "exam_uid"
        if not record:
            continue
        question["answer_uid"] = record.get("answer_uid")
        question["answer_meta"] = {
            "type": record.get("type"),
            "answer": record.get("answer"),
            "tolerance": record.get("tolerance"),
            "source": source,
        }
        merged_count += 1
        if source == "question_uid":
            merged_by_question_uid += 1
        else:
            merged_by_exam_uid += 1

    output_path = Path(out_path)
    ensure_dir(output_path.parent)
    write_json(output_path, questions)
    write_json(
        output_path.with_suffix(".summary.json"),
        {
            "question_count": len(questions),
            "merged_answer_count": merged_count,
            "merged_by_question_uid": merged_by_question_uid,
            "merged_by_exam_uid": merged_by_exam_uid,
            "answers_source": str(answers_path),
            "answers_by_exam_uid_source": str(answers_by_exam_uid_path) if answers_by_exam_uid_path else "",
        },
    )
    return output_path


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Merge answers into question JSON records.")
    parser.add_argument("--questions", required=True, help="Input question JSON file.")
    parser.add_argument("--answers", required=True, help="answers_by_question_uid_v1.json path.")
    parser.add_argument(
        "--answers-by-exam-uid",
        default="data/answers/answers_by_exam_uid_v1.json",
        help="answers_by_exam_uid_v1.json path.",
    )
    parser.add_argument(
        "--out",
        default="public/questions-with-answers.json",
        help="Output file path.",
    )
    return parser


def main() -> None:
    parser = build_arg_parser()
    args = parser.parse_args()
    out_path = merge_answers_into_questions(
        questions_path=args.questions,
        answers_path=args.answers,
        answers_by_exam_uid_path=args.answers_by_exam_uid,
        out_path=args.out,
    )
    print(f"Merged questions written to {out_path}")


if __name__ == "__main__":
    main()
