# Contributing

> Developer-only contribution process. This repo uses `docs/` as internal documentation (gitignored). All contributors are assumed to have read `ARCHITECTURE.md` and `FRONTEND_GUIDE.md`.

## Branch Naming

```
feat/short-description      # New features
fix/short-description       # Bug fixes
docs/short-description      # Documentation only
refactor/short-description  # Code restructure (no behavior change)
chore/short-description     # Build, deps, CI, tooling
```

**Examples**:
- `feat/deep-link-question`
- `fix/year-slider-overflow`
- `refactor/extract-filter-hooks`

## Commit Messages

Use conventional prefix format:

```
feat: add deep link for individual questions
fix: year range slider not updating on data reload
docs: update ARCHITECTURE.md with answer join strategy
refactor: extract progress tracking into custom hook
chore: bump vite to 7.4
```

**Rules**:
- Lowercase after prefix
- No period at end
- Imperative mood ("add", not "added")
- One logical change per commit

## Pull Request Template

Every PR description must include:

```markdown
## What
<!-- One sentence: what does this PR do? -->

## Why
<!-- Motivation: bug report, feature request, tech debt -->

## How
<!-- Key implementation decisions. Link to relevant docs if non-obvious -->

## Testing
<!-- What did you verify? Reference TESTING.md checklist items -->
- [ ] Filter round-trip (set → reload → same state)
- [ ] No layout regressions at mobile/desktop widths
- [ ] No console errors

## Screenshots
<!-- Before/after if UI change, or N/A -->
```

## Before Submitting

- [ ] `npm run build` completes without errors
- [ ] Manual QA for affected area (see `docs/TESTING.md`)
- [ ] URL persistence is intact (if filter-related changes)
- [ ] No new `dark:` Tailwind classes (light theme only)
- [ ] No hardcoded paths (use `import.meta.env.BASE_URL`)
- [ ] No `console.log` left in production code (use `console.warn` for legitimate warnings only)

## Bug Report Format (Internal)

When filing an issue or adding a TODO:

```markdown
**Problem**: [What's broken]
**Expected**: [What should happen]
**Actual**: [What happens instead]
**Repro steps**:
1. Open app at [URL]
2. Click [element]
3. Observe [behavior]
**Screenshot**: [attach if visual]
**Browser**: [Chrome/Firefox/Safari + version]
**Severity**: [blocks usage | visual glitch | minor]
```

## File Ownership Quick Reference

| Area | Key files | Before changing, verify… |
|------|-----------|--------------------------|
| Filter logic | `FilterContext.jsx` | URL round-trip, chip sync, mutual exclusion |
| Filter UI | `Filters/*.jsx` | Responsive layout at all breakpoints |
| Data loading | `QuestionService.js` | Fallback candidate selection, tag indexing |
| Answer lookup | `AnswerService.js` | All three join strategies still resolve |
| Topic whitelist | `QuestionService.TOPIC_HIERARCHY` | New subtopic exists in question data |
| Build pipeline | `package.json`, `scripts/deployment/` | `npm run build` still works end-to-end |
| Data pipeline | `scripts/answers/` | Output JSONs are valid, file sizes reasonable |
