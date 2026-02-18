# Architecture

> **Plain-English Summary**
> GateQA is a single-page React app hosted on GitHub Pages. It loads a static JSON file of GATE CS questions at startup, indexes them in memory, and lets users filter by year, topic, type, and progress state. All state lives in the browser — there is no backend, no database, and no login. Filters sync to the URL so links are shareable.

## High-Level Diagram

```
┌──────────────────────────────────────────────────────────────┐
│  GitHub Pages (static hosting)                               │
│                                                              │
│  dist/                                                       │
│   ├── index.html          (SPA entry, MathJax config)        │
│   ├── assets/             (Vite-hashed JS/CSS bundles)       │
│   ├── questions-with-answers.json   (primary data)           │
│   ├── data/answers/       (answer lookup JSONs)              │
│   ├── calculator/         (TCS scientific calculator)        │
│   └── .nojekyll           (disables Jekyll processing)       │
└──────────────────────┬───────────────────────────────────────┘
                       │  fetch() on app load
                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Browser Runtime                                                    │
│                                                                     │
│  ┌─────────────────┐    ┌──────────────────┐                        │
│  │ QuestionService  │───▶│  FilterContext    │──▶ UI Components      │
│  │ (static class)   │    │ (React Context)  │                        │
│  │                  │    │                  │    ┌────────────────┐  │
│  │ • questions[]    │    │ • filters{}      │───▶│ FilterModal    │  │
│  │ • TOPIC_HIERARCHY│    │ • filteredQs[]   │    │ FilterSidebar  │  │
│  │ • tags, counts   │    │ • solvedIds[]    │    │ ActiveChips    │  │
│  │ • year parsing   │    │ • bookmarkedIds[]│    │ ProgressBar    │  │
│  └─────────────────┘    │ • URL sync       │    └────────────────┘  │
│                          └──────────────────┘                        │
│  ┌─────────────────┐                            ┌────────────────┐  │
│  │ AnswerService    │                            │ Question card  │  │
│  │ (static class)   │ ◄──────────────────────── │ AnswerPanel    │  │
│  │ • multi-index    │                            │ StatusControls │  │
│  │   answer lookup  │                            └────────────────┘  │
│  └─────────────────┘                                                │
│                                                                     │
│  localStorage: solved IDs, bookmarked IDs, progress metadata        │
│  URL query params: years, topics, types, range, hideSolved, etc.    │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Flow

1. **App mount** → `QuestionService.init()` fetches the best available JSON (tries `questions-with-answers.json` first, falls back to alternatives based on join-identity coverage).
2. **Normalization** → Each question gets a deterministic `question_uid` (from GateOverflow ID, or FNV-1a hash fallback). Tags are preserved as-is.
3. **`AnswerService.init()`** → Loads four answer files into three lookup maps (`byQuestionUid`, `byUid`, `byExamUid`) plus an unsupported-questions set.
4. **`FilterContext`** reads `QuestionService.questions[]` and applies filter pipeline on every `filters` state change:
   - Progress filters: `hideSolved`, `showOnlySolved`, `showOnlyBookmarked`
   - Type filter: MCQ / MSQ / NAT (via `AnswerService.getAnswerForQuestion`)
   - Year tag filter + year range slider
   - Topic / subtopic filter (uses `TOPIC_HIERARCHY` whitelist + `normalizeString` matching)
5. **URL sync** → `filters` state is serialized to `window.location.search` via `replaceState`.
6. **UI render** → `filteredQuestions[]` drives a random-question picker and result count display.

## Key Invariants (Must Not Break)

| Rule | Why it matters |
|------|----------------|
| `TOPIC_HIERARCHY` is the single source of truth for valid subtopics. Tags not in this whitelist are silently excluded from filters. | Prevents mock/coaching tags from appearing in the UI. |
| Year tags follow the pattern `gate{YYYY}` or `gate{YYYY}{set}`. The display format is `"2025 Set 1"`, never `"20251"`. | `getStructuredTags()` deduplicates — if set-specific tags exist, the generic `gate2024` tag is excluded. |
| `hideSolved` and `showOnlySolved` are mutually exclusive. Enabling one disables the other. | They are logical opposites; both ON would yield zero results. |
| `clearFilters()` resets **all** filters including progress toggles to default (off). | This is the user's escape hatch. |
| `base` in `vite.config.js` **must** equal `/Gate_QA/` for GitHub Pages. | All `fetch()` calls use `import.meta.env.BASE_URL` to construct URLs. Wrong base → 404 on data files. |
| `.nojekyll` must exist in `dist/`. | The build script creates it via `ensure-nojekyll.mjs`. Without it, GitHub Pages may skip files starting with `_`. |

## Performance Notes

- **3400+ questions** are loaded into memory and filtered on every state change. The filter pipeline is a single `Array.filter()` pass — O(n) per change.
- `solvedQuestionSet` and `bookmarkedQuestionSet` are `useMemo`'d `Set` objects for O(1) lookup during filtering.
- `normalizeSelectedTypes` is called frequently; it returns a cached-format array (ordered, deduped).
- No debouncing on filter changes currently. If filter state is changed rapidly (e.g., clicking many year chips), React batches the updates but the filter loop runs on each committed state.

## Common Changes Guide

| I want to… | Where to modify |
|-------------|-----------------|
| Add a new filter dimension (e.g., marks) | Add state to `filters` in `FilterContext.jsx` → add filter logic in the `useEffect` filtering pipeline → add URL param serialization → add UI toggle in `FilterSidebar.jsx` → add chip in `ActiveFilterChips.jsx` |
| Add a new year parsing rule | Modify `getStructuredTags()` in `QuestionService.js` (year detection and grouping logic around line 386–425) |
| Add a new topic or subtopic to the whitelist | Add the entry to `TOPIC_HIERARCHY` in `QuestionService.js` (line 232–346). The subtopic must appear as a tag in the question data to be displayed. |
| Change the data source URL | Modify the `dataCandidates` array in `QuestionService.init()` |
| Add a new answer lookup strategy | Add a new index in `AnswerService.init()`, then add a lookup step in `getAnswerForQuestion()` |
| Persist a new filter in the URL | Add serialization in the URL-sync `useEffect` (line ~190) and parsing in the URL-read `useEffect` (line ~157) in `FilterContext.jsx` |
