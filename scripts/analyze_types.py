
import json

def analyze_question_types():
    try:
        # Load questions
        with open('src/data/gate_questions.json', 'r', encoding='utf-8') as f:
            questions = json.load(f)
        
        # Load answers to get types
        with open('public/data/answers/answers_by_question_uid_v1.json', 'r', encoding='utf-8') as f:
            answers_data = json.load(f)
            # Handle different possible structures of answers file
            if 'records_by_question_uid' in answers_data:
                answers = answers_data['records_by_question_uid']
            else:
                answers = answers_data

        total_questions = len(questions)
        type_counts = {}
        missing_type_count = 0
        
        print(f"Total Questions: {total_questions}")
        
        for q in questions:
            # Replicate QuestionService logic to find UID
            # (Simplified for analysis - assumes we can match by link or we'd need full hashing logic)
            # Let's just iterate answers and count distinct types found 
            # This is tricky without the exact UID logic in Python.
            
            # Alternative: Just analyze the answers file directly since FilterContext uses AnswerService
            pass

        print("\n--- Answer Database Analysis ---")
        answer_types = {}
        for uid, record in answers.items():
            t = record.get('type', 'UNDEFINED')
            answer_types[t] = answer_types.get(t, 0) + 1
            
        for t, count in answer_types.items():
            print(f"Type '{t}': {count}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    analyze_question_types()
