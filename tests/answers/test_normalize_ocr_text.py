import json
from pathlib import Path

from scripts.answers.normalize_ocr_text import normalize_ocr_lines


FIXTURE_PATH = Path("tests/answers/fixtures/noisy_lines.json")


def _load_fixture():
    with FIXTURE_PATH.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def test_normalization_cases_from_fixture():
    payload = _load_fixture()
    meta = {"volume": 2, "page_no": 91}

    for case in payload["normalization_cases"]:
        rows, suspicious = normalize_ocr_lines(case["lines"], meta=meta)
        expected_rows = case["expected_rows"]
        assert len(rows) == len(expected_rows), f"failed case: {case['name']}"
        assert not suspicious, f"unexpected suspicious lines for case: {case['name']}"
        for row, expected in zip(rows, expected_rows):
            assert row["id_str"] == expected["id_str"], f"failed case: {case['name']}"
            assert row["answer_raw"] == expected["answer_raw"], f"failed case: {case['name']}"


def test_id_without_answer_goes_to_suspicious():
    meta = {"volume": 1, "page_no": 10}
    lines = [{"line_index": 0, "text": "1.24.30"}]
    rows, suspicious = normalize_ocr_lines(lines, meta=meta)
    assert rows == []
    assert len(suspicious) == 1
    assert suspicious[0]["reason"] == "id_without_answer"


def test_orphan_answer_goes_to_suspicious():
    meta = {"volume": 1, "page_no": 10}
    lines = [{"line_index": 0, "text": "A;B;C"}]
    rows, suspicious = normalize_ocr_lines(lines, meta=meta)
    assert rows == []
    assert len(suspicious) == 1
    assert suspicious[0]["reason"] == "orphan_answer_without_id"

