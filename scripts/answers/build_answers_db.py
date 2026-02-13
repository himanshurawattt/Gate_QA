from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path
from typing import Any

if __package__ is None or __package__ == "":
    sys.path.append(str(Path(__file__).resolve().parents[2]))

from scripts.answers.common import ensure_dir, now_iso, read_json, write_csv, write_json
from scripts.answers.build_answers_by_exam_uid import build_answers_by_exam_uid
from scripts.answers.enrich_questions_with_ids import enrich_questions_with_ids
from scripts.answers.extract_answer_pages import extract_answer_pages
from scripts.answers.merge_answers_into_questions import merge_answers_into_questions
from scripts.answers.normalize_ocr_text import normalize_ocr_dir
from scripts.answers.ocr_answer_pages import ocr_answer_pages
from scripts.answers.parse_answer_key import parse_normalized_dir
from scripts.answers.validate_answers import validate_answers


def _build_answers_payload(
    parsed_records_path: Path,
    suspicious_records_path: Path,
    nat_tolerance_abs: float,
    answer_uid_to_question_uid: dict[str, str] | None = None,
    mapping_stats: dict[str, Any] | None = None,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    parsed_records = read_json(parsed_records_path).get("records", [])
    suspicious_records = read_json(suspicious_records_path).get("suspicious", [])

    parsed_count = len(parsed_records)
    suspicious_count = len(suspicious_records)
    total_rows = parsed_count + suspicious_count

    records_by_uid: dict[str, dict[str, Any]] = {}
    csv_rows: list[dict[str, Any]] = []
    for record in parsed_records:
        uid = record["uid"]
        out_record = {
            "uid": uid,
            "id_str": record["id_str"],
            "volume": record["volume"],
            "chapter_no": record["chapter_no"],
            "subject_code": record["subject_code"],
            "question_no": record["question_no"],
            "type": record["type"],
            "answer": record["answer"],
            "source": record["source"],
        }
        if answer_uid_to_question_uid and uid in answer_uid_to_question_uid:
            out_record["question_uid"] = answer_uid_to_question_uid[uid]
        if record["type"] == "NAT":
            out_record["tolerance"] = {"abs": nat_tolerance_abs}

        records_by_uid[uid] = out_record
        csv_rows.append(
            {
                "uid": uid,
                "id_str": record["id_str"],
                "volume": record["volume"],
                "chapter_no": record["chapter_no"],
                "subject_code": record["subject_code"],
                "question_no": record["question_no"],
                "type": record["type"],
                "answer_mcq": record["answer"] if record["type"] == "MCQ" else "",
                "answer_msq": ";".join(record["answer"]) if record["type"] == "MSQ" else "",
                "answer_nat": record["answer"] if record["type"] == "NAT" else "",
                "tolerance_abs": nat_tolerance_abs if record["type"] == "NAT" else "",
                "source_pdf": record["source"]["pdf"],
                "source_page": record["source"]["page"],
                "source_line_index": ",".join(str(idx) for idx in record["source"]["line_index"]),
            }
        )

    payload = {
        "version": "v1",
        "generated_at": now_iso(),
        "stats": {
            "total_rows_seen": total_rows,
            "parsed_records": parsed_count,
            "suspicious_lines": suspicious_count,
            "parse_rate": (parsed_count / total_rows) if total_rows else 0.0,
            "mapped_records": int((mapping_stats or {}).get("resolved", 0)),
            "unmapped_records": int((mapping_stats or {}).get("unresolved", 0)),
            "mapping_conflicts": int((mapping_stats or {}).get("mapping_conflicts", 0)),
        },
        "records_by_uid": records_by_uid,
    }
    return payload, csv_rows


def _write_suspicious_csv(suspicious_path: Path, out_csv: Path) -> None:
    suspicious = read_json(suspicious_path).get("suspicious", [])
    rows = []
    for item in suspicious:
        rows.append(
            {
                "volume": item.get("volume", ""),
                "page_no": item.get("page_no", ""),
                "line_index": item.get("line_index", ""),
                "ocr_line": item.get("ocr_line", ""),
                "reason": item.get("reason", ""),
                "reason_code": item.get("reason_code", item.get("reason", "")),
                "reason_detail": item.get("reason_detail", ""),
                "candidate_uid": item.get("candidate_uid", ""),
            }
        )
    write_csv(
        out_csv,
        rows,
        fieldnames=[
            "volume",
            "page_no",
            "line_index",
            "ocr_line",
            "reason",
            "reason_code",
            "reason_detail",
            "candidate_uid",
        ],
    )


def _load_manual_patch_records(
    manual_patch_path: str | Path,
    nat_tolerance_abs: float,
) -> tuple[dict[str, dict[str, Any]], list[dict[str, Any]]]:
    path = Path(manual_patch_path)
    if not path.exists():
        return {}, []

    payload = read_json(path)
    if isinstance(payload, dict) and "records_by_question_uid" in payload:
        records = payload.get("records_by_question_uid", {})
    elif isinstance(payload, dict):
        records = payload
    else:
        records = {}

    normalized: dict[str, dict[str, Any]] = {}
    invalid: list[dict[str, Any]] = []
    for question_uid, raw in records.items():
        q_uid = str(question_uid).strip()
        if not q_uid or not isinstance(raw, dict):
            invalid.append({"question_uid": q_uid, "reason": "invalid_patch_record"})
            continue

        answer_type = str(raw.get("type", "")).upper().strip()
        if answer_type not in {"MCQ", "MSQ", "NAT"}:
            invalid.append({"question_uid": q_uid, "reason": "invalid_type"})
            continue

        if answer_type == "MCQ":
            answer = str(raw.get("answer", "")).upper().strip()
            if answer not in {"A", "B", "C", "D"}:
                invalid.append({"question_uid": q_uid, "reason": "invalid_mcq_answer"})
                continue
            normalized[q_uid] = {
                "answer_uid": f"manual:{q_uid}",
                "type": "MCQ",
                "answer": answer,
                "tolerance": None,
                "source": {"pdf": "manual_patch", "page": 0, "line_index": []},
            }
            continue

        if answer_type == "MSQ":
            raw_answers = raw.get("answer", raw.get("answers", []))
            if isinstance(raw_answers, str):
                candidates = [token.strip().upper() for token in raw_answers.replace(",", ";").split(";")]
            elif isinstance(raw_answers, list):
                candidates = [str(token).strip().upper() for token in raw_answers]
            else:
                invalid.append({"question_uid": q_uid, "reason": "invalid_msq_answer"})
                continue

            deduped: list[str] = []
            valid = True
            for token in candidates:
                if token not in {"A", "B", "C", "D"}:
                    valid = False
                    break
                if token not in deduped:
                    deduped.append(token)
            if not valid or len(deduped) < 2:
                invalid.append({"question_uid": q_uid, "reason": "invalid_msq_answer"})
                continue

            normalized[q_uid] = {
                "answer_uid": f"manual:{q_uid}",
                "type": "MSQ",
                "answer": deduped,
                "tolerance": None,
                "source": {"pdf": "manual_patch", "page": 0, "line_index": []},
            }
            continue

        value = raw.get("answer", raw.get("value"))
        try:
            numeric = float(value)
        except (TypeError, ValueError):
            invalid.append({"question_uid": q_uid, "reason": "invalid_nat_answer"})
            continue
        tolerance = raw.get("tolerance", {"abs": nat_tolerance_abs})
        abs_tol = tolerance.get("abs", nat_tolerance_abs) if isinstance(tolerance, dict) else nat_tolerance_abs
        try:
            abs_tol = float(abs_tol)
        except (TypeError, ValueError):
            abs_tol = nat_tolerance_abs

        normalized[q_uid] = {
            "answer_uid": f"manual:{q_uid}",
            "type": "NAT",
            "answer": numeric,
            "tolerance": {"abs": abs_tol},
            "source": {"pdf": "manual_patch", "page": 0, "line_index": []},
        }

    return normalized, invalid


def _apply_manual_patch(
    answers_by_question_uid_path: str | Path,
    manual_patch_path: str | Path,
    nat_tolerance_abs: float,
) -> dict[str, Any]:
    payload = read_json(answers_by_question_uid_path)
    records = payload.get("records_by_question_uid", {})
    if not isinstance(records, dict):
        records = {}

    patch_records, invalid_records = _load_manual_patch_records(
        manual_patch_path=manual_patch_path,
        nat_tolerance_abs=nat_tolerance_abs,
    )
    applied = 0
    for question_uid, record in patch_records.items():
        records[question_uid] = record
        applied += 1

    payload["records_by_question_uid"] = records
    stats = payload.get("stats", {}) if isinstance(payload.get("stats"), dict) else {}
    stats["records"] = len(records)
    stats["manual_patch_applied"] = applied
    stats["manual_patch_invalid"] = len(invalid_records)
    payload["stats"] = stats
    write_json(answers_by_question_uid_path, payload)
    return {
        "applied": applied,
        "invalid_count": len(invalid_records),
        "invalid_records": invalid_records[:50],
        "manual_patch_path": str(manual_patch_path),
    }


def build_answers_db(args: argparse.Namespace) -> None:
    answer_pages_dir = Path(args.answer_pages_dir)
    ocr_raw_dir = Path(args.ocr_raw_dir)
    normalized_dir = Path(args.normalized_dir)
    parsed_dir = Path(args.parsed_dir)
    review_dir = ensure_dir(args.review_dir)
    answers_dir = ensure_dir(args.answers_dir)

    manifest_path = extract_answer_pages(
        vol1_path=args.vol1,
        vol2_path=args.vol2,
        subject_map_path=args.subject_map,
        out_dir=answer_pages_dir,
        dpi=args.dpi,
        crop_left=args.crop_left,
        crop_right=args.crop_right,
        crop_top=args.crop_top,
        crop_bottom=args.crop_bottom,
    )

    ocr_answer_pages(
        manifest_path=manifest_path,
        out_dir=ocr_raw_dir,
        engine=args.ocr_engine,
        lang=args.ocr_lang,
        preprocess_mode=args.ocr_preprocess_mode,
        threshold=args.ocr_threshold,
        denoise_radius=args.ocr_denoise_radius,
        scale=args.ocr_scale,
        tesseract_psm=args.ocr_tesseract_psm,
    )

    normalize_ocr_dir(
        ocr_dir=ocr_raw_dir,
        out_dir=normalized_dir,
        profile_path=args.normalization_profile,
    )

    parsed_records_path, suspicious_records_path = parse_normalized_dir(
        normalized_dir=normalized_dir,
        out_dir=parsed_dir,
        nat_tolerance_abs=args.nat_tolerance_abs,
    )

    answers_by_uid_path = Path(args.answers_by_question_uid_out)
    mapping_out_path = Path(args.answer_question_map_out)
    enriched_questions_path, unresolved_path, mapping_report_path = enrich_questions_with_ids(
        parsed_records_path=parsed_records_path,
        manifest_path=manifest_path,
        questions_path=args.questions,
        overrides_path=args.overrides,
        out_path=args.questions_with_ids,
        unresolved_out_path=Path(review_dir) / "id_mapping_unresolved.csv",
        answers_by_uid_out_path=answers_by_uid_path,
        mapping_out_path=mapping_out_path,
    )
    manual_patch_summary = _apply_manual_patch(
        answers_by_question_uid_path=answers_by_uid_path,
        manual_patch_path=args.manual_patch,
        nat_tolerance_abs=args.nat_tolerance_abs,
    )
    answers_by_exam_uid_path, exam_uid_summary = build_answers_by_exam_uid(
        questions_path=enriched_questions_path,
        answers_by_question_uid_path=answers_by_uid_path,
        manual_exam_patch_path=args.manual_exam_patch,
        out_path=args.answers_by_exam_uid_out,
        conflicts_csv_path=Path(review_dir) / "exam_uid_mapping_conflicts.csv",
        missing_csv_path=Path(review_dir) / "questions_missing_exam_uid_answers.csv",
    )

    _apply_manual_resolutions(
        answers_by_question_uid_path=answers_by_uid_path,
        manual_resolutions_path=Path(args.manual_resolutions),
    )

    mapping_payload = read_json(mapping_report_path)
    answer_uid_to_question_uid = {
        str(item.get("answer_uid")): str(item.get("question_uid"))
        for item in mapping_payload.get("resolved", [])
        if item.get("answer_uid") and item.get("question_uid")
    }

    answers_payload, csv_rows = _build_answers_payload(
        parsed_records_path=parsed_records_path,
        suspicious_records_path=suspicious_records_path,
        nat_tolerance_abs=args.nat_tolerance_abs,
        answer_uid_to_question_uid=answer_uid_to_question_uid,
        mapping_stats=mapping_payload.get("stats", {}),
    )

    answers_json_path = Path(answers_dir) / "answers_master_v1.json"
    answers_csv_path = Path(answers_dir) / "answers_master_v1.csv"
    write_json(answers_json_path, answers_payload)
    write_csv(
        answers_csv_path,
        csv_rows,
        fieldnames=[
            "uid",
            "id_str",
            "volume",
            "chapter_no",
            "subject_code",
            "question_no",
            "type",
            "answer_mcq",
            "answer_msq",
            "answer_nat",
            "tolerance_abs",
            "source_pdf",
            "source_page",
            "source_line_index",
        ],
    )

    suspicious_csv_path = Path(review_dir) / "suspicious_lines.csv"
    _write_suspicious_csv(suspicious_records_path, suspicious_csv_path)

    error_report = {
        "generated_at": now_iso(),
        "suspicious_csv": str(suspicious_csv_path),
        "mapping_report": str(mapping_report_path),
        "id_mapping_unresolved_csv": str(unresolved_path),
        "questions_missing_answers_csv": str(Path(review_dir) / "questions_missing_answers.csv"),
        "questions_missing_answers_full_dataset_csv": str(
            Path(review_dir) / "questions_missing_answers.full_dataset.csv"
        ),
        "questions_missing_answers_mapped_universe_csv": str(
            Path(review_dir) / "questions_missing_answers.mapped_universe.csv"
        ),
        "questions_missing_answers_diff_csv": str(
            Path(review_dir) / "questions_missing_answers.diff_unresolved_ui.csv"
        ),
        "answers_by_exam_uid": str(answers_by_exam_uid_path),
        "exam_uid_summary": exam_uid_summary,
        "manual_patch_summary": manual_patch_summary,
        "parsed_summary": str(Path(parsed_dir) / "summary.json"),
        "normalized_summary": str(Path(normalized_dir) / "summary.json"),
        "ocr_summary": str(Path(ocr_raw_dir) / "summary.json"),
    }
    write_json(Path(review_dir) / "error_report.json", error_report)

    is_valid, errors = validate_answers(
        answers_json_path=answers_json_path,
        schema_path=args.schema,
        coverage_path=args.coverage,
        config_path=args.validation_config,
        coverage_report_path=Path(review_dir) / "coverage_report.json",
        validation_report_path=Path(review_dir) / "validation_report.json",
        parsed_summary_path=Path(parsed_dir) / "summary.json",
        mapping_report_path=mapping_report_path,
        questions_path=enriched_questions_path,
        answers_by_question_uid_path=answers_by_uid_path,
        questions_missing_report_path=Path(review_dir) / "questions_missing_answers.csv",
        questions_missing_scope=args.questions_missing_scope,
        questions_missing_report_full_dataset_path=(
            Path(review_dir) / "questions_missing_answers.full_dataset.csv"
        ),
        questions_missing_report_mapped_universe_path=(
            Path(review_dir) / "questions_missing_answers.mapped_universe.csv"
        ),
        questions_missing_report_diff_path=(
            Path(review_dir) / "questions_missing_answers.diff_unresolved_ui.csv"
        ),
        answers_by_exam_uid_path=answers_by_exam_uid_path,
        unsupported_questions_path=args.unsupported_questions,
    )

    if args.merge_questions_with_answers:
        merge_answers_into_questions(
            questions_path=enriched_questions_path,
            answers_path=answers_by_uid_path,
            answers_by_exam_uid_path=answers_by_exam_uid_path,
            out_path=args.questions_with_answers,
        )

    if args.public_answers_copy:
        public_answers_path = Path(args.public_answers_copy)
        ensure_dir(public_answers_path.parent)
        shutil.copy2(answers_json_path, public_answers_path)
    if args.public_answers_by_question_uid_copy:
        public_join_path = Path(args.public_answers_by_question_uid_copy)
        ensure_dir(public_join_path.parent)
        shutil.copy2(answers_by_uid_path, public_join_path)
    if args.public_answers_by_exam_uid_copy:
        public_exam_path = Path(args.public_answers_by_exam_uid_copy)
        ensure_dir(public_exam_path.parent)
        shutil.copy2(answers_by_exam_uid_path, public_exam_path)

    print(f"answers json: {answers_json_path}")
    print(f"answers csv: {answers_csv_path}")
    print(f"suspicious csv: {suspicious_csv_path}")
    print(f"id unresolved csv: {unresolved_path}")
    print(f"enriched questions: {enriched_questions_path}")
    print(f"answer-question map: {mapping_report_path}")

    if not is_valid:
        print("Validation failed:")
        for issue in errors:
            print(f"- {issue}")
        raise SystemExit(1)
    print("Validation passed.")


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="End-to-end offline answers DB builder.")
    parser.add_argument("--vol1", required=True, help="Path to volume1.pdf")
    parser.add_argument("--vol2", required=True, help="Path to volume2.pdf")
    parser.add_argument("--subject-map", required=True, help="Path to data/subject_map.json")

    parser.add_argument("--dpi", type=int, default=400, help="Image render DPI.")
    parser.add_argument("--crop-left", type=float, default=0.03, help="Left crop margin ratio.")
    parser.add_argument("--crop-right", type=float, default=0.03, help="Right crop margin ratio.")
    parser.add_argument("--crop-top", type=float, default=0.05, help="Top crop margin ratio.")
    parser.add_argument("--crop-bottom", type=float, default=0.05, help="Bottom crop margin ratio.")
    parser.add_argument("--ocr-engine", choices=["paddle", "tesseract"], default="tesseract")
    parser.add_argument("--ocr-lang", default="en")
    parser.add_argument(
        "--ocr-preprocess-mode",
        choices=["none", "basic", "threshold", "adaptive"],
        default="threshold",
        help="Image preprocessing mode before OCR.",
    )
    parser.add_argument("--ocr-threshold", type=int, default=165, help="Binarization threshold.")
    parser.add_argument("--ocr-denoise-radius", type=int, default=3, help="Median denoise kernel size.")
    parser.add_argument("--ocr-scale", type=float, default=1.3, help="Upscale factor before OCR.")
    parser.add_argument("--ocr-tesseract-psm", type=int, default=6, help="Tesseract PSM mode.")
    parser.add_argument("--nat-tolerance-abs", type=float, default=0.01)
    parser.add_argument(
        "--normalization-profile",
        default="data/answers/ocr_profile_tesseract.json",
        help="Optional OCR normalization profile JSON for noisy engines.",
    )

    parser.add_argument("--answer-pages-dir", default="artifacts/answer_pages")
    parser.add_argument("--ocr-raw-dir", default="artifacts/ocr_raw")
    parser.add_argument("--normalized-dir", default="artifacts/normalized")
    parser.add_argument("--parsed-dir", default="artifacts/parsed")
    parser.add_argument("--review-dir", default="artifacts/review")
    parser.add_argument("--answers-dir", default="data/answers")

    parser.add_argument("--schema", default="data/answers/answers.schema.json")
    parser.add_argument("--validation-config", default="data/answers/validation_config.json")
    parser.add_argument("--coverage", default="data/answers/subject_question_counts.json")
    parser.add_argument(
        "--unsupported-questions",
        default="data/answers/unsupported_question_uids_v1.json",
        help="Optional JSON list of unsupported question_uids to exclude from strict missing checks.",
    )
    parser.add_argument(
        "--questions-missing-scope",
        choices=["mapped_universe", "full_dataset"],
        default=None,
        help="Override questions missing scope from validation config.",
    )

    parser.add_argument("--questions", default="public/questions-filtered.json")
    parser.add_argument("--overrides", default="data/question_id_overrides.json")
    parser.add_argument(
        "--manual-patch",
        default="data/answers/manual_answers_patch_v1.json",
        help="Manual final patch keyed by question_uid.",
    )
    parser.add_argument(
        "--manual-exam-patch",
        default="data/answers/manual_exam_answers_patch_v1.json",
        help="Manual final patch keyed by exam_uid.",
    )
    parser.add_argument(
        "--manual-resolutions",
        default="data/answers/manual_resolutions_v1.json",
        help="Manual resolutions for subjective/ambiguous questions.",
    )
    parser.add_argument("--questions-with-ids", default="public/questions-filtered-with-ids.json")
    parser.add_argument(
        "--answers-by-question_uid-out",
        default="data/answers/answers_by_question_uid_v1.json",
        help="Output file for question_uid-indexed answer records.",
    )
    parser.add_argument(
        "--answers-by-exam-uid-out",
        default="data/answers/answers_by_exam_uid_v1.json",
        help="Output file for exam_uid-indexed answer records.",
    )
    parser.add_argument(
        "--answer-question-map-out",
        default="data/answers/answer_to_question_map_v1.json",
        help="Output file for answer_uid->question_uid mapping report.",
    )
    parser.add_argument(
        "--questions-with-answers",
        default="public/questions-with-answers.json",
    )
    parser.add_argument(
        "--merge-questions-with-answers",
        action="store_true",
        help="If set, creates public/questions-with-answers.json",
    )
    parser.add_argument(
        "--public-answers-copy",
        default="public/data/answers/answers_master_v1.json",
        help="Optional location to copy answers JSON for frontend fetch.",
    )
    parser.add_argument(
        "--public-answers-by-question-uid-copy",
        default="public/data/answers/answers_by_question_uid_v1.json",
        help="Optional location to copy question_uid-indexed answers for frontend fetch.",
    )
    parser.add_argument(
        "--public-answers-by-exam-uid-copy",
        default="public/data/answers/answers_by_exam_uid_v1.json",
        help="Optional location to copy exam_uid-indexed answers for frontend fetch.",
    )
    return parser


def _apply_manual_resolutions(
    answers_by_question_uid_path: Path,
    manual_resolutions_path: Path,
) -> dict[str, Any]:
    if not manual_resolutions_path.exists():
        return {"applied": 0, "path": str(manual_resolutions_path)}

    resolutions = read_json(manual_resolutions_path)
    if not isinstance(resolutions, dict):
        return {"applied": 0, "error": "invalid_format"}

    payload = read_json(answers_by_question_uid_path)
    records = payload.get("records_by_question_uid", {})
    
    applied_count = 0
    for q_uid, res in resolutions.items():
        if not isinstance(res, dict):
            continue
            
        res_type = res.get("resolution_type")
        value = res.get("value")
        notes = res.get("notes")
        
        # Construct the answer record
        out_record = {
            "answer_uid": f"manual_res:{q_uid}",
            "type": res_type,  # SUBJECTIVE, AMBIGUOUS, etc. or MCQ/NAT
            "answer": value,   # Can be null for subjective
            "tolerance": None,
            "source": {
                "pdf": "manual_resolution",
                "notes": notes,
                "updated_at": res.get("updated_at")
            },
            "is_manual_resolution": True
        }
        
        records[q_uid] = out_record
        applied_count += 1
        
    payload["records_by_question_uid"] = records
    stats = payload.get("stats", {})
    stats["manual_resolutions_applied"] = applied_count
    payload["stats"] = stats
    
    write_json(answers_by_question_uid_path, payload)
    return {"applied": applied_count, "path": str(manual_resolutions_path)}


def main() -> None:
    parser = build_arg_parser()
    args = parser.parse_args()
    build_answers_db(args)


if __name__ == "__main__":
    main()
