import { MathJaxContext } from "better-react-mathjax";
import { useCallback, useEffect, useState } from "react";
import { FaFilter } from "react-icons/fa";

import Header from "./components/Header/Header";
import Question from "./components/Question/Question";
import Footer from "./components/Footer/Footer";
import FilterSidebar from "./components/Filters/FilterSidebar";
import FilterModal from "./components/Filters/FilterModal";
import ActiveFilterChips from "./components/Filters/ActiveFilterChips";
import { FilterProvider, useFilters } from "./contexts/FilterContext";
import { QuestionService } from "./services/QuestionService";
import { AnswerService } from "./services/AnswerService";

const GateQAContent = ({ loading, error, loadQuestions, isMobileFilterOpen, setIsMobileFilterOpen }) => {
  const { filteredQuestions, isInitialized, totalQuestions } = useFilters();
  const [currentQuestion, setCurrentQuestion] = useState(null);

  // Pick a random question from the filtered list
  const pickRandomQuestion = useCallback(() => {
    if (filteredQuestions.length === 0) {
      setCurrentQuestion(null);
      return;
    }
    const randomIndex = Math.floor(Math.random() * filteredQuestions.length);
    setCurrentQuestion(filteredQuestions[randomIndex]);
  }, [filteredQuestions]);

  // Initial pick when data determines it's ready
  useEffect(() => {
    if (isInitialized && filteredQuestions.length > 0 && !currentQuestion) {
      pickRandomQuestion();
    }
  }, [isInitialized, filteredQuestions, currentQuestion, pickRandomQuestion]);

  // Validate current question against filtered list
  useEffect(() => {
    if (isInitialized && filteredQuestions.length > 0 && currentQuestion) {
      const isValid = filteredQuestions.some(q => q.question_uid === currentQuestion.question_uid);
      if (!isValid) {
        pickRandomQuestion();
      }
    } else if (isInitialized && filteredQuestions.length === 0 && currentQuestion) {
      setCurrentQuestion(null);
    }
  }, [isInitialized, filteredQuestions, currentQuestion, pickRandomQuestion]);

  // Update window object for debug/external services
  useEffect(() => {
    if (typeof window === "undefined" || !currentQuestion) {
      return;
    }
    const identity = AnswerService.getQuestionIdentity(currentQuestion);
    const answer = AnswerService.getAnswerForQuestion(currentQuestion);
    window.__gateqa_q = currentQuestion;
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
  }, [currentQuestion]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen grow">
        <svg
          className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-900 dark:text-gray-200"
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
        <p className="text-gray-900 dark:text-gray-200">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="grow flex flex-col items-center justify-center px-4 text-center">
        <p className="text-red-700 mb-4">{error}</p>
        <button
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          onClick={loadQuestions}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col grow relative">
      {/* 
          UNIFIED FILTER UX:
          - Persistent sidebar removed.
          - Filters are controlled solely by the Header button opening FilterModal.
          - Main content is now full width/centered at all breakpoints.
      */}

      {/* Filter Modal (Controlled by Header button) */}
      <FilterModal
        isOpen={isMobileFilterOpen}
        onClose={() => setIsMobileFilterOpen(false)}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col w-full transition-all duration-300">
        <div className="p-4 md:p-6 max-w-[1200px] mx-auto w-full">

          {/* HIDDEN - Result count and Mobile Filter Button removed per user feedback (Moved to Header) */}
          {/* 
          <div className="flex justify-between items-center mb-4 xl:hidden">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {filteredQuestions.length} results
            </span>
            <button
              onClick={() => setIsMobileFilterOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-sm text-sm font-medium text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <FaFilter className="text-gray-500 dark:text-gray-400" />
              Filters
            </button>
          </div>
          */}

          <ActiveFilterChips />

          {currentQuestion ? (
            <Question
              question={currentQuestion}
              changeQuestion={pickRandomQuestion}
            />
          ) : (
            <div className="text-center py-20">
              <p className="text-xl text-gray-600 dark:text-gray-400 mb-4">
                No questions match your filters.
              </p>
              <p className="text-gray-500 dark:text-gray-500">
                Try adjusting your criteria or clearing some filters.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      await QuestionService.init();
      await AnswerService.init();
      // QuestionService.questions is now populated
    } catch (err) {
      setError(err.message || "Unable to load questions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  return (
    <MathJaxContext>
      <div className="flex flex-col h-screen max-h-screen bg-gray-50">
        <Header onOpenFilters={() => setIsMobileFilterOpen(true)} />
        <FilterProvider>
          <GateQAContent
            loading={loading}
            error={error}
            loadQuestions={loadQuestions}
            isMobileFilterOpen={isMobileFilterOpen}
            setIsMobileFilterOpen={setIsMobileFilterOpen}
          />
        </FilterProvider>
        <Footer />
      </div>
    </MathJaxContext>
  );
}

export default App;
