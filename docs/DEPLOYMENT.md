# Deployment

## Hosting Model

GateQA is a static single-page application (SPA) hosted on **GitHub Pages**. There is no backend, no server-side rendering, no CDN configuration beyond what GitHub provides. The `dist/` folder is the deployable artifact.

**Live URL**: `https://superawat.github.io/Gate_QA/`

## Build & Deploy Steps

### 1. Build

```bash
npm run build
```

This runs the following pipeline:
1. `sync-calculator.mjs --public` — copies `calculator/` → `public/calculator/`
2. `vite build` — bundles React app → `dist/` with hashed assets in `dist/assets/`
3. `ensure-nojekyll.mjs` — creates `dist/.nojekyll`
4. `sync-calculator.mjs --dist` — copies `calculator/` → `dist/calculator/`

### 2. Deploy to GitHub Pages

Deploy the `dist/` folder to the `gh-pages` branch. Common methods:

```bash
# Option A: Using gh-pages npm package
npx gh-pages -d dist

# Option B: Manual push
git subtree push --prefix dist origin gh-pages
```

Alternatively, configure GitHub Actions to build and deploy automatically.

### 3. Verify

After deploy, check:
- [ ] `https://superawat.github.io/Gate_QA/` loads the app
- [ ] Question data loads (no infinite spinner)
- [ ] Calculator opens (Ctrl+K)
- [ ] Filters modal opens and shows question count

## Pre-Deploy Checklist

- [ ] `vite.config.js` has `base: '/Gate_QA/'` (must match the GitHub Pages repo path)
- [ ] `npm run build` completes without errors
- [ ] `dist/.nojekyll` exists (created automatically by build script)
- [ ] `dist/questions-with-answers.json` exists and is non-empty
- [ ] `dist/data/answers/` contains all four `*_v1.json` files
- [ ] `dist/calculator/` contains calculator HTML/JS/CSS
- [ ] `dist/logo.png` exists
- [ ] No `dark:` Tailwind classes are used in the codebase (light theme only)
- [ ] No hardcoded absolute paths in fetch calls (all use `import.meta.env.BASE_URL`)

## Configuration Reference

| Setting | File | Current Value | Notes |
|---------|------|---------------|-------|
| Base path | `vite.config.js` | `/Gate_QA/` | Must match GitHub repo name |
| Output dir | `vite.config.js` | `dist` | Standard Vite output |
| Assets dir | `vite.config.js` | `assets` | Hashed bundles go here |
| Homepage | `package.json` | `https://superawat.github.io/Gate_QA/` | Used by some deploy tools |
| Analytics | `index.html` | Google Analytics + GoatCounter | Tags are in `<head>` and `<body>` |

## Troubleshooting

### 404 on page refresh

**Cause**: GitHub Pages serves only `index.html` at the root. SPA client-side "routing" (if added later) won't work without a redirect.

**Current state**: The app has no client-side routing — it's a single view. This is not a problem unless routing is added.

**If routing is added later**: Create a `public/404.html` that redirects to `index.html` with the path as a query param.

### Assets not loading (JS/CSS 404)

**Cause**: `base` in `vite.config.js` doesn't match the actual deploy path.

**Fix**: Ensure `base: '/Gate_QA/'` matches `https://superawat.github.io/Gate_QA/`. If deploying to a different repo or custom domain, update `base` accordingly.

### Question data not loading (spinner never resolves)

**Cause**: `questions-with-answers.json` missing from `dist/` or CORS issue.

**Debug steps**:
1. Open DevTools → Network tab → look for the fetch request
2. Check the request URL — it should be `https://superawat.github.io/Gate_QA/questions-with-answers.json`
3. If the URL is wrong, check `import.meta.env.BASE_URL` resolution
4. If the file is missing, ensure `public/questions-with-answers.json` exists before running `npm run build`

### `.nojekyll` missing → underscore-prefixed files 404

**Cause**: GitHub Pages uses Jekyll by default, which ignores files/folders starting with `_`. Vite's `assets/` dir contains files like `_index-abc123.js`.

**Fix**: The build script creates `.nojekyll` automatically. If it's missing:
```bash
touch dist/.nojekyll
```

### Calculator not loading

**Cause**: `calculator/` source folder missing or sync script failed.

**Fix**: Ensure the `calculator/` folder exists at project root with valid HTML/JS/CSS files.

## Environment Variables

Vite exposes `import.meta.env.BASE_URL` (from `vite.config.js` `base` option). This is the only environment variable used at runtime. No `.env` files are needed.
