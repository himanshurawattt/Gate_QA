
import json
import sys
import os

def show(target_term):
    p = 'public/questions-filtered.json'
    print(f"Loading {p}...")
    with open(p, 'r', encoding='utf-8') as f:
        data = json.load(f)
            
    found = False
    for q in data:
        # Check by ID explicitly first
        uid = q.get('question_uid', '')
        if uid == target_term:
             print("--- MATCH BY UID ---")
             print(json.dumps(q, indent=2))
             found = True
             break
             
        # Fallback to broad search
        raw = json.dumps(q).lower()
        if target_term.lower() in raw:
            print(f"--- MATCH BY CONTENT ---")
            print(json.dumps(q, indent=2))
            found = True
            break
            
    if not found:
        print("Not found.")

if __name__ == "__main__":
    show("go:153546")
