# Data Pipeline

## Overview

The question dataset is produced through a multi-stage pipeline that scrapes, normalizes, enriches, and validates question + answer data. The final outputs are static JSON files consumed by the React frontend at runtime.

**Key principle**: The frontend only reads static JSON from `public/`. All pipeline scripts are offline tools that run locally or in CI. No backend is involved at runtime.

## Pipeline Stages

```
Stage 1: SCRAPE        Stage 2: ENRICH         Stage 3: ANSWERS         Stage 4: OUTPUT
─────────────────      ─────────────────       ──────────────────       ─────────────────
GateOverflow.in        Raw questions JSON      Answer key PDFs          public/ JSON files
      │                      │                  (external source)            │
      ▼                      ▼                       │                      ▼
  scraper/              scripts/answers/             ▼                  Frontend reads
  scrape_gateoverflow   enrich_questions_       parse_answer_key.py     at runtime
      │                 with_ids.py             ocr_answer_pages.py
      ▼                      │                       │
  scraper/                   ▼                       ▼
  merge_questions.py    questions-filtered-     build_answers_db.py
      │                 with-ids.json           build_answers_by_
      ▼                                         exam_uid.py
  questions-                                         │
  filtered.json                                      ▼
                                                data/answers/
                                                *.v1.json
```

## Stage Details

### Stage 1: Scraping (`scraper/`)

| Script | Purpose |
|--------|---------|
| `scrape_gateoverflow.py` | Fetches question pages from GateOverflow.in. Outputs raw JSON array. |
| `merge_questions.py` | Deduplicates, normalizes tags, removes invalid entries. Outputs `questions-filtered.json`. |

- Automated via GitHub Actions (`.github/workflows/scraper.yml`): runs every 4 months or on manual dispatch.
- On changes, the workflow creates a PR with the updated `questions-filtered.json`.

### Stage 2: Enrichment (`scripts/answers/`)

| Script | Purpose |
|--------|---------|
| `enrich_questions_with_ids.py` | Adds `question_uid` fields to each question. Outputs `questions-filtered-with-ids.json`. |
| `merge_answers_into_questions.py` | Merges answer data directly into question objects. Outputs `questions-with-answers.json`. |

### Stage 3: Answer Processing (`scripts/answers/`)

| Script | Purpose |
|--------|---------|
| `extract_answer_pages.py` | Extracts individual pages from answer key PDFs. |
| `ocr_answer_pages.py` | Runs OCR on extracted pages. |
| `normalize_ocr_text.py` | Cleans and normalizes raw OCR text. |
| `parse_answer_key.py` | Parses normalized text into structured answer records. |
| `build_answers_db.py` | Builds the master answer database (`answers_master_v1.json`). |
| `build_answers_by_exam_uid.py` | Builds the exam-UID-indexed lookup (`answers_by_exam_uid_v1.json`). |
| `build_unsupported_questions.py` | Generates the unsupported questions list. |
| `validate_answers.py` | Cross-validates answers against multiple sources. |
| `backfill_gateoverflow_answers.py` | Fills gaps from GateOverflow community answers. |

### Stage 4: Output Files (in `public/`)

| File | Size | Description |
|------|------|-------------|
| `questions-with-answers.json` | ~3.8 MB | Primary dataset (questions + embedded answers). Preferred by `QuestionService`. |
| `questions-filtered-with-ids.json` | ~3.1 MB | Questions with UIDs but no embedded answers. Fallback. |
| `questions-filtered.json` | ~3.0 MB | Base dataset. Last-resort fallback. |
| `data/answers/answers_by_question_uid_v1.json` | ~0.9 MB | `question_uid → answer` lookup. |
| `data/answers/answers_master_v1.json` | ~1.2 MB | Full answer records by `answer_uid`. |
| `data/answers/answers_by_exam_uid_v1.json` | ~0.7 MB | `exam_uid → answer` lookup. |
| `data/answers/unsupported_question_uids_v1.json` | ~18 KB | Known unparseable/unsupported questions. |

## Tag Whitelisting (Why It Exists)

Question tags from scraped sources often include noise: coaching site names, mock test identifiers, and unrelated metadata. `QuestionService.TOPIC_HIERARCHY` is a strict whitelist of **382 subtopics** organized under 12 parent topics.

**Rules**:
- Only tags that normalize-match an entry in `TOPIC_HIERARCHY` appear in the Topics filter.
- Tags are never removed from the data — they're just excluded from the filter UI.
- To add a new valid subtopic: add it to the appropriate parent array in `TOPIC_HIERARCHY`.

## Year Tag Format

Tags like `gate2024`, `gate20241`, `gate20242` represent years and sets:
- `gate2024` → "2024" (generic, no sets)
- `gate20241` → "2024 Set 1"
- `gate20242` → "2024 Set 2"

If set-specific tags exist for a year, the generic tag is suppressed from the year filter.

## Answer Join Strategy

`AnswerService` tries three indexes in order:
1. `question_uid` (e.g., `go:12345`) → `answers_by_question_uid_v1.json`
2. `answer_uid` (e.g., `v1:CS-2024-Q42`) → `answers_master_v1.json`
3. `exam_uid` (e.g., `GATE-CS-2024-42`) → `answers_by_exam_uid_v1.json`

If none match, it checks the unsupported list and returns a sentinel `type: "UNSUPPORTED"` record.

## Running the Pipeline Locally

```bash
# Prerequisites: Python 3.9+, pip install -r requirements.txt

# Step 1: Scrape (or use existing data)
python scraper/scrape_gateoverflow.py
python scraper/merge_questions.py

# Step 2: Enrich with IDs
python scripts/answers/enrich_questions_with_ids.py

# Step 3: Build answer databases (requires source answer files in artifacts/)
python scripts/answers/build_answers_db.py
python scripts/answers/build_answers_by_exam_uid.py

# Step 4: Merge answers into questions
python scripts/answers/merge_answers_into_questions.py

# Step 5: Validate
python scripts/answers/validate_answers.py
```

> **Note**: Steps 3–5 require answer source files (PDFs, OCR artifacts) that are not checked into the repository. These are generated locally and the resulting JSON files are committed to `public/`.
