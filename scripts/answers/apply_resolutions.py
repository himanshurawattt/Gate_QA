import argparse
import csv
import json
import sys
from pathlib import Path
from datetime import datetime

def now_iso() -> str:
    return datetime.utcnow().isoformat() + "Z"

def read_json(path: Path) -> dict:
    if not path.exists():
        return {}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def write_json(path: Path, data: dict) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

def main():
    parser = argparse.ArgumentParser(description="Apply CSV edits to manual_resolutions_v1.json")
    parser.add_argument("--csv", help="Path to input CSV with resolutions")
    parser.add_argument("--json", required=True, help="Path to manual_resolutions_v1.json")
    parser.add_argument("--bulk-subjective-years", help="Optional year range (e.g. 1991-2002) to mark all missing as SUBJECTIVE")
    parser.add_argument("--missing-report", help="Path to missing report CSV (required for bulk mode)")
    args = parser.parse_args()

    csv_path = Path(args.csv) if args.csv else None
    json_path = Path(args.json)
    
    resolutions = read_json(json_path)
    count = 0

    # 1. Process Bulk Years
    if args.bulk_subjective_years and args.missing_report:
        start_year, end_year = map(int, args.bulk_subjective_years.split("-"))
        missing_csv = Path(args.missing_report)
        if missing_csv.exists():
            with open(missing_csv, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    q_uid = row.get("question_uid", "").strip()
                    # simplistic check: does q_uid or link contain the year?
                    # valid GateOverflow links usually have year in tags or title, 
                    # but here we might rely on the string "gate<branch>-<year>" presence in link or just ID
                    # Actually, let's look for year pattern in the link or title provided in CSV
                    
                    text_blob = (row.get("question_uid", "") + row.get("link", "") + row.get("title", "")).lower()
                    
                    match_year = False
                    for y in range(start_year, end_year + 1):
                        if str(y) in text_blob:
                            match_year = True
                            break
                    
                    if match_year:
                        resolutions[q_uid] = {
                            "resolution_type": "SUBJECTIVE",
                            "value": None,
                            "notes": "",
                            "updated_at": now_iso()
                        }
                        count += 1
            print(f"Bulk applied {count} subjective resolutions for {start_year}-{end_year}")

    # 2. Process CSV Overrides
    if csv_path and csv_path.exists():
        with open(csv_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                q_uid = row.get("question_uid", "").strip()
                res_type = row.get("resolution_type", "").strip()
                value = row.get("value", "").strip()
                notes = row.get("notes", "").strip()
                
                if not q_uid or not res_type:
                    continue

                # Standardize type
                res_type = res_type.upper()
                
                # Format value based on type
                final_value = value
                if res_type == "NAT":
                    try:
                        final_value = float(value)
                    except ValueError:
                        pass # Keep as string if it fails, or maybe error out?
                elif res_type == "MSQ":
                    final_value = [x.strip() for x in value.split(";")]
                elif res_type in ["SUBJECTIVE", "AMBIGUOUS", "UNSUPPORTED"]:
                    final_value = None

                resolutions[q_uid] = {
                    "resolution_type": res_type,
                    "value": final_value,
                    "notes": notes,
                    "updated_at": now_iso()
                }
                count += 1

    write_json(json_path, resolutions)
    print(f"Applied {count} resolutions to {json_path}")

if __name__ == "__main__":
    main()
