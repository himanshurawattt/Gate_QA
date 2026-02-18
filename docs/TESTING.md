# Testing

## Current Test Coverage

Unit tests exist for services only:

| File | Tests |
|------|-------|
| `src/services/QuestionService.test.js` | Question UID generation, normalization, tag parsing |
| `src/services/AnswerService.test.js` | Answer lookup resolution, identity extraction, multi-index join |

Run existing tests:
```bash
npx vitest run           # One-shot run
npx vitest               # Watch mode
```

## Manual QA Checklist

### Filter Functionality

- [ ] **Default state**: All types selected (MCQ, MSQ, NAT), no year/topic selection, full year range, all progress toggles OFF
- [ ] **Type toggles**: Deselect MCQ → only MSQ+NAT questions shown. Re-select → MCQ questions return.
- [ ] **Year selection**: Click a year checkbox → only that year's questions shown. Count updates.
- [ ] **Year range slider**: Drag handles → results filter to range. Chip appears if range ≠ full span.
- [ ] **Topic filter**: Select a topic → only questions with matching tags shown. Subtopics expand.
- [ ] **Subtopic filter**: Select a subtopic → narrows within the parent topic.
- [ ] **Hide Solved**: Toggle ON → solved questions disappear. Toggle OFF → they return.
- [ ] **Show Only Solved**: Toggle ON → only solved questions shown. "Hide Solved" auto-disables.
- [ ] **Show Only Bookmarked**: Toggle ON → only bookmarked questions shown. Works with either solved toggle.
- [ ] **Combined filters**: Type=MCQ + Year=2024 + Topic=Algorithms → results are the intersection. Count is correct.
- [ ] **Clear All**: Click "Clear all" chip or "Reset" button → all filters reset, URL params cleared.
- [ ] **Empty results**: Set impossible filter combo → "No questions match your filters" message appears (no crash).

### URL Persistence

- [ ] Set filters → copy URL → open in new tab → same filters are active
- [ ] Set filters → reload page → same filters are restored
- [ ] Clear all filters → URL has no query params
- [ ] Only non-default filters appear as URL params (no `types=MCQ,MSQ,NAT` when all are selected)

### Active Filter Chips

- [ ] Each active filter has a visible chip above the question card
- [ ] Clicking × on a chip removes only that filter
- [ ] "Clear all" removes all chips and resets URL
- [ ] Chip colors are distinct per filter type (blue=year, green=topic, etc.)

### Progress Tracking

- [ ] Mark question as solved → counter increments, progress bar updates
- [ ] Bookmark question → star fills, bookmarked count updates
- [ ] Refresh page → solved/bookmarked state persists (localStorage)
- [ ] Progress bar always shows `solvedCount / totalQuestions` (not affected by active filters)

### Responsive Layout

| Test | Expected |
|------|----------|
| Desktop (≥ 1024px) | Filter modal: progress bar left, toggles right (horizontal split) |
| Desktop (≥ 768px) | Filter modal: Topics + Years in 2-column grid |
| Mobile (< 768px) | Filter modal: everything stacked vertically |
| Mobile | Modal has "Show X Questions" footer button |
| All widths | No horizontal overflow, no clipped content |

### Calculator

- [ ] Click calculator button in header → calculator opens
- [ ] `Ctrl+K` → calculator toggles
- [ ] `Escape` → calculator closes
- [ ] Drag calculator by header → smooth repositioning (no lag)
- [ ] Calculator does not close when clicking elsewhere on the page

### Cross-Browser Quick Checks

| Browser | Check |
|---------|-------|
| Chrome (latest) | Full test pass |
| Firefox (latest) | Filter toggles, MathJax rendering, year slider |
| Safari (latest) | localStorage persistence, CSS layout, MathJax |

## Performance Sanity

| Metric | Target | How to measure |
|--------|--------|----------------|
| Initial data load | < 3s on 4G | DevTools → Network → questions-with-answers.json |
| Filter change → UI update | < 100ms | DevTools → Performance → record a filter toggle |
| MathJax render (single question) | < 500ms | Visual — no visible reflow after initial paint |

## Unit Test Targets (Future)

Priority targets for automated tests:

### QuestionService

- [ ] `buildQuestionUid()`: deterministic UID from GO link, from metadata, from hash
- [ ] `normalizeQuestion()`: fills defaults, assigns UID
- [ ] `getStructuredTags()`: year deduplication (generic vs set-specific), subtopic whitelist filtering
- [ ] `init()`: picks highest join-coverage candidate

### FilterContext

- [ ] URL read → state: parse `?types=MCQ&hideSolved=1` correctly
- [ ] State → URL write: only non-default values serialized
- [ ] Mutual exclusion: enabling `showOnlySolved` disables `hideSolved`
- [ ] `clearFilters()`: returns to exact default state
- [ ] Filter pipeline: each filter dimension independently correct

### AnswerService

- [ ] Multi-index resolution: `question_uid` lookup → `answer_uid` fallback → `exam_uid` fallback
- [ ] Unsupported question detection: returns `type: "UNSUPPORTED"` sentinel
- [ ] `getStorageKeyForQuestion()`: returns best available UID
