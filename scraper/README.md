# GateOverflow Question Scraper

## Quick Start

### Prerequisites
Make sure you have Python 3.7+ installed. Then install the required packages:

```bash
pip install requests beautifulsoup4
```

### Step 1: Scrape Questions
```bash
cd scraper
python scrape_gateoverflow.py
```

This will:
- Visit GateOverflow tag pages for GATE 2024 Set 1, Set 2, 2025 Set 1, Set 2, etc.
- Scrape each individual question (title, HTML body, tags, link)
- Save to `new_questions.json`

**⚠️ Takes time!** ~65 questions per set, 2 seconds between requests = ~5 minutes per set.

### Step 2: Edit Tags to Scrape

Open `scrape_gateoverflow.py` and edit the `TAGS_TO_SCRAPE` list:

```python
TAGS_TO_SCRAPE = [
    "gatecse-2024-set1",
    "gatecse-2024-set2",
    "gatecse-2025-set1",
    "gatecse-2025-set2",
    # "gatecse-2026-set1",  # Uncomment when available
    # "gatecse-2026-set2",
]
```

### Step 3: Merge with Existing Questions
```bash
python merge_questions.py
```

This will:
- Load the existing `public/questions-filtered.json`
- Add new questions (skipping duplicates)
- Create a backup of the original file
- Save the merged file

### Step 4: Clear Browser Cache

After merging, you MUST clear localStorage in the browser because GateR caches the old JSON:

1. Open your site in the browser
2. Press `F12` → Application tab → Local Storage
3. Delete the `questions` entry
4. Refresh the page

## Notes

- **Be polite to GateOverflow** — the scraper waits 2 seconds between requests
- **Images are hotlinked** — they load from GateOverflow's servers, not downloaded locally
- **Math equations** — kept as LaTeX in the HTML, MathJax renders them in the browser
