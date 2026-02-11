import json
from collections import Counter

try:
    with open('../public/questions-filtered.json', 'r', encoding='utf-8') as f:
        questions = json.load(f)

    all_tags = []
    for q in questions:
        all_tags.extend(q.get('tags', []))

    counts = Counter(all_tags)
    
    # Print tags that typically indicate year/exam
    print("--- Exam/Year Tags (contain 'gate') ---")
    exam_tags = [t for t in counts.keys() if 'gate' in t.lower()]
    for t in sorted(exam_tags):
        print(f"{t}: {counts[t]}")

except Exception as e:
    print(f"Error: {e}")
