# Frontend Guide

> **Plain-English Summary**
> This guide covers how to run the app locally, how the UI layout works across screen sizes, and the exact rules governing the filter system. Read this before touching any filter component, sidebar layout, or URL persistence logic. If you break URL sync, every shared link breaks.

## Local Development

### Prerequisites

- Node.js ≥ 18
- npm ≥ 9

### Commands

```bash
npm install             # Install dependencies
npm start               # Dev server (syncs calculator → public/, opens browser)
npm run build           # Production build → dist/ (includes .nojekyll + calculator sync)
npm run serve           # Preview production build locally
```

### What `npm start` does

1. Runs `sync-calculator.mjs --public` (copies `calculator/` → `public/calculator/`)
2. Starts Vite dev server with `base: /Gate_QA/`

### What `npm run build` does

1. Syncs calculator to `public/`
2. `vite build` → writes to `dist/`
3. `ensure-nojekyll.mjs` → creates `dist/.nojekyll`
4. `sync-calculator.mjs --dist` → copies calculator to `dist/calculator/`

## UI Layout Rules

### All Screen Sizes

- **Single-page app** — no routing, no page navigation.
- **FilterModal** is full-screen overlay triggered by the "Filters" button in the header.
- **No persistent sidebar** — the sidebar only exists inside the modal.
- Main content area is centered (`max-w-[1200px]`) with padding.

### Filter Modal Internals

The `FilterModal` wraps `FilterSidebar` and adds:
- A sticky header with "Filters" title and close button
- A sticky footer with "Show X Questions" button

Inside `FilterSidebar`:
- **Top section**: result count + Reset button
- **Progress section**: horizontal split on `lg+` (progress bar left, toggles right); stacked on mobile
- **Question type** toggles (MCQ / MSQ / NAT)
- **Two-column grid** (`md+`): Topics (left) and Years (right); single column on mobile
- **Year range slider** at bottom
- **Bookmarked count** info text

### Responsive Breakpoints

| Breakpoint | Width | Behavior |
|-----------|-------|----------|
| Default | < 640px | Stacked layout, full-width everything |
| `sm` | ≥ 640px | Minor spacing/font adjustments |
| `md` | ≥ 768px | Topics + Years in 2-column grid |
| `lg` | ≥ 1024px | Progress section goes horizontal (bar left, toggles right) |

## Filter UX Rules

### Auto-Apply

All filters apply immediately on change. There is no "Apply" button inside the sidebar. The modal footer "Show X Questions" button is just a close action — it does not apply anything.

### Filter Chips

Active filters appear as removable pill chips (`ActiveFilterChips.jsx`) above the question card:
- Year chips (blue)
- Year range chip (purple) — only if range ≠ full span
- Topic chips (green)
- Subtopic chips (yellow)
- "Hide solved" chip (emerald)
- "Solved only" chip (indigo)
- "Bookmarked only" chip (orange)
- "Clear all" link resets everything

### Year Range Slider

- Uses `rc-slider` (Range mode) bound to `filters.yearRange`.
- Min/max are computed dynamically from the question dataset.
- The chip only appears when the range differs from the full dataset span.

### Progress Filters — Mutual Exclusion

- **Hide Solved** + **Show Only Solved** are mutually exclusive (enabling one disables the other).
- **Show Only Bookmarked** is independent and can combine with either solved filter.
- All three are reset by `clearFilters()`.

### Question Type Toggles

- Three type buttons: MCQ, MSQ, NAT.
- All ON by default. Clicking toggles individual types on/off.
- Type is resolved via `AnswerService.getAnswerForQuestion(q).type`.
- If all three are selected, the type filter is skipped entirely (optimization).

## URL Persistence

Filter state is serialized to URL query params via `history.replaceState`:

| Param | Format | Example |
|-------|--------|---------|
| `years` | Comma-separated tags | `gate20241,gate20242` |
| `topics` | Comma-separated | `Algorithms,Databases` |
| `subtopics` | Comma-separated | `Sorting,SQL` |
| `range` | `min-max` | `2015-2024` |
| `types` | Comma-separated (only if not all selected) | `MCQ,NAT` |
| `hideSolved` | `1` | `1` |
| `showOnlySolved` | `1` | `1` |
| `showOnlyBookmarked` | `1` | `1` |

**Invariant**: If a filter is at its default value, it is omitted from the URL.

## Debugging

### Empty Results

1. Open browser DevTools → check `window.__gateqa_lookup` for current question identity info.
2. Check active filter chips — a forgotten toggle (Show Only Solved with 0 solved questions) often causes this.
3. Check URL params for corrupted state — manually clear query string as a test.

### Whitelist Filtering Removing Tags

Tags that exist in the data but aren't in `TOPIC_HIERARCHY` will not appear in the Topics filter. This is intentional. To add a missing subtopic, add it to the correct parent in `QuestionService.TOPIC_HIERARCHY`.

### URL Params Not Syncing

- The URL-write `useEffect` only runs after `isInitialized === true`.
- The URL-read `useEffect` runs once on mount (empty dependency array).
- If both run in unexpected order on hot reload, clear the URL manually.

### MathJax Not Rendering

- MathJax config is in `index.html` (global `MathJax` object).
- `MathJaxContext` wraps the entire app in `App.jsx`.
- If rendering fails, check that the question body contains valid LaTeX delimiters (`$...$` or `\(...\)`).

## Safe Refactor Checklist

Before merging any change to filter-related code:

- [ ] URL round-trip: set filters → reload page → same filters are restored
- [ ] `clearFilters()` resets all state to defaults (check URL is clean after)
- [ ] Active filter chips render for every non-default filter
- [ ] Clicking a chip removes only that specific filter
- [ ] Result count in sidebar header matches `filteredQuestions.length`
- [ ] Type filter: deselecting all three types still works (shows 0 results, no crash)
- [ ] Year range slider: dragging handles updates results in real time
- [ ] Progress bar always shows total `solvedCount / totalQuestions` regardless of active filters
- [ ] All keyboard-navigable (Tab through toggles, Enter to activate)
