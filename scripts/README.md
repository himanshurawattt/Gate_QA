# Scripts Directory

Automation scripts are organized by purpose:

- `scripts/answers/`: Answer-key OCR/parsing pipeline, answer mapping, validation, and merge utilities.
- `scripts/deployment/`: Frontend deployment helpers (`ensure-nojekyll.mjs`).

Usage notes:

- Run scripts from the repository root so default relative paths resolve correctly.
- Prefer invoking Python modules from `scripts/answers/` directly, for example:
  - `python scripts/answers/build_answers_db.py ...`
