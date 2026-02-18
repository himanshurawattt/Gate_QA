# Repository Structure

## Project Root

```
Gate_QA/
├── index.html                  # SPA entry point (MathJax config, analytics)
├── package.json                # Dependencies, scripts (start, build, serve)
├── vite.config.js              # Vite config (base: /Gate_QA/, output: dist/)
├── tailwind.config.js          # Tailwind v3 config (src/**/*.{js,jsx})
├── postcss.config.js           # PostCSS (tailwindcss + autoprefixer)
│
├── src/                        # ── React Application ──
│   ├── index.jsx               # ReactDOM entry, StrictMode wrapper
│   ├── index.css               # Tailwind directives + global styles
│   ├── App.jsx                 # Root component: init services, routing, layout
│   │
│   ├── contexts/
│   │   └── FilterContext.jsx   # All filter state, progress tracking, URL sync
│   │
│   ├── services/
│   │   ├── QuestionService.js      # Data loader, TOPIC_HIERARCHY, tag indexing
│   │   ├── QuestionService.test.js # Unit tests for question parsing
│   │   ├── AnswerService.js        # Multi-index answer lookup (3 join strategies)
│   │   └── AnswerService.test.js   # Unit tests for answer resolution
│   │
│   ├── utils/
│   │   ├── evaluateAnswer.js   # Answer comparison logic (MCQ/NAT tolerance)
│   │   └── examUid.js          # Exam UID extraction from question metadata
│   │
│   └── components/
│       ├── Header/
│       │   └── Header.jsx      # Sticky header: logo, title, filter + calc buttons
│       ├── Footer/
│       │   └── Footer.jsx      # App footer
│       ├── Question/
│       │   └── Question.jsx    # Question card (title, body, tags, next button)
│       ├── AnswerPanel/
│       │   └── AnswerPanel.jsx # Answer display + evaluation
│       ├── QuestionStatusControls/
│       │   └── QuestionStatusControls.jsx  # Solved checkbox, bookmark star
│       ├── Calculator/
│       │   └── CalculatorWidget.jsx / CalculatorButton.jsx
│       ├── FilterTags/
│       │   └── FilterTags.jsx  # (Legacy) tag display component
│       └── Filters/
│           ├── FilterModal.jsx         # Full-screen modal wrapper
│           ├── FilterSidebar.jsx       # Main filter panel layout
│           ├── FilterSection.jsx       # Collapsible section container
│           ├── TopicFilter.jsx         # Topic + subtopic tree checkboxes
│           ├── YearFilter.jsx          # Year tag checkboxes
│           ├── YearRangeFilter.jsx     # rc-slider year range
│           ├── ProgressBar.jsx         # Solved count bar + stats
│           ├── ProgressFilterToggles.jsx # Hide/Show solved + bookmarked toggles
│           └── ActiveFilterChips.jsx   # Active filter pills with remove buttons
│
├── public/                     # ── Static Assets (copied to dist/) ──
│   ├── .nojekyll               # Prevents GitHub Pages Jekyll processing
│   ├── logo.png                # App favicon + header logo
│   ├── questions-with-answers.json     # Primary question dataset (~3.8 MB)
│   ├── questions-filtered-with-ids.json # Enriched dataset with UIDs
│   ├── questions-filtered.json         # Base filtered dataset
│   ├── calculator/             # TCS scientific calculator (standalone HTML/JS/CSS)
│   └── data/
│       └── answers/
│           ├── answers_by_question_uid_v1.json  # question_uid → answer map
│           ├── answers_master_v1.json           # Master answer records
│           ├── answers_by_exam_uid_v1.json      # exam_uid → answer map
│           └── unsupported_question_uids_v1.json # Known unparseable questions
│
├── calculator/                 # ── Calculator Source ──
│   └── (HTML/JS/CSS files)     # Synced to public/ and dist/ by build script
│
├── scraper/                    # ── Question Scraper (Python) ──
│   ├── scrape_gateoverflow.py  # Fetches questions from GateOverflow
│   ├── merge_questions.py      # Deduplicates and normalizes scraped data
│   ├── list_tags.py            # Debug: print all unique tags
│   ├── debug_filters.py        # Debug: test filtering rules
│   ├── question_schema.json    # JSON schema for a question object
│   └── requirements.txt       # Python dependencies (requests, beautifulsoup4)
│
├── scripts/                    # ── Build + Data Scripts ──
│   ├── deployment/
│   │   ├── ensure-nojekyll.mjs     # Post-build: create dist/.nojekyll
│   │   └── sync-calculator.mjs     # Copy calculator/ to public/ or dist/
│   ├── answers/                    # Answer pipeline scripts (Python)
│   │   ├── build_answers_db.py     # Master answer database builder
│   │   ├── build_answers_by_exam_uid.py
│   │   ├── enrich_questions_with_ids.py
│   │   ├── parse_answer_key.py
│   │   ├── validate_answers.py
│   │   └── (other pipeline scripts)
│   ├── analyze_questions.py
│   └── analyze_types.py
│
├── tests/                      # ── Test Files ──
│   └── answers/                # Answer-related test data
│
├── .github/
│   └── workflows/
│       └── scraper.yml         # Scheduled scraper (every 4 months) + auto-PR
│
├── docs/                       # ── Developer Docs (gitignored) ──
│   ├── ARCHITECTURE.md
│   ├── REPO_STRUCTURE.md       # ← You are here
│   ├── FRONTEND_GUIDE.md
│   ├── DATA_PIPELINE.md
│   ├── DEPLOYMENT.md
│   ├── TESTING.md
│   ├── CONTRIBUTING.md
│   └── CHANGELOG.md
│
└── artifacts/                  # ── Generated Artifacts (gitignored) ──
    └── (OCR pages, parsed answers, normalized text)
```

## Where to Find X

| Looking for… | Location |
|-------------|----------|
| Filter state & logic | `src/contexts/FilterContext.jsx` |
| Filter UI components | `src/components/Filters/` |
| Question data loading | `src/services/QuestionService.js` |
| Answer resolution | `src/services/AnswerService.js` |
| Topic whitelist | `QuestionService.TOPIC_HIERARCHY` (line 232) |
| Progress tracking (solved/bookmarked) | `FilterContext.jsx` (localStorage keys, toggle functions) |
| Deployment config | `vite.config.js` (base path), `package.json` (build script) |
| Build helpers | `scripts/deployment/` |
| Answer data pipeline | `scripts/answers/` |
| Scraper automation | `.github/workflows/scraper.yml` |
| Static data files | `public/` (questions JSON, answer JSONs) |
| Calculator | `calculator/` (source), `public/calculator/` (synced copy) |
