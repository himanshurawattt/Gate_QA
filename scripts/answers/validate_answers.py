from __future__ import annotations

import argparse
from pathlib import Path
import sys
from typing import Any

import jsonschema

if __package__ is None or __package__ == "":
    sys.path.append(str(Path(__file__).resolve().parents[2]))

from scripts.answers.common import (
    exam_uid_from_question,
    ensure_dir,
    parse_id_str,
    question_uid_from_record,
    read_json,
    uid_from,
    write_csv,
    write_json,
)

QUESTIONS_MISSING_SCOPE_MAPPED = "mapped_universe"
QUESTIONS_MISSING_SCOPE_FULL = "full_dataset"
QUESTIONS_MISSING_SCOPES = {
    QUESTIONS_MISSING_SCOPE_MAPPED,
    QUESTIONS_MISSING_SCOPE_FULL,
}


def _normalize_questions_missing_scope(scope_raw: str | None) -> str:
    scope = str(scope_raw or QUESTIONS_MISSING_SCOPE_MAPPED).strip().lower()
    if scope == "all":
        return QUESTIONS_MISSING_SCOPE_FULL
    return scope


def _count_by_volume_subject(records_by_uid: dict[str, dict[str, Any]]) -> dict[str, dict[str, int]]:
    counts: dict[str, dict[str, int]] = {"v1": {}, "v2": {}}
    for record in records_by_uid.values():
        volume_key = f"v{record.get('volume')}"
        subject_key = str(record.get("subject_code"))
        counts.setdefault(volume_key, {})
        counts[volume_key][subject_key] = counts[volume_key].get(subject_key, 0) + 1
    return counts


def _validate_schema(payload: dict[str, Any], schema: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    validator = jsonschema.Draft202012Validator(schema)
    for issue in validator.iter_errors(payload):
        path = ".".join(str(part) for part in issue.absolute_path)
        errors.append(f"schema_error at {path or '<root>'}: {issue.message}")
    return errors


def _validate_record_integrity(records_by_uid: dict[str, dict[str, Any]]) -> list[str]:
    errors: list[str] = []
    for uid, record in records_by_uid.items():
        record_uid = str(record.get("uid", ""))
        if uid != record_uid:
            errors.append(f"uid_key_mismatch for key={uid}: record.uid={record_uid}")

        id_str = str(record.get("id_str", ""))
        parts = parse_id_str(id_str)
        if not parts:
            errors.append(f"invalid_id_str_in_record uid={uid} id_str={id_str}")
            continue
        chapter_no, subject_code, question_no = parts
        if int(record.get("chapter_no", -1)) != chapter_no:
            errors.append(f"chapter_mismatch uid={uid}")
        if int(record.get("subject_code", -1)) != subject_code:
            errors.append(f"subject_code_mismatch uid={uid}")
        if int(record.get("question_no", -1)) != question_no:
            errors.append(f"question_no_mismatch uid={uid}")
    return errors


def _validate_thresholds(payload: dict[str, Any], config: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    stats = payload.get("stats", {})
    parsed_records = int(stats.get("parsed_records", 0))
    total_rows_seen = int(stats.get("total_rows_seen", 0))
    suspicious_lines = int(stats.get("suspicious_lines", 0))
    parse_rate = float(stats.get("parse_rate", 0.0))

    min_records_required = int(config.get("min_records_required", 1))
    max_suspicious_lines = int(config.get("max_suspicious_lines", 10000))
    max_suspicious_ratio = float(config.get("max_suspicious_ratio", 1.0))
    min_parse_rate = float(config.get("min_parse_rate", 0.0))

    if parsed_records < min_records_required:
        errors.append(
            f"parsed_records below minimum: parsed={parsed_records}, required={min_records_required}"
        )

    if suspicious_lines > max_suspicious_lines:
        errors.append(
            f"suspicious_lines exceeded: suspicious={suspicious_lines}, max={max_suspicious_lines}"
        )

    if total_rows_seen > 0:
        suspicious_ratio = suspicious_lines / total_rows_seen
        if suspicious_ratio > max_suspicious_ratio:
            errors.append(
                f"suspicious ratio exceeded: ratio={suspicious_ratio:.4f}, max={max_suspicious_ratio:.4f}"
            )
    if parse_rate < min_parse_rate:
        errors.append(f"parse_rate below minimum: parse_rate={parse_rate:.4f}, min={min_parse_rate:.4f}")
    return errors


def _validate_mapping(
    mapping_report: dict[str, Any] | None,
    config: dict[str, Any],
) -> tuple[list[str], dict[str, Any]]:
    if not mapping_report:
        return [], {"status": "skipped", "reason": "mapping_report_not_provided"}

    stats = mapping_report.get("stats", {})
    resolved = int(stats.get("resolved", 0))
    unresolved = int(stats.get("unresolved", 0))
    unresolved_in_dataset = int(stats.get("unresolved_in_dataset", unresolved))
    conflicts = int(stats.get("mapping_conflicts", 0))
    coverage_ratio = float(stats.get("coverage_ratio", 0.0))
    coverage_ratio_in_dataset = float(stats.get("coverage_ratio_in_dataset", coverage_ratio))

    min_mapping_coverage_ratio = float(config.get("min_mapping_coverage_ratio", 0.0))
    max_mapping_conflicts = int(config.get("max_mapping_conflicts", 1000000))
    max_unresolved_mappings = int(config.get("max_unresolved_mappings", 1000000))

    errors: list[str] = []
    if coverage_ratio_in_dataset < min_mapping_coverage_ratio:
        errors.append(
            "mapping coverage below threshold: "
            f"coverage_ratio_in_dataset={coverage_ratio_in_dataset:.4f}, min={min_mapping_coverage_ratio:.4f}"
        )
    if conflicts > max_mapping_conflicts:
        errors.append(
            f"mapping conflicts exceeded: conflicts={conflicts}, max={max_mapping_conflicts}"
        )
    if unresolved_in_dataset > max_unresolved_mappings:
        errors.append(
            f"unresolved mappings exceeded: unresolved_in_dataset={unresolved_in_dataset}, max={max_unresolved_mappings}"
        )

    report = {
        "status": "checked",
        "stats": {
            "resolved": resolved,
            "unresolved": unresolved,
            "unresolved_in_dataset": unresolved_in_dataset,
            "conflicts": conflicts,
            "coverage_ratio": coverage_ratio,
            "coverage_ratio_in_dataset": coverage_ratio_in_dataset,
        },
        "thresholds": {
            "min_mapping_coverage_ratio": min_mapping_coverage_ratio,
            "max_mapping_conflicts": max_mapping_conflicts,
            "max_unresolved_mappings": max_unresolved_mappings,
        },
    }
    return errors, report


def _validate_coverage(
    records_by_uid: dict[str, dict[str, Any]],
    coverage_baseline: dict[str, Any],
    config: dict[str, Any],
) -> tuple[list[str], dict[str, Any]]:
    errors: list[str] = []
    max_mismatch_ratio = float(config.get("max_coverage_mismatch_ratio", 0.10))
    actual_counts = _count_by_volume_subject(records_by_uid)
    report_rows: list[dict[str, Any]] = []

    for volume_key, subject_counts in coverage_baseline.items():
        if not isinstance(subject_counts, dict):
            continue
        for subject_code, expected_raw in subject_counts.items():
            expected = int(expected_raw)
            if expected <= 0:
                continue
            actual = int(actual_counts.get(volume_key, {}).get(str(subject_code), 0))
            diff = actual - expected
            mismatch_ratio = abs(diff) / expected
            row = {
                "volume": volume_key,
                "subject_code": str(subject_code),
                "expected": expected,
                "actual": actual,
                "diff": diff,
                "mismatch_ratio": mismatch_ratio,
                "status": "ok" if mismatch_ratio <= max_mismatch_ratio else "fail",
            }
            report_rows.append(row)
            if mismatch_ratio > max_mismatch_ratio:
                errors.append(
                    "coverage mismatch for "
                    f"{volume_key}.{subject_code}: expected={expected}, actual={actual}, "
                    f"ratio={mismatch_ratio:.4f}, max={max_mismatch_ratio:.4f}"
                )

    report = {
        "max_coverage_mismatch_ratio": max_mismatch_ratio,
        "rows": sorted(report_rows, key=lambda item: (item["volume"], item["subject_code"])),
    }
    return errors, report


def _infer_question_type(tags: list[str]) -> str:
    lower = {tag.lower() for tag in tags}
    if "multiple-selects" in lower:
        return "MSQ"
    if "numerical-answers" in lower or "fill-in-the-blanks" in lower:
        return "NAT"
    if "descriptive" in lower:
        return "DESCRIPTIVE"
    return "MCQ"


def _expected_uids_from_mapping(mapping_report: dict[str, Any] | None) -> set[str]:
    expected: set[str] = set()
    if not mapping_report:
        return expected

    for row in mapping_report.get("resolved", []):
        question_uid = str(row.get("question_uid", "")).strip()
        if question_uid:
            expected.add(question_uid)
    for row in mapping_report.get("conflicts", []):
        question_uid = str(row.get("question_uid", "")).strip()
        if question_uid:
            expected.add(question_uid)
    for row in mapping_report.get("unresolved", []):
        candidates = str(row.get("question_uid_candidates", "")).strip()
        if not candidates:
            continue
        for question_uid in candidates.split(";"):
            candidate = question_uid.strip()
            if candidate:
                expected.add(candidate)
    return expected


def _build_questions_missing_answers_rows(
    *,
    questions: list[dict[str, Any]],
    answers_by_question_uid: dict[str, Any],
    answers_by_exam_uid: dict[str, Any],
    records_by_uid: dict[str, Any],
    mapping_report: dict[str, Any] | None,
    scope: str,
    exclude_descriptive: bool,
    unsupported_question_uids: set[str] | None = None,
) -> list[dict[str, Any]]:
    expected_uids = _expected_uids_from_mapping(mapping_report)
    if not expected_uids and scope == QUESTIONS_MISSING_SCOPE_MAPPED:
        expected_uids = set(answers_by_question_uid.keys())
    unsupported = unsupported_question_uids or set()

    rows: list[dict[str, Any]] = []
    for question in questions:
        question_uid = str(question.get("question_uid", "")).strip()
        if not question_uid:
            question_uid = question_uid_from_record(question)
        exam_uid = exam_uid_from_question(question) or ""
        if question_uid in unsupported:
            continue

        tags = [str(tag) for tag in question.get("tags", [])]
        question_type = _infer_question_type(tags)
        if exclude_descriptive and question_type == "DESCRIPTIVE":
            continue
        if scope == QUESTIONS_MISSING_SCOPE_MAPPED and question_uid not in expected_uids:
            continue

        if question_uid in answers_by_question_uid:
            continue
        if exam_uid and exam_uid in answers_by_exam_uid:
            continue

        volume = question.get("volume")
        id_str = str(question.get("id_str", "")).strip()
        answer_uid_hint = ""
        if volume is not None and id_str:
            try:
                answer_uid_hint = uid_from(int(volume), id_str)
            except (TypeError, ValueError):
                answer_uid_hint = ""

        if answer_uid_hint and answer_uid_hint in records_by_uid:
            reason = "answer_exists_but_unmapped"
        elif exam_uid and exam_uid not in answers_by_exam_uid:
            reason = "no_exam_answer_record"
        elif not exam_uid:
            reason = "exam_uid_missing"
        elif not id_str or volume is None:
            reason = "id_str_missing"
        else:
            reason = "no_answer_record"

        rows.append(
            {
                "question_uid": question_uid,
                "exam_uid": exam_uid,
                "link": question.get("link", ""),
                "type": question_type,
                "year": question.get("year", ""),
                "tags": ";".join(tags),
                "reason": reason,
                "volume": volume if volume is not None else "",
                "id_str": id_str,
                "answer_uid_hint": answer_uid_hint,
            }
        )
    rows.sort(key=lambda row: (row["reason"], row["year"], row["question_uid"]))
    return rows


def validate_answers(
    answers_json_path: str | Path,
    schema_path: str | Path,
    coverage_path: str | Path,
    config_path: str | Path,
    coverage_report_path: str | Path,
    validation_report_path: str | Path,
    parsed_summary_path: str | Path | None = None,
    mapping_report_path: str | Path | None = None,
    questions_path: str | Path | None = None,
    answers_by_question_uid_path: str | Path | None = None,
    answers_by_exam_uid_path: str | Path | None = None,
    questions_missing_report_path: str | Path | None = None,
    questions_missing_scope: str | None = None,
    questions_missing_report_full_dataset_path: str | Path | None = None,
    questions_missing_report_mapped_universe_path: str | Path | None = None,
    questions_missing_report_diff_path: str | Path | None = None,
    unsupported_questions_path: str | Path | None = None,
) -> tuple[bool, list[str]]:
    answers_payload = read_json(answers_json_path)
    schema = read_json(schema_path)
    coverage_baseline = read_json(coverage_path)
    config = read_json(config_path)
    records_by_uid = answers_payload.get("records_by_uid", {})
    mapping_report = read_json(mapping_report_path) if mapping_report_path and Path(mapping_report_path).exists() else None
    parsed_summary = read_json(parsed_summary_path) if parsed_summary_path and Path(parsed_summary_path).exists() else {}

    errors: list[str] = []
    errors.extend(_validate_schema(payload=answers_payload, schema=schema))
    errors.extend(_validate_record_integrity(records_by_uid=records_by_uid))
    errors.extend(_validate_thresholds(payload=answers_payload, config=config))

    if parsed_summary:
        parse_rate_from_summary = float(parsed_summary.get("parse_rate", 0.0))
        min_parse_rate = float(config.get("min_parse_rate", 0.0))
        if parse_rate_from_summary < min_parse_rate:
            errors.append(
                "parsed_summary parse_rate below minimum: "
                f"parse_rate={parse_rate_from_summary:.4f}, min={min_parse_rate:.4f}"
            )

    mapping_errors, mapping_validation_report = _validate_mapping(
        mapping_report=mapping_report,
        config=config,
    )
    errors.extend(mapping_errors)

    coverage_errors, coverage_report = _validate_coverage(
        records_by_uid=records_by_uid,
        coverage_baseline=coverage_baseline,
        config=config,
    )
    errors.extend(coverage_errors)

    missing_scope_raw = (
        questions_missing_scope
        if questions_missing_scope is not None
        else config.get("questions_missing_scope", QUESTIONS_MISSING_SCOPE_MAPPED)
    )
    effective_missing_scope = _normalize_questions_missing_scope(missing_scope_raw)
    if effective_missing_scope not in QUESTIONS_MISSING_SCOPES:
        errors.append(
            "invalid questions_missing_scope: "
            f"{effective_missing_scope!r}; allowed={sorted(QUESTIONS_MISSING_SCOPES)}"
        )
        effective_missing_scope = QUESTIONS_MISSING_SCOPE_MAPPED

    missing_rows: list[dict[str, Any]] = []
    missing_rows_by_scope: dict[str, list[dict[str, Any]]] = {
        QUESTIONS_MISSING_SCOPE_MAPPED: [],
        QUESTIONS_MISSING_SCOPE_FULL: [],
    }
    missing_rows_diff: list[dict[str, Any]] = []
    missing_csv_fieldnames = [
        "question_uid",
        "exam_uid",
        "link",
        "type",
        "year",
        "tags",
        "reason",
        "volume",
        "id_str",
        "answer_uid_hint",
    ]
    unsupported_question_uids: set[str] = set()
    if unsupported_questions_path and Path(unsupported_questions_path).exists():
        unsupported_payload = read_json(unsupported_questions_path)
        if isinstance(unsupported_payload, dict):
            uid_list = unsupported_payload.get("question_uids", [])
            if isinstance(uid_list, list):
                unsupported_question_uids = {
                    str(uid).strip() for uid in uid_list if str(uid).strip()
                }
    if questions_path and answers_by_question_uid_path:
        questions = read_json(questions_path)
        by_question_uid_payload = read_json(answers_by_question_uid_path)
        answers_by_question_uid = by_question_uid_payload.get("records_by_question_uid", {})
        answers_by_exam_uid: dict[str, Any] = {}
        if answers_by_exam_uid_path and Path(answers_by_exam_uid_path).exists():
            by_exam_uid_payload = read_json(answers_by_exam_uid_path)
            table = by_exam_uid_payload.get("records_by_exam_uid", {})
            if isinstance(table, dict):
                answers_by_exam_uid = table
        questions_list = questions if isinstance(questions, list) else []
        answers_by_uid_dict = answers_by_question_uid if isinstance(answers_by_question_uid, dict) else {}
        answers_by_exam_uid_dict = answers_by_exam_uid if isinstance(answers_by_exam_uid, dict) else {}
        records_by_uid_dict = records_by_uid if isinstance(records_by_uid, dict) else {}
        exclude_descriptive = bool(config.get("questions_missing_exclude_descriptive", False))

        for scope in (QUESTIONS_MISSING_SCOPE_MAPPED, QUESTIONS_MISSING_SCOPE_FULL):
            missing_rows_by_scope[scope] = _build_questions_missing_answers_rows(
                questions=questions_list,
                answers_by_question_uid=answers_by_uid_dict,
                answers_by_exam_uid=answers_by_exam_uid_dict,
                records_by_uid=records_by_uid_dict,
                mapping_report=mapping_report,
                scope=scope,
                exclude_descriptive=exclude_descriptive,
                unsupported_question_uids=unsupported_question_uids,
            )
        missing_rows = missing_rows_by_scope[effective_missing_scope]

        mapped_keys = {
            (
                str(item.get("question_uid", "")),
                str(item.get("exam_uid", "")),
                str(item.get("link", "")),
                str(item.get("year", "")),
                str(item.get("type", "")),
            )
            for item in missing_rows_by_scope[QUESTIONS_MISSING_SCOPE_MAPPED]
        }
        for item in missing_rows_by_scope[QUESTIONS_MISSING_SCOPE_FULL]:
            key = (
                str(item.get("question_uid", "")),
                str(item.get("exam_uid", "")),
                str(item.get("link", "")),
                str(item.get("year", "")),
                str(item.get("type", "")),
            )
            if key not in mapped_keys:
                missing_rows_diff.append(item)

        if questions_missing_report_path:
            write_csv(
                questions_missing_report_path,
                missing_rows,
                fieldnames=missing_csv_fieldnames,
            )
        if questions_missing_report_mapped_universe_path:
            write_csv(
                questions_missing_report_mapped_universe_path,
                missing_rows_by_scope[QUESTIONS_MISSING_SCOPE_MAPPED],
                fieldnames=missing_csv_fieldnames,
            )
        if questions_missing_report_full_dataset_path:
            write_csv(
                questions_missing_report_full_dataset_path,
                missing_rows_by_scope[QUESTIONS_MISSING_SCOPE_FULL],
                fieldnames=missing_csv_fieldnames,
            )
        if questions_missing_report_diff_path:
            write_csv(
                questions_missing_report_diff_path,
                missing_rows_diff,
                fieldnames=missing_csv_fieldnames,
            )
        max_questions_missing = int(config.get("max_questions_missing_answers", 1000000))
        if len(missing_rows) > max_questions_missing:
            errors.append(
                "questions missing answers exceeded: "
                f"scope={effective_missing_scope}, missing={len(missing_rows)}, max={max_questions_missing}"
            )

    ensure_dir(Path(coverage_report_path).parent)
    write_json(coverage_report_path, coverage_report)
    write_json(
        validation_report_path,
        {
            "answers_json": str(answers_json_path),
            "parsed_summary_path": str(parsed_summary_path) if parsed_summary_path else "",
            "mapping_report_path": str(mapping_report_path) if mapping_report_path else "",
            "answers_by_exam_uid_path": str(answers_by_exam_uid_path) if answers_by_exam_uid_path else "",
            "questions_missing_report_path": str(questions_missing_report_path) if questions_missing_report_path else "",
            "questions_missing_scope": effective_missing_scope,
            "unsupported_questions_path": str(unsupported_questions_path)
            if unsupported_questions_path
            else "",
            "unsupported_questions_count": len(unsupported_question_uids),
            "missing_questions_count": len(missing_rows),
            "missing_questions_count_by_scope": {
                QUESTIONS_MISSING_SCOPE_MAPPED: len(missing_rows_by_scope[QUESTIONS_MISSING_SCOPE_MAPPED]),
                QUESTIONS_MISSING_SCOPE_FULL: len(missing_rows_by_scope[QUESTIONS_MISSING_SCOPE_FULL]),
            },
            "missing_questions_diff_count": len(missing_rows_diff),
            "questions_missing_report_mapped_universe_path": (
                str(questions_missing_report_mapped_universe_path)
                if questions_missing_report_mapped_universe_path
                else ""
            ),
            "questions_missing_report_full_dataset_path": (
                str(questions_missing_report_full_dataset_path)
                if questions_missing_report_full_dataset_path
                else ""
            ),
            "questions_missing_report_diff_path": (
                str(questions_missing_report_diff_path)
                if questions_missing_report_diff_path
                else ""
            ),
            "error_count": len(errors),
            "errors": errors,
            "mapping_validation": mapping_validation_report,
        },
    )
    return len(errors) == 0, errors


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Validate answers_master_v1.json")
    parser.add_argument("--answers-json", required=True, help="Path to answers_master_v1.json")
    parser.add_argument("--schema", required=True, help="Path to answers schema JSON")
    parser.add_argument("--coverage", required=True, help="Path to subject_question_counts.json")
    parser.add_argument("--config", required=True, help="Path to validation_config.json")
    parser.add_argument(
        "--coverage-report",
        default="artifacts/review/coverage_report.json",
        help="Coverage report output path.",
    )
    parser.add_argument(
        "--validation-report",
        default="artifacts/review/validation_report.json",
        help="Validation report output path.",
    )
    parser.add_argument(
        "--parsed-summary",
        default="artifacts/parsed/summary.json",
        help="Optional parsed summary for parse-rate checks.",
    )
    parser.add_argument(
        "--mapping-report",
        default="data/answers/answer_to_question_map_v1.json",
        help="Optional answer->question mapping report path.",
    )
    parser.add_argument(
        "--questions",
        default="public/questions-filtered-with-ids.json",
        help="Questions JSON used for missing answers report.",
    )
    parser.add_argument(
        "--answers-by-question-uid",
        default="data/answers/answers_by_question_uid_v1.json",
        help="Question UID indexed answers path.",
    )
    parser.add_argument(
        "--answers-by-exam-uid",
        default="data/answers/answers_by_exam_uid_v1.json",
        help="Exam UID indexed answers path.",
    )
    parser.add_argument(
        "--questions-missing-report",
        default="artifacts/review/questions_missing_answers.csv",
        help="Output CSV for missing answers by question.",
    )
    parser.add_argument(
        "--questions-missing-scope",
        choices=sorted(QUESTIONS_MISSING_SCOPES),
        default=None,
        help=(
            "Override questions missing scope from config. "
            "Use 'full_dataset' to enforce against all question rows."
        ),
    )
    parser.add_argument(
        "--questions-missing-report-full-dataset",
        default="artifacts/review/questions_missing_answers.full_dataset.csv",
        help="Output CSV for full-dataset missing answers.",
    )
    parser.add_argument(
        "--questions-missing-report-mapped-universe",
        default="artifacts/review/questions_missing_answers.mapped_universe.csv",
        help="Output CSV for mapped-universe missing answers.",
    )
    parser.add_argument(
        "--questions-missing-report-diff",
        default="artifacts/review/questions_missing_answers.diff_unresolved_ui.csv",
        help="Output CSV for full-dataset minus mapped-universe missing answers.",
    )
    parser.add_argument(
        "--unsupported-questions",
        default="data/answers/unsupported_question_uids_v1.json",
        help="Optional JSON with question_uids list to exclude from strict missing checks.",
    )
    return parser


def main() -> None:
    parser = build_arg_parser()
    args = parser.parse_args()
    is_valid, errors = validate_answers(
        answers_json_path=args.answers_json,
        schema_path=args.schema,
        coverage_path=args.coverage,
        config_path=args.config,
        coverage_report_path=args.coverage_report,
        validation_report_path=args.validation_report,
        parsed_summary_path=args.parsed_summary,
        mapping_report_path=args.mapping_report,
        questions_path=args.questions,
        answers_by_question_uid_path=args.answers_by_question_uid,
        answers_by_exam_uid_path=args.answers_by_exam_uid,
        questions_missing_report_path=args.questions_missing_report,
        questions_missing_scope=args.questions_missing_scope,
        questions_missing_report_full_dataset_path=args.questions_missing_report_full_dataset,
        questions_missing_report_mapped_universe_path=args.questions_missing_report_mapped_universe,
        questions_missing_report_diff_path=args.questions_missing_report_diff,
        unsupported_questions_path=args.unsupported_questions,
    )
    if not is_valid:
        for issue in errors:
            print(f"[ERROR] {issue}")
        raise SystemExit(1)
    print("Validation passed.")


if __name__ == "__main__":
    main()
