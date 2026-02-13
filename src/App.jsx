import { MathJaxContext } from "better-react-mathjax";

import Header from "./components/Header/Header";
import Question from "./components/Question/Question";
import { useCallback, useEffect, useState } from "react";
import Footer from "./components/Footer/Footer";
import FilterTags from "./components/FilterTags/FilterTags";
import { QuestionService } from "./services/QuestionService";
import { AnswerService } from "./services/AnswerService";

function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterTags, setFilterTags] = useState([]);
  const [question, setQuestion] = useState({});

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      await QuestionService.init();
      await AnswerService.init();
      setQuestion(QuestionService.getRandomQuestion());
    } catch (err) {
      setError(err.message || "Unable to load questions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const identity = AnswerService.getQuestionIdentity(question);
    const answer = AnswerService.getAnswerForQuestion(question);
    window.__gateqa_q = question;
    window.__gateqa_lookup = {
      identity,
      hasAnswer: !!answer,
      sourceUrl: QuestionService.sourceUrl,
      answersLoaded: AnswerService.loaded,
      answersByQuestionUidCount: Object.keys(
        AnswerService.answersByQuestionUid || {}
      ).length,
      answersByExamUidCount: Object.keys(AnswerService.answersByExamUid || {})
        .length,
    };
  }, [question]);

  return (
    <MathJaxContext>
      <div className="flex flex-col min-h-screen justify-between">
        <Header />

        {loading ? (
          <div className="flex items-center justify-center h-screen grow">
            <svg
              className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-900"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647zM12 20a8 8 0 008-8h-4a4 4 0 01-4 4v4zm2-17.709A7.962 7.962 0 0120 12h-4a4 4 0 00-4-4V1l3 1.291z"
              ></path>
            </svg>
            <p className="text-gray-900">Loading...</p>
          </div>
        ) : error ? (
          <div className="grow flex flex-col items-center justify-center px-4 text-center">
            <p className="text-red-700 mb-4">{error}</p>
            <button
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
              onClick={loadQuestions}
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="mb-auto grow">
            <FilterTags
              tagsSelected={(tags) => {
                setFilterTags(tags);
                setQuestion(QuestionService.getRandomQuestion(tags));
              }}
            />
            <Question
              question={question}
              changeQuestion={() => {
                setQuestion(QuestionService.getRandomQuestion(filterTags));
              }}
            />
          </div>
        )}

        <Footer />
      </div>
    </MathJaxContext>
  );
}

export default App;
