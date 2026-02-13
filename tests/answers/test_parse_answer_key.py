import json
from pathlib import Path

from scripts.answers.parse_answer_key import parse_answer_token, parse_normalized_row


FIXTURE_PATH = Path("tests/answers/fixtures/parsed_expected.json")


def _load_fixture():
    with FIXTURE_PATH.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def test_valid_parse_cases_from_fixture():
    payload = _load_fixture()
    for case in payload["valid_parse_cases"]:
        parsed, reason = parse_answer_token(case["token"])
        assert reason is None, f"failed case: {case['name']}"
        assert parsed is not None, f"failed case: {case['name']}"
        assert parsed["type"] == case["expected_type"], f"failed case: {case['name']}"
        assert parsed["answer"] == case["expected_answer"], f"failed case: {case['name']}"


def test_invalid_parse_cases_from_fixture():
    payload = _load_fixture()
    for case in payload["invalid_parse_cases"]:
        parsed, reason = parse_answer_token(case["token"])
        assert parsed is None, f"failed case: {case['name']}"
        assert reason == case["expected_reason"], f"failed case: {case['name']}"


def test_parse_normalized_row_nat_includes_tolerance():
    row = {
        "id_str": "1.27.26",
        "answer_raw": "2.32",
        "source_line_indexes": [5],
        "raw_text": "1.27.26 2.32",
        "normalized_text": "1.27.26 2.32"
    }
    source = {
        "volume": 1,
        "page_no": 91,
        "id_url_pairs": []
    }
    record, suspicious = parse_normalized_row(row=row, source_meta=source, nat_tolerance_abs=0.01)
    assert suspicious is None
    assert record is not None
    assert record["type"] == "NAT"
    assert record["tolerance"] == {"abs": 0.01}


def test_parse_normalized_row_rejects_invalid_id():
    row = {
        "id_str": "bad-id",
        "answer_raw": "A",
        "source_line_indexes": [1],
        "raw_text": "bad-id A",
        "normalized_text": "bad-id A"
    }
    source = {"volume": 2, "page_no": 10, "id_url_pairs": []}
    record, suspicious = parse_normalized_row(row=row, source_meta=source)
    assert record is None
    assert suspicious is not None
    assert suspicious["reason"] == "invalid_id_format"

