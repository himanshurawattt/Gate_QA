"""
GateOverflow Question Scraper (Robust)
======================================
Scrapes GATE CSE questions from gateoverflow.in and outputs JSON.
Features:
- Resumes from where it left off (checks existing JSON)
- Retries on network errors
- Saves progress every 5 questions

Usage:
    pip install requests beautifulsoup4
    python scrape_gateoverflow.py
"""

import requests
from bs4 import BeautifulSoup
import json
import time
import re
import os
import random

# ============================================================
# CONFIGURATION
# ============================================================

TAGS_TO_SCRAPE = [
    "gatecse-2024-set1",
    "gatecse-2024-set2",
    "gatecse2025-set1",
    "gatecse2025-set2",
]

OUTPUT_FILE = "new_questions.json"
REQUEST_DELAY_MIN = 1.0
REQUEST_DELAY_MAX = 3.0
MAX_RETRIES = 3

# ============================================================
# HELPER FUNCTIONS
# ============================================================

def load_existing_data():
    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except json.JSONDecodeError:
            print("  Warning: Output file is corrupt, starting fresh.")
    return []

def save_data(data):
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def get_soup(url):
    for attempt in range(MAX_RETRIES):
        try:
            # Randomize delay
            time.sleep(random.uniform(REQUEST_DELAY_MIN, REQUEST_DELAY_MAX))
            
            response = requests.get(url, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }, timeout=15)
            response.raise_for_status()
            return BeautifulSoup(response.text, "html.parser")
        except requests.RequestException as e:
            print(f"  Error fetching {url} (Attempt {attempt+1}/{MAX_RETRIES}): {e}")
            time.sleep(5)  # Wait longer on error
    return None

# ============================================================
# SCRAPING LOGIC
# ============================================================

def get_question_links_from_tag(tag_name):
    question_links = []
    page = 1

    while True:
        url = f"https://gateoverflow.in/tag/{tag_name}?start={(page - 1) * 20}"
        print(f"  Fetching tag page: {url}")
        
        soup = get_soup(url)
        if not soup:
            break

        found_links = []
        
        # Strategy: Find all links that look like question URLs
        for a in soup.find_all("a", href=True):
            href = a["href"]
            
            # Construct absolute URL properly
            if href.startswith("http"):
                full_url = href
            else:
                # Handle relative URLs like "../422841/..." or "/422841/..."
                # clean up leading ".." or "."
                clean_href = href.lstrip("./")
                full_url = f"https://gateoverflow.in/{clean_href}"

            # Matches /12345/gate-cse-2024... or similar patterns
            if re.search(r"/\d+/", full_url) and "gate-cse" in full_url:
                if full_url not in found_links:
                    found_links.append(full_url)

        if not found_links:
            print(f"  No more questions found on page {page}")
            break

        print(f"    Found {len(found_links)} questions on page {page}")
        question_links.extend(found_links)

        # Check for next page
        if not soup.find("a", string=re.compile(r"next|›|>>")):
            break

        page += 1

    # Deduplicate
    return list(dict.fromkeys(question_links))

def scrape_question(url):
    soup = get_soup(url)
    if not soup:
        return None

    # Title
    title = "Unknown"
    h1 = soup.select_one(".qa-main-heading h1") or soup.find("h1")
    if h1:
        title = h1.get_text(strip=True)
        # Clean title
        title = re.sub(r"\s*[-–|].*?GATE Overflow.*$", "", title)

    # Question HTML
    # Try different selectors used by Q2A themes
    q_content = soup.select_one(".qa-q-view-content .entry-content") or \
                soup.select_one(".qa-q-view-content") or \
                soup.select_one(".entry-content")
    
    question_html = ""
    if q_content:
        # Remove metadata/ads
        for bad in q_content.select(".qa-q-view-who, .qa-q-view-when, .qa-q-view-flags, .qa-q-view-buttons"):
            bad.decompose()
        question_html = str(q_content)

    # Tags
    tags = []
    for t in soup.select(".qa-tag-link"):
        tags.append(t.get_text(strip=True))
    tags = list(dict.fromkeys(tags))

    # Determine Year Tag
    year_tag = next((t for t in tags if t.startswith("gatecse-")), "")

    return {
        "title": title,
        "year": year_tag,
        "link": url,
        "question": question_html,
        "tags": tags,
    }

# ============================================================
# MAIN
# ============================================================

def main():
    questions = load_existing_data()
    scraped_links = set(q["link"] for q in questions)
    
    print(f"Loaded {len(questions)} existing questions from {OUTPUT_FILE}")

    for tag in TAGS_TO_SCRAPE:
        print(f"\nProcessing tag: {tag}")
        links = get_question_links_from_tag(tag)
        print(f"Found {len(links)} total links for {tag}")

        for i, link in enumerate(links):
            if link in scraped_links:
                print(f"  Skipping {link} (already scraped)")
                continue
            
            print(f"  Scraping [{i+1}/{len(links)}]: {link}")
            q_data = scrape_question(link)
            
            if q_data and q_data["question"]:
                questions.append(q_data)
                scraped_links.add(link)
                
                # Save every 5 questions just in case
                if len(questions) % 5 == 0:
                    print("    Saving progress...")
                    save_data(questions)
            else:
                print(f"    Failed to scrape content for {link}")

    # Final save
    save_data(questions)
    print(f"\nDone! Saved {len(questions)} questions to {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
