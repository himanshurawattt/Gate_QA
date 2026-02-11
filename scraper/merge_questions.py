"""
Merge Tool — Combines new scraped questions with the existing JSON file
======================================================================

Usage:
    python merge_questions.py

This reads:
    - ../public/questions-filtered.json (existing questions)
    - new_questions.json (newly scraped questions)

And outputs:
    - ../public/questions-filtered.json (merged, deduplicated)
"""

import json
import os
import shutil
from datetime import datetime

# File paths
EXISTING_FILE = os.path.join(os.path.dirname(__file__), "..", "public", "questions-filtered.json")
NEW_FILE = os.path.join(os.path.dirname(__file__), "new_questions.json")
BACKUP_SUFFIX = f".backup-{datetime.now().strftime('%Y%m%d-%H%M%S')}"


def main():
    # --- Load existing questions ---
    print(f"Loading existing questions from: {EXISTING_FILE}")
    with open(EXISTING_FILE, "r", encoding="utf-8") as f:
        existing = json.load(f)
    print(f"  Found {len(existing)} existing questions")

    # --- Load new questions ---
    print(f"Loading new questions from: {NEW_FILE}")
    if os.path.exists(NEW_FILE):
        with open(NEW_FILE, "r", encoding="utf-8") as f:
            new_questions = json.load(f)
        print(f"  Found {len(new_questions)} new questions")
    else:
        new_questions = []
        print(f"  Warning: {NEW_FILE} not found. Only cleaning existing questions.")

    # --- Combine and Clean Everything ---
    # We want to re-process EVERYTHING to apply the new cleaning rules
    # to both old and new questions.
    
    all_questions = existing + new_questions
    unique_questions = []
    seen_links = set()
    
    deleted_tags_count = 0
    
    print("\nCleaning and merging...")
    
    for q in all_questions:
        link = q.get("link", "")
        
        # Deduplicate
        if link and link in seen_links:
            continue
            
        # Clean
        cleaned_q = clean_question(q)
        if cleaned_q:
            unique_questions.append(cleaned_q)
            seen_links.add(link)
        else:
            deleted_tags_count += 1

    # --- Backup original file ---
    backup_path = EXISTING_FILE + BACKUP_SUFFIX
    shutil.copy2(EXISTING_FILE, backup_path)
    print(f"\nBackup saved to: {backup_path}")

    # --- Save merged file ---
    with open(EXISTING_FILE, "w", encoding="utf-8") as f:
        json.dump(unique_questions, f, ensure_ascii=False)
    
    print(f"\n{'='*50}")
    print(f"DONE!")
    print(f"  Total unique questions: {len(unique_questions)}")
    print(f"  Removed Non-CSE/IT:     {deleted_tags_count}")
    print(f"  (Processed {len(all_questions)})")
    print(f"\nIMPORTANT: Clear your browser's localStorage to see the new questions!")
    print(f"  (Open DevTools → Application → Local Storage → Clear)")


def clean_question(q):
    """
    Remove GateOverflow-specific branding and metadata from the question.
    """
    import re
    
    # 1. Clean Title
    # Remove "GATE CSE 2024 | Set 1 | " prefix if you want shorter titles
    # Or just keep it clean. Current scraper already cleans title partially.
    
    # 2. Clean HTML Content
    html = q.get("question", "")
    
    # Remove user links like [Arjun], [asked], etc.
    # Pattern: <a href="...">Arjun</a> or similar
    html = re.sub(r'<a[^>]*>(Arjun|asked|Misbah Ghaya|admin|user)</a>', '', html, flags=re.IGNORECASE)
    
    # Remove "log in to answer" or "Comments" sections if they leaked in
    html = re.sub(r'Please \[log in\].*?to add a comment\.', '', html, flags=re.IGNORECASE)
    html = re.sub(r'\d+\s+Comments', '', html, flags=re.IGNORECASE)
    
    # Remove empty links or leftover brackets
    html = html.replace("[]", "").replace("()", "")
    
    q["question"] = html.strip()
    
    # 3. Clean Tags
    original_tags = q.get("tags", [])
    cleaned_tags = []
    
    # Tags to remove completely
    TAG_BLOCKLIST = {
        "gate2018-ce-2", "gate2015-ec-1", "gateme-2022-set1", "gateme-2022-set2",
        "gatecivil-2022-set1", "gatecivil-2021-set1", "gateme-2021-set1",
        "gatecivil-2024-set2", "gatecivil-2024-set1", "gateme-2024",
        "gateme-2021-set2", "gatecivil-2023-set1", "gateece-2024",
        "gateme-2020-set2", "gate2020-ce-1", "gateme-2023", "gate2015-ec-3",
        "gateoverflow-test-series", "gatecse-2026-test-series",
        "gatecse-2014-set1", "gate2026_cs_set1_memorybased"
    }

    for tag in original_tags:
        # Check blocklist
        if tag in TAG_BLOCKLIST:
            continue
            
        # Renaissance logic for 2025 tags to match standard format
        if tag == "gatecse2025-set1":
            cleaned_tags.append("gatecse-2025-set1")
        elif tag == "gatecse2025-set2":
            cleaned_tags.append("gatecse-2025-set2")
        else:
            cleaned_tags.append(tag)
            
    q["tags"] = list(dict.fromkeys(cleaned_tags)) # deduplicate
    
    # 4. Strict Branch Filtering & Tag Cleanup
    # Goal: 
    # 1. Remove questions that are ONLY from other branches.
    # 2. For questions we keep (e.g. shared topics), REMOVE the other-branch tags so they don't clutter the UI.
    
    final_tags = []
    
    # We define "Gate Tags" as tags containing "gate" used for filtering by year/exam paper.
    has_cse_gate_tag = False
    has_other_gate_tag = False
    
    # Pattern for other branches: gateme, gatece, gate-me, etc.
    # We use a set of prefixes/substrings to identify them.
    msg_forbidden = ['gateme', 'gatece', 'gateee', 'gateec', 'gatein', 'gatech', 'gatebt', 'gatecivil', 'gatemech', 'gateelectrical']
    
    # Pattern for CSE/IT
    # Removed generic 'gate20'/'gate19' to prevent matching 'gateme-2022' as allowed.
    msg_allowed = ['gatecse', 'gateit', 'gate-cse', 'gate-it', 'gate2026_cs', 'data-science', 'artificial-intelligence'] 
    # Note: 'gate20' / 'gate19' matches generic year tags like 'gate2024' which are often CSE implied in this context, 
    # BUT we must be careful. Actually, standard format is gatecse-YYYY.
    # Let's rely on exclusion.
    
    cleaned_tags_pass_2 = []
    
    for tag in q["tags"]:
        tag_lower = tag.lower()
        
        is_forbidden_tag = False
        is_gate_tag = 'gate' in tag_lower
        
        # Check if this specific tag is a "Forbidden Branch Tag"
        # e.g. "gateme-2022"
        for code in msg_forbidden:
            if code in tag_lower:
                is_forbidden_tag = True
                break
        
        # Check for bad patterns like '-ce-', '-me-' inside a gate tag
        if is_gate_tag and not is_forbidden_tag:
             for code in ['-me-', '-ce-', '-ee-', '-ec-', '-in-']:
                 if code in tag_lower:
                     is_forbidden_tag = True
                     break

        if is_forbidden_tag:
            has_other_gate_tag = True
            # WE DO NOT ADD TO cleaned_tags_pass_2
            # This effectively removes the tag from the UI even if we keep the question.
            continue
            
        # Check if it is a CSE/IT tag
        if is_gate_tag:
             if any(ok in tag_lower for ok in ['cse', 'cs', 'it', 'data', 'artificial']):
                 has_cse_gate_tag = True
             elif 'gate' in tag_lower and not is_forbidden_tag:
                 # Generic gate tags like 'gate2024' (if they exist without branch)
                 # We assume they are okay if they passed the forbidden check
                 # But usually gate tags have branch.
                 pass

        cleaned_tags_pass_2.append(tag)


    # Decision to Keep or Discard Question:
    # 1. If it has a CSE tag, KEEP IT.
    # 2. If it has NO CSE tag, but HAS other branch tags, DISCARD IT.
    # 3. If it has neither (e.g. only topic tags), KEEP IT (safe default).
    
    if has_other_gate_tag and not has_cse_gate_tag:
        # This was a purely other-branch question
        return None
        
    q["tags"] = cleaned_tags_pass_2
    
    return q

if __name__ == "__main__":
    main()

