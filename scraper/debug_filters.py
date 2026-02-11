import json

def check_filters():
    with open('../public/questions-filtered.json', 'r', encoding='utf-8') as f:
        questions = json.load(f)

    forbidden_codes = ['me-', 'ce-', 'ee-', 'ec-', 'in-', 'ch-', 'bt-', 'civil', 'mech', 'electrical']
    # Removing 'me', 'ce', etc. specifically to avoid false positives like 'time', 'since'
    
    print("\n--- Inspecting Specific Gateme Questions ---")
    count = 0
    target_tag = "gateme-2022-set1"
    
    for q in questions:
        tags = q.get('tags', [])
        tags_lower = [t.lower() for t in tags]
        
        if target_tag in tags_lower:
            print(f"\nQuestion: {q.get('title')}")
            print(f"  Link: {q.get('link')}")
            print(f"  Tags: {tags}")
            
            # Check forbidden logic
            has_forbidden = False
            msg_forbidden = ['gateme', 'gatece', 'gateee', 'gateec', 'gatein', 'gatech', 'gatebt', 'gatecivil', 'gatemech', 'gateelectrical']
            for code in msg_forbidden:
                 if code in target_tag: # "gateme" in "gateme-2022-set1" -> True
                     has_forbidden = True
                     print(f"  Forbidden Triggered by: {code}")
                     break
            
            # Check allowed logic
            msg_allowed = ['gatecse', 'gateit', 'gate-cse', 'gate-it', 'gate20', 'gate19', 'gate2026_cs']
            # ^ Note: 'gate20' matches 'gateme-2022' ?? No but 'gate20' matches 'gate2018'?
            
            has_allowed = False
            for t in tags_lower:
                if 'gate' in t:
                    if any(ok in t for ok in msg_allowed):
                        has_allowed = True
                        print(f"  Allowed Triggered by: {t}")
                        # break? No let's see all
            
            print(f"  Result: Forbidden={has_forbidden}, Allowed={has_allowed}, Keep={not has_forbidden or has_allowed}")
            
            count += 1
            if count >= 5: break

if __name__ == "__main__":
    check_filters()
