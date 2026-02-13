## GATE_QA

Random GATE CSE question practice app (React frontend + Python scraper pipeline).

## Project Structure

- `src/`: Core React app code (components, services, utilities).
- `scripts/`: Automation scripts.
- `scripts/answers/`: OCR, parsing, mapping, validation, and answer database builders.
- `scripts/deployment/`: Build/deploy helpers (for example `ensure-nojekyll.mjs`).
- `scraper/`: Scrapy/Python data acquisition pipeline.
- `data/`: Versioned static datasets and answer metadata.
- `artifacts/`: Intermediate processing outputs and review reports.
- `tests/`: Pytest suites for answer-processing logic.
- `public/`: Static frontend assets and published JSON bundles.
- `.github/workflows/`: CI/build/deploy workflows.

## Local Development

1. Install frontend dependencies:

```bash
npm install
```

2. Start app:

```bash
npm start
```

3. Build production bundle:

```bash
npm run build
```

## Offline Answer Extraction Pipeline (OCR)

This repo includes a local-only OCR pipeline that extracts answer keys from scanned PDFs and generates versioned static JSON.

### Setup

```bash
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
```

Preferred OCR engine:

```bash
pip install paddleocr
```

Optional fallback OCR path:

```bash
pip install pytesseract pillow
```

Install Tesseract OCR binary locally if you use `--ocr-engine tesseract` (default in this repo on Windows).

### Run one-command build

```bash
python scripts/answers/build_answers_db.py \
  --vol1 c:/Users/himanshu/Desktop/PYQs/volume1.pdf \
  --vol2 c:/Users/himanshu/Desktop/PYQs/volume2.pdf \
  --subject-map data/subject_map.json \
  --merge-questions-with-answers
```

Useful options:

- `--ocr-engine tesseract|paddle`
- `--normalization-profile data/answers/ocr_profile_tesseract.json`
- `--questions public/questions-filtered.json`
- `--dpi 400 --crop-top 0.05 --crop-bottom 0.05 --crop-left 0.03 --crop-right 0.03`
- `--ocr-preprocess-mode threshold --ocr-threshold 165 --ocr-denoise-radius 3 --ocr-scale 1.3`

### Generated outputs

- `data/answers/answers_master_v1.json`
- `data/answers/answers_master_v1.csv`
- `data/answers/answers_by_question_uid_v1.json`
- `data/answers/answer_to_question_map_v1.json`
- `data/answers/manual_answers_patch_v1.json` (manual last-mile overrides)
- `artifacts/review/suspicious_lines.csv`
- `artifacts/review/id_mapping_unresolved.csv`
- `artifacts/review/questions_missing_answers.csv`
- `artifacts/review/error_report.json`
- `artifacts/review/coverage_report.json`
- `artifacts/review/validation_report.json`
- `public/questions-filtered-with-ids.json`
- `public/questions-with-answers.json` (when `--merge-questions-with-answers` is passed)
- `public/data/answers/answers_master_v1.json` (frontend fetch target copy)
- `public/data/answers/answers_by_question_uid_v1.json` (frontend join table)

Frontend usage:

- `QuestionService` ensures every question has a deterministic `question_uid`.
- `AnswerService` loads `public/data/answers/answers_by_question_uid_v1.json` first, then falls back to `answers_master_v1.json` (URLs are built with `import.meta.env.BASE_URL` for GitHub Pages path safety).
- `AnswerPanel` evaluates MCQ/MSQ/NAT client-side and stores progress/bookmarks in localStorage.

### Update answers workflow

1. Update `data/subject_map.json` if answer-key pages moved.
2. Run `python scripts/answers/build_answers_db.py ...`.
3. Review `artifacts/review/suspicious_lines.csv`.
4. Review `artifacts/review/id_mapping_unresolved.csv`.
5. Review `artifacts/review/questions_missing_answers.csv`.
6. Add mapping fixes in `data/question_id_overrides.json` if needed.
7. Add stubborn final fixes in `data/answers/manual_answers_patch_v1.json` if needed.
8. Re-run until validation passes.
9. Commit updated JSON artifacts.

Override file supports either format:

- `uid_to_question_id` (numeric GateOverflow IDs, auto-converted to `go:<id>`)
- `uid_to_question_uid` (direct `go:<id>` / `local:<hash>`)

If unresolved rows contain `question_id_hint` values that are not present in `public/questions-filtered.json`, those cannot be auto-mapped via overrides until the question dataset includes those IDs or you provide explicit `uid_to_question_uid` targets.

Manual patch format (`data/answers/manual_answers_patch_v1.json`):

- Keyed by `question_uid`
- Supports:
  - `{"type":"MCQ","answer":"A"}`
  - `{"type":"MSQ","answer":["A","C"]}`
  - `{"type":"NAT","value":2.32,"tolerance":{"abs":0.01}}`

### Manual Resolution System

For questions that are subjective, ambiguous, or need non-standard answers, use `data/answers/manual_resolutions_v1.json`. This file is merged with highest priority.

**workflow:**
1. Generate missing report:
   ```bash
   python scripts/answers/generate_missing_report.py \
     --questions public/questions-filtered-with-ids.json \
     --answers data/answers/answers_by_question_uid_v1.json \
     --out artifacts/review/manual_review_v1.csv
   ```
2. Edit `artifacts/review/manual_review_v1.csv` to add `resolution_type` (`SUBJECTIVE`, `AMBIGUOUS`, `MCQ`, `MSQ`, `NAT`) and `value`.
3. Apply resolutions:
   ```bash
   python scripts/answers/apply_resolutions.py \
     --csv artifacts/review/manual_review_v1.csv \
     --json data/answers/manual_resolutions_v1.json
   ```
4. Re-run `scripts/answers/build_answers_db.py`.

### Validation gates

Validation fails when configured thresholds are breached in `data/answers/validation_config.json`, including:

- parse rate (`min_parse_rate`)
- suspicious ratio (`max_suspicious_ratio`)
- mapping coverage/conflicts (`min_mapping_coverage_ratio`, `max_mapping_conflicts`)
- unresolved in-dataset mappings (`max_unresolved_mappings`)
- missing answers report threshold (`max_questions_missing_answers`)
- per-subject coverage mismatch (`max_coverage_mismatch_ratio`)

`min_mapping_coverage_ratio` is evaluated using `coverage_ratio_in_dataset` from `data/answers/answer_to_question_map_v1.json` (rows whose hint IDs are absent from `questions-filtered.json` are tracked separately as `question_id_not_in_questions_dataset`).

To enable strict per-subject coverage validation, populate `data/answers/subject_question_counts.json` with expected counts for each `v1`/`v2` subject code.

## How to Update Question Bank

### Option A: Automated (Recommended)
This repo includes a GitHub Action `scraper.yml` that runs **automatically every 4 months**.
To trigger it manually:
1. Go to **Actions** tab in GitHub.
2. Select **Automate Scraper** workflow.
3. Click **Run workflow**.
4. Wait for it to finish -> It will create a Pull Request with new questions.
5. Merge the PR.

## Build Scripts

All answer-processing scripts are now modularized in `scripts/answers/`.

### 1. Offline Answer Extraction Pipeline
**Goal:** Extract answer keys from PDFs, clean them, and link them to Question IDs.

```powershell
# Run the full end-to-end pipeline (Windows PowerShell)
.venv\Scripts\python.exe scripts/answers/build_answers_db.py `
  --vol1 "path/to/volume1.pdf" `
  --vol2 "path/to/volume2.pdf" `
  --subject-map data/subject_map.json `
  --ocr-engine tesseract `
  --merge-questions-with-answers
```

### 2. Frontend Build
```bash
npm run build
# The build script automatically runs ensuring .nojekyll exists
```

