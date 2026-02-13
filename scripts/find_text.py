
import json
import os

def search_text(term):
    paths = ['public/questions-filtered.json', 'public/questions-with-answers.json']
    
    for p in paths:
        if os.path.exists(p):
            print(f"Scanning {p}...")
            with open(p, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            count = 0
            for q in data:
                if q.get('title', '').strip().lower() == "general":
                    print(f"Found General Question:")
                    print(f"ID: {q.get('question_uid')}")
                    print(f"Link: {q.get('link')}")
                    print("-" * 20)
                    count += 1
            print(f"Total General Questions: {count}")

if __name__ == "__main__":
    search_text("General")
