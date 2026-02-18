# Changelog

All notable changes to GateQA are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Planned
- Deep link to individual questions (shareable question URLs)
- Keyboard shortcuts for navigation (next question, toggle answer, etc.)
- PWA support (offline access, installable)

---

## [1.3.0] - 2026-02-18

### Added
- **Show Only Solved filter**: new toggle to display only solved questions (inverse of Hide Solved)
- **Mutual exclusion rule**: Hide Solved and Show Only Solved automatically disable each other
- **Compact progress layout**: progress bar (left) and filter toggles (right) in horizontal split on desktop
- Active filter chip for "Solved only" (indigo color) with click-to-remove
- `showOnlySolved` state persisted in URL query params
- `showOnlySolved` included in `clearFilters()` reset

### Changed
- Progress section uses `lg` breakpoint for horizontal split (was at bottom of sidebar)
- Progress filter toggles moved from bottom of sidebar to beside progress bar
- ProgressBar component accepts `className` prop for external layout control

---

## [1.2.0] - 2026-02-15

### Added
- Comprehensive developer documentation (`docs/` folder, 8 files)
- README.md with project overview and quick start

---

## [1.1.0] - 2026-02-13

### Added
- TCS Scientific Calculator widget (draggable, toggle via Ctrl+K)
- Calculator button in header with keyboard shortcut indicator
- Glassmorphism modal styling for calculator and support dialogs

### Fixed
- Calculator drag performance (60fps smooth dragging)
- Calculator persistence (no longer closes on outside click)

---

## [1.0.0] - 2026-02-11

### Added
- **Filter system**: multi-dimensional filtering by year, topic, subtopic, question type (MCQ/MSQ/NAT), and year range
- **FilterContext**: centralized filter state with URL query param persistence
- **QuestionService**: data loader with fallback candidate selection, tag indexing, and `TOPIC_HIERARCHY` whitelist (382 subtopics under 12 parent topics)
- **AnswerService**: multi-index answer lookup (question_uid, answer_uid, exam_uid) with unsupported question detection
- **Progress tracking**: mark as solved, bookmark, localStorage persistence, progress bar with percentage
- **Hide Solved filter**: toggle to exclude solved questions
- **Show Only Bookmarked filter**: toggle to show only bookmarked questions
- **Active filter chips**: removable pills for each active filter with "Clear all"
- **Year formatting**: `gate20241` displays as "2024 Set 1"; generic tags suppressed when set-specific tags exist
- **Tag pill hiding**: tags hidden in question cards for cleaner UI (data preserved for filtering)
- **Unified filter modal**: full-screen modal for all screen sizes (no persistent sidebar)
- **Responsive layout**: Topics + Years in 2-column grid (md+), stacked on mobile
- **Year range slider**: rc-slider with dynamic min/max from dataset
- **MathJax rendering**: inline and display math in question bodies
- **HTML sanitization**: DOMPurify for question content
- **Google Analytics + GoatCounter**: analytics tracking

### Infrastructure
- React 18 + Vite build pipeline
- Tailwind CSS v3 (light theme only)
- GitHub Pages static deployment with `.nojekyll`
- Automated scraper workflow (GitHub Actions, every 4 months)
- Build scripts: `ensure-nojekyll.mjs`, `sync-calculator.mjs`
- Answer data pipeline: scrape → enrich → parse → build → validate

---

## Version History Notes

- Versions before 1.0.0 were pre-release development iterations not tracked here.
- Dates are approximate and reflect the state of the codebase at the time of documentation.
