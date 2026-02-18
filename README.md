# GATE QA

> Extensive, searchable, and filterable database of GATE Computer Science (CS) previous year questions.

## Live Demo

[https://superawat.github.io/Gate_QA/](https://superawat.github.io/Gate_QA/)

## Key Features

- **Unified Filter Interface**: Accessible on all devices via a full-screen modal (optimized for focus).
- **Responsive Layout**: Two-column grid for filters on desktop; stacked layout on mobile.
- **Deep Filtering**: Filter by Year (including Sets), Topic, Subtopic (382 syllabus-aligned topics), Question Type (MCQ/MSQ/NAT), and Year Range.
- **Progress Tracking**: Local-first tracking for Solved and Bookmarked questions (persists via `localStorage`).
- **Show Only Solved**: Toggle to review completed questions (mutually exclusive with "Hide Solved").
- **Shareable Links**: All active filters sync to the URL query parameters for easy sharing.
- **Scientific Calculator**: Built-in TCS-style scientific calculator widget (draggable).
- **Clean UI**: Minimalist design with distraction-free question cards (internal tags hidden).
- **Math Support**: High-fidelity LaTeX rendering via MathJax for complex formulas.

## Tech Stack

- **Framework**: React 18
- **Build Tool**: Vite
- **Styling**: Tailwind CSS (light theme)
- **Math Rendering**: MathJax
- **Hosting**: GitHub Pages (static SPA)

## Getting Started

### Prerequisites
- Node.js ≥ 18
- npm ≥ 9

### Local Development

1. Clone the repository:
   ```bash
   git clone https://github.com/superawat/Gate_QA.git
   cd Gate_QA
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```
   This will start the app at `http://localhost:5173/Gate_QA/`.

### Build

To create a production build in `dist/`:

```bash
npm run build
```

This command:
1. Syncs calculator assets to `public/`.
2. Runs `vite build`.
3. Creates `.nojekyll` (required for GitHub Pages).
4. Syncs calculator assets to `dist/`.

## Deployment

This project is a static Single Page Application (SPA) designed for **GitHub Pages**.

1. Ensure `vite.config.js` has the correct `base` path (e.g., `/Gate_QA/`).
2. Run `npm run build`.
3. Deploy the contents of the `dist/` folder to your `gh-pages` branch.

## Project Notes

- **Architecture**: Client-side only. No backend database.
- **Data Source**: Questions are loaded from a static JSON file (`questions-with-answers.json`) at runtime.
- **Storage**: Progress (solved/bookmarked status) is stored in the browser's `localStorage`. Clearing browser data will reset progress.
- **Tags**: Internal tagging is used for filtering but is hidden from the UI to keep the interface clean.

## Roadmap

- [ ] Deep linking to individual questions
- [ ] Keyboard shortcuts (Next/Prev question, Reveal Answer)
- [ ] Progressive Web App (PWA) support for offline access
- [ ] Dark mode support

## Contributing

Contributions are welcome!
1. Fork the repo.
2. Create a feature branch (`feat/new-feature`).
3. Commit your changes.
4. Open a Pull Request.

Please see `docs/CONTRIBUTING.md` for details.

## License / Attribution

Content attribution goes to the original sources used in the dataset (primarily GATE previous year questions). The underlying application code is open source.

---

## How to Use

1. **Open Filters**: Click the "Filters" button in the top-right corner.
2. **Select Criteria**: Choose specific Years, Topics, or Question Types.
3. **Review**: Browse questions that match your criteria.
4. **Track Progress**:
   - Click the **Checkmark** to mark a question as solved.
   - Click the **Star** to bookmark it for later.
   - Use "Hide Solved" or "Show Only Solved" filters to manage your practice session.
5. **Calculator**: Click the calculator icon or press `Ctrl + K` to open the virtual scientific calculator.
