import argparse
import csv
import json
import sys
from pathlib import Path

def read_json(path: Path) -> dict:
    if not path.exists():
        return {}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def main():
    parser = argparse.ArgumentParser(description="Generate CSV template for manual review of missing answers")
    parser.add_argument("--questions", required=True, help="Path to public/questions-filtered.json")
    parser.add_argument("--answers", required=True, help="Path to data/answers/answers_by_question_uid_v1.json")
    parser.add_argument("--out", required=True, help="Path to output CSV")
    args = parser.parse_args()

    questions = read_json(Path(args.questions))
    answers_payload = read_json(Path(args.answers))
    answers = answers_payload.get("records_by_question_uid", {})

    missing_list = []
    
    # Check all questions
    for q in questions:
        q_uid = q.get("question_uid")
        if not q_uid:
            continue
            
        if q_uid not in answers:
            missing_list.append({
                "question_uid": q_uid,
                "link": q.get("link", ""),
                "title": q.get("title", "")[:50], # Truncate title
                "current_status": "MISSING",
                "resolution_type": "",
                "value": "",
                "notes": ""
            })

    # Write to CSV
    fieldnames = ["question_uid", "link", "title", "current_status", "resolution_type", "value", "notes"]
    
    with open(args.out, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in missing_list:
            writer.writerow(row)

    print(f"Generated report with {len(missing_list)} missing items at {args.out}")

if __name__ == "__main__":
    main()
