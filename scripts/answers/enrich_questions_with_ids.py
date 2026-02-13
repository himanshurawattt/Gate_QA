from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any

if __package__ is None or __package__ == "":
    sys.path.append(str(Path(__file__).resolve().parents[2]))

from scripts.answers.common import (
    ensure_dir,
    extract_gateoverflow_numeric_id,
    now_iso,
    parse_id_str,
    question_uid_from_record,
    read_json,
    uid_from,
    write_csv,
    write_json,
)


def _load_overrides(path: str | Path) -> dict[str, str]:
    override_path = Path(path)
    if not override_path.exists():
        return {}
    payload = read_json(override_path)
    if not isinstance(payload, dict):
        return {}

    if "uid_to_question_uid" in payload and isinstance(payload["uid_to_question_uid"], dict):
        return {str(uid): str(question_uid) for uid, question_uid in payload["uid_to_question_uid"].items()}

    if "uid_to_question_id" in payload and isinstance(payload["uid_to_question_id"], dict):
        mapped: dict[str, str] = {}
        for uid, question_id in payload["uid_to_question_id"].items():
            question_id_str = str(question_id).strip()
            if not question_id_str:
                continue
            mapped[str(uid)] = (
                question_id_str if question_id_str.startswith(("go:", "local:")) else f"go:{question_id_str}"
            )
        return mapped

    flat: dict[str, str] = {}
    for uid, value in payload.items():
        value_str = str(value).strip()
        if not value_str:
            continue
        flat[str(uid)] = value_str if value_str.startswith(("go:", "local:")) else f"go:{value_str}"
    return flat


def _build_question_indexes(questions: list[dict[str, Any]]) -> tuple[dict[str, str], set[str]]:
    go_id_to_question_uid: dict[str, str] = {}
    question_uid_set: set[str] = set()
    for question in questions:
        question_uid = str(question.get("question_uid", "")).strip()
        if not question_uid:
            question_uid = question_uid_from_record(question)
            question["question_uid"] = question_uid
        question_uid_set.add(question_uid)

        go_id = extract_gateoverflow_numeric_id(str(question.get("link", "")))
        if go_id and go_id not in go_id_to_question_uid:
            go_id_to_question_uid[go_id] = question_uid
    return go_id_to_question_uid, question_uid_set


def _collect_manifest_candidates(
    manifest: dict[str, Any],
    go_id_to_question_uid: dict[str, str],
) -> dict[str, list[dict[str, str]]]:
    candidates: dict[str, list[dict[str, str]]] = {}
    for item in manifest.get("items", []):
        volume = int(item.get("volume", 0))
        for pair in item.get("id_url_pairs", []):
            id_str = str(pair.get("id_str", "")).strip()
            if not id_str:
                continue
            question_id = extract_gateoverflow_numeric_id(str(pair.get("question_url", "")))
            if not question_id:
                continue
            question_uid = go_id_to_question_uid.get(question_id)
            if not question_uid:
                continue
            answer_uid = uid_from(volume=volume, id_str=id_str)
            candidates.setdefault(answer_uid, []).append(
                {
                    "question_uid": question_uid,
                    "source": "manifest_link",
                    "question_id_hint": question_id,
                    "page_no": str(item.get("page_no", "")),
                }
            )
    return candidates


def _collect_record_hint_candidates(
    parsed_records: list[dict[str, Any]],
    go_id_to_question_uid: dict[str, str],
) -> dict[str, list[dict[str, str]]]:
    candidates: dict[str, list[dict[str, str]]] = {}
    for record in parsed_records:
        answer_uid = str(record.get("uid", "")).strip()
        if not answer_uid:
            continue
        question_id = extract_gateoverflow_numeric_id(str(record.get("link_hint", "")))
        if not question_id:
            continue
        question_uid = go_id_to_question_uid.get(question_id)
        if not question_uid:
            continue
        source = record.get("source") or {}
        candidates.setdefault(answer_uid, []).append(
            {
                "question_uid": question_uid,
                "source": "parsed_link_hint",
                "question_id_hint": question_id,
                "page_no": str(source.get("page", "")),
            }
        )
    return candidates


def _manifest_pairs_by_page(manifest: dict[str, Any]) -> dict[tuple[int, int], list[dict[str, str]]]:
    index: dict[tuple[int, int], list[dict[str, str]]] = {}
    for item in manifest.get("items", []):
        try:
            key = (int(item.get("volume", 0)), int(item.get("page_no", 0)))
        except (TypeError, ValueError):
            continue
        pairs = item.get("id_url_pairs", []) or []
        if not isinstance(pairs, list):
            continue
        index[key] = pairs
    return index


def _collect_manifest_fuzzy_candidates(
    parsed_records: list[dict[str, Any]],
    manifest: dict[str, Any],
    go_id_to_question_uid: dict[str, str],
) -> dict[str, list[dict[str, str]]]:
    candidates: dict[str, list[dict[str, str]]] = {}
    pairs_by_page = _manifest_pairs_by_page(manifest)

    for record in parsed_records:
        answer_uid = str(record.get("uid", "")).strip()
        if not answer_uid:
            continue

        source = record.get("source") or {}
        try:
            page_key = (int(record.get("volume", 0)), int(source.get("page", 0)))
        except (TypeError, ValueError):
            continue
        page_pairs = pairs_by_page.get(page_key, [])
        if not page_pairs:
            continue

        id_parts = parse_id_str(str(record.get("id_str", "")))
        if not id_parts:
            continue
        _, rec_subject, rec_question = id_parts

        subject_question_matches: list[dict[str, str]] = []
        for pair in page_pairs:
            pair_id = str(pair.get("id_str", "")).strip()
            pair_parts = parse_id_str(pair_id)
            if not pair_parts:
                continue
            _, pair_subject, pair_question = pair_parts
            if pair_subject == rec_subject and pair_question == rec_question:
                subject_question_matches.append(pair)

        selected_pair: dict[str, str] | None = None
        source_tag = ""
        if len(subject_question_matches) == 1:
            selected_pair = subject_question_matches[0]
            source_tag = "manifest_fuzzy_subject_question"

        if not selected_pair:
            continue

        question_id = extract_gateoverflow_numeric_id(str(selected_pair.get("question_url", "")))
        if not question_id:
            continue
        question_uid = go_id_to_question_uid.get(question_id)
        if not question_uid:
            continue

        candidates.setdefault(answer_uid, []).append(
            {
                "question_uid": question_uid,
                "source": source_tag,
                "question_id_hint": question_id,
                "page_no": str(page_key[1]),
            }
        )
    return candidates


def _merge_candidates(
    target: dict[str, list[dict[str, str]]],
    incoming: dict[str, list[dict[str, str]]],
) -> None:
    for answer_uid, rows in incoming.items():
        target.setdefault(answer_uid, []).extend(rows)


def _resolve_mapping_for_answer(
    answer_uid: str,
    candidates: list[dict[str, str]],
    override_question_uid: str | None,
    question_uid_set: set[str],
    source_page: str,
) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    page_matched = [candidate for candidate in candidates if str(candidate.get("page_no", "")) == source_page]
    if page_matched:
        candidates = page_matched

    if override_question_uid:
        if override_question_uid not in question_uid_set:
            return None, {
                "answer_uid": answer_uid,
                "reason": "override_target_not_found",
                "question_uid_candidates": sorted({c.get("question_uid", "") for c in candidates if c.get("question_uid")}),
                "selected_question_uid": override_question_uid,
            }
        return (
            {
                "answer_uid": answer_uid,
                "question_uid": override_question_uid,
                "source": "override",
                "question_id_hint": override_question_uid.replace("go:", "") if override_question_uid.startswith("go:") else "",
            },
            None,
        )

    unique_targets = sorted(
        {
            candidate.get("question_uid", "")
            for candidate in candidates
            if candidate.get("question_uid")
        }
    )
    if len(unique_targets) == 1:
        winning_uid = unique_targets[0]
        winning_source = ""
        question_id_hint = ""
        for candidate in candidates:
            if candidate.get("question_uid") == winning_uid:
                winning_source = candidate.get("source", "")
                question_id_hint = candidate.get("question_id_hint", "")
                break
        return (
            {
                "answer_uid": answer_uid,
                "question_uid": winning_uid,
                "source": winning_source,
                "question_id_hint": question_id_hint,
            },
            None,
        )

    if not unique_targets:
        return None, {
            "answer_uid": answer_uid,
            "reason": "no_mapping_to_question",
            "question_uid_candidates": [],
            "selected_question_uid": "",
        }

    return None, {
        "answer_uid": answer_uid,
        "reason": "mapping_conflict",
        "question_uid_candidates": unique_targets,
        "selected_question_uid": "",
    }


def _build_answer_to_question_map(
    parsed_records: list[dict[str, Any]],
    candidates_by_answer_uid: dict[str, list[dict[str, str]]],
    overrides: dict[str, str],
    question_uid_set: set[str],
    known_question_ids: set[str],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    resolved: list[dict[str, Any]] = []
    unresolved: list[dict[str, Any]] = []

    for record in parsed_records:
        answer_uid = str(record.get("uid", "")).strip()
        if not answer_uid:
            continue

        override_target = overrides.get(answer_uid)
        candidates = candidates_by_answer_uid.get(answer_uid, [])
        selected, unresolved_item = _resolve_mapping_for_answer(
            answer_uid=answer_uid,
            candidates=candidates,
            override_question_uid=override_target,
            question_uid_set=question_uid_set,
            source_page=str((record.get("source") or {}).get("page", "")),
        )
        if selected:
            selected["id_str"] = record.get("id_str", "")
            selected["volume"] = record.get("volume", "")
            selected["page_no"] = (record.get("source") or {}).get("page", "")
            resolved.append(selected)
            continue

        question_id_hint = extract_gateoverflow_numeric_id(str(record.get("link_hint", ""))) or ""
        unresolved_reason = unresolved_item.get("reason", "no_mapping_to_question") if unresolved_item else "no_mapping_to_question"
        if unresolved_reason == "no_mapping_to_question" and question_id_hint and question_id_hint not in known_question_ids:
            unresolved_reason = "question_id_not_in_questions_dataset"
        if unresolved_reason == "no_mapping_to_question" and not question_id_hint:
            unresolved_reason = "question_id_missing_hint"

        unresolved.append(
            {
                "answer_uid": answer_uid,
                "id_str": record.get("id_str", ""),
                "volume": record.get("volume", ""),
                "page_no": (record.get("source") or {}).get("page", ""),
                "question_id_hint": question_id_hint,
                "reason": unresolved_reason,
                "question_uid_candidates": ";".join(unresolved_item.get("question_uid_candidates", [])) if unresolved_item else "",
            }
        )

    return resolved, unresolved


def _build_answers_by_question_uid(
    parsed_records: list[dict[str, Any]],
    resolved_map: list[dict[str, Any]],
) -> tuple[dict[str, dict[str, Any]], list[dict[str, Any]]]:
    answer_records_by_uid = {str(record.get("uid")): record for record in parsed_records if record.get("uid")}
    by_question_uid: dict[str, dict[str, Any]] = {}
    conflicts: list[dict[str, Any]] = []

    for mapping in resolved_map:
        answer_uid = str(mapping.get("answer_uid", "")).strip()
        question_uid = str(mapping.get("question_uid", "")).strip()
        if not answer_uid or not question_uid:
            continue
        record = answer_records_by_uid.get(answer_uid)
        if not record:
            continue

        answer_payload = {
            "answer_uid": answer_uid,
            "type": record.get("type"),
            "answer": record.get("answer"),
            "tolerance": record.get("tolerance"),
            "source": record.get("source"),
        }
        existing = by_question_uid.get(question_uid)
        if not existing:
            by_question_uid[question_uid] = answer_payload
            continue
        if existing == answer_payload:
            continue
        conflicts.append(
            {
                "question_uid": question_uid,
                "existing_answer_uid": existing.get("answer_uid"),
                "conflicting_answer_uid": answer_uid,
                "reason": "question_uid_multiple_answers",
            }
        )

    return by_question_uid, conflicts


def enrich_questions_with_ids(
    parsed_records_path: str | Path,
    manifest_path: str | Path,
    questions_path: str | Path,
    overrides_path: str | Path,
    out_path: str | Path,
    unresolved_out_path: str | Path,
    answers_by_uid_out_path: str | Path,
    mapping_out_path: str | Path,
) -> tuple[Path, Path, Path]:
    parsed_records = read_json(parsed_records_path).get("records", [])
    manifest = read_json(manifest_path)
    questions = read_json(questions_path)
    overrides = _load_overrides(overrides_path)

    go_id_to_question_uid, question_uid_set = _build_question_indexes(questions)
    candidates_by_answer_uid: dict[str, list[dict[str, str]]] = {}
    _merge_candidates(
        candidates_by_answer_uid,
        _collect_manifest_candidates(manifest=manifest, go_id_to_question_uid=go_id_to_question_uid),
    )
    _merge_candidates(
        candidates_by_answer_uid,
        _collect_record_hint_candidates(parsed_records=parsed_records, go_id_to_question_uid=go_id_to_question_uid),
    )
    _merge_candidates(
        candidates_by_answer_uid,
        _collect_manifest_fuzzy_candidates(
            parsed_records=parsed_records,
            manifest=manifest,
            go_id_to_question_uid=go_id_to_question_uid,
        ),
    )

    known_question_ids = set(go_id_to_question_uid.keys())
    resolved_map, unresolved_map = _build_answer_to_question_map(
        parsed_records=parsed_records,
        candidates_by_answer_uid=candidates_by_answer_uid,
        overrides=overrides,
        question_uid_set=question_uid_set,
        known_question_ids=known_question_ids,
    )

    answers_by_question_uid, mapping_conflicts = _build_answers_by_question_uid(
        parsed_records=parsed_records,
        resolved_map=resolved_map,
    )

    unresolved_in_dataset = [
        row
        for row in unresolved_map
        if row.get("reason") not in {"question_id_not_in_questions_dataset", "question_id_missing_hint"}
    ]
    unresolved_reason_counts: dict[str, int] = {}
    for row in unresolved_map:
        reason = str(row.get("reason", "unknown"))
        unresolved_reason_counts[reason] = unresolved_reason_counts.get(reason, 0) + 1

    mapping_payload = {
        "version": "v1",
        "generated_at": now_iso(),
        "stats": {
            "parsed_records": len(parsed_records),
            "resolved": len(resolved_map),
            "unresolved": len(unresolved_map),
            "unresolved_in_dataset": len(unresolved_in_dataset),
            "mapping_conflicts": len(mapping_conflicts),
            "coverage_ratio": (len(resolved_map) / len(parsed_records)) if parsed_records else 0.0,
            "coverage_ratio_in_dataset": (
                len(resolved_map) / (len(resolved_map) + len(unresolved_in_dataset))
                if (len(resolved_map) + len(unresolved_in_dataset)) > 0
                else 0.0
            ),
            "unresolved_reason_counts": unresolved_reason_counts,
        },
        "resolved": resolved_map,
        "unresolved": unresolved_map,
        "conflicts": mapping_conflicts,
    }

    answers_by_question_uid_payload = {
        "version": "v1",
        "generated_at": now_iso(),
        "stats": {
            "records": len(answers_by_question_uid),
            "mapping_conflicts": len(mapping_conflicts),
        },
        "records_by_question_uid": answers_by_question_uid,
    }

    ensure_dir(Path(out_path).parent)
    write_json(out_path, questions)

    ensure_dir(Path(answers_by_uid_out_path).parent)
    write_json(answers_by_uid_out_path, answers_by_question_uid_payload)

    mapping_out = Path(mapping_out_path)
    ensure_dir(mapping_out.parent)
    write_json(mapping_out, mapping_payload)

    unresolved_out = Path(unresolved_out_path)
    ensure_dir(unresolved_out.parent)
    write_csv(
        unresolved_out,
        unresolved_map,
        fieldnames=[
            "answer_uid",
            "volume",
            "id_str",
            "page_no",
            "question_id_hint",
            "reason",
            "question_uid_candidates",
        ],
    )

    return Path(out_path), unresolved_out, mapping_out


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Enrich question dataset and build answer->question join map.")
    parser.add_argument("--parsed", required=True, help="Path to artifacts/parsed/parsed_records.json")
    parser.add_argument("--manifest", required=True, help="Path to artifacts/answer_pages/manifest.json")
    parser.add_argument("--questions", required=True, help="Path to questions-filtered.json")
    parser.add_argument("--overrides", required=True, help="Path to data/question_id_overrides.json")
    parser.add_argument(
        "--out",
        default="public/questions-filtered-with-ids.json",
        help="Output path for enriched questions JSON.",
    )
    parser.add_argument(
        "--unresolved-out",
        default="artifacts/review/id_mapping_unresolved.csv",
        help="CSV output for unresolved ID mappings.",
    )
    parser.add_argument(
        "--answers-by-uid-out",
        default="data/answers/answers_by_question_uid_v1.json",
        help="Output path for question_uid -> answer table.",
    )
    parser.add_argument(
        "--mapping-out",
        default="data/answers/answer_to_question_map_v1.json",
        help="Output path for answer_uid -> question_uid mapping report.",
    )
    return parser


def main() -> None:
    parser = build_arg_parser()
    args = parser.parse_args()

    out_path, unresolved_path, mapping_path = enrich_questions_with_ids(
        parsed_records_path=args.parsed,
        manifest_path=args.manifest,
        questions_path=args.questions,
        overrides_path=args.overrides,
        out_path=args.out,
        unresolved_out_path=args.unresolved_out,
        answers_by_uid_out_path=args.answers_by_uid_out,
        mapping_out_path=args.mapping_out,
    )
    print(f"Enriched questions written to {out_path}")
    print(f"Question UID join table written to {args.answers_by_uid_out}")
    print(f"Unresolved mapping CSV written to {unresolved_path}")
    print(f"Answer->Question mapping report written to {mapping_path}")


if __name__ == "__main__":
    main()
