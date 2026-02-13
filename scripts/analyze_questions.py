
import json
import os

def analyze():
    # Attempt to locate the file
    paths = [
        'public/questions-filtered.json',
        'public/questions-with-answers.json'
    ]
    
    data = []
    loaded_path = ""
    
    for p in paths:
        if os.path.exists(p):
            print(f"Loading {p}...")
            with open(p, 'r', encoding='utf-8') as f:
                data = json.load(f)
            loaded_path = p
            break
            
    if not data:
        print("No data file found.")
        return

    print(f"Loaded {len(data)} questions.")

    # 1. Broad Search
    search_terms = ["gate2001-11", "752"]
    found = False
    
    print(f"Searching for {search_terms}...")
    for q in data:
        raw = json.dumps(q).lower()
        if any(term in raw for term in search_terms):
            print("\n---------- MATCH FOUND ----------")
            print(json.dumps(q, indent=2))
            print("---------------------------------\n")
            found = True

    if not found:
        print("No match found.")

if __name__ == "__main__":
    analyze()
