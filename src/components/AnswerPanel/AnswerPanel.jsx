import React, { useEffect, useMemo, useState } from "react";
import { AnswerService } from "../../services/AnswerService";
import { evaluateAnswer } from "../../utils/evaluateAnswer";
import { useFilters } from "../../contexts/FilterContext";
import QuestionStatusControls from "../QuestionStatusControls/QuestionStatusControls";

const PROGRESS_KEY = "gateqa_progress_v1";
const OPTIONS = ["A", "B", "C", "D"];

function readJsonFromLocalStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
}

function writeJsonToLocalStorage(key, payload) {
  try {
    localStorage.setItem(key, JSON.stringify(payload));
  } catch (error) {
    // ignore storage write failures
  }
}

export default function AnswerPanel({ question = {}, onNextQuestion, solutionLink }) {
  const {
    toggleSolved,
    toggleBookmark,
    isQuestionSolved,
    isQuestionBookmarked,
    getQuestionProgressId,
  } = useFilters();

  const questionIdentity = useMemo(
    () => AnswerService.getQuestionIdentity(question),
    [question]
  );
  const answerRecord = useMemo(
    () => AnswerService.getAnswerForQuestion(question),
    [question]
  );
  const storageKey = useMemo(
    () => AnswerService.getStorageKeyForQuestion(question),
    [question]
  );

  const [mcqSelection, setMcqSelection] = useState("");
  const [msqSelection, setMsqSelection] = useState([]);
  const [natInput, setNatInput] = useState("");
  const [result, setResult] = useState(null);
  const questionProgressId = useMemo(
    () => getQuestionProgressId(question),
    [question, getQuestionProgressId]
  );
  const isSolved = isQuestionSolved(questionProgressId);
  const isBookmarked = isQuestionBookmarked(questionProgressId);
  const isStatusActionDisabled = !questionProgressId;

  useEffect(() => {
    setMcqSelection("");
    setMsqSelection([]);
    setNatInput("");
    setResult(null);
  }, [storageKey]);

  const handleToggleSolved = () => {
    if (!questionProgressId) {
      return;
    }
    toggleSolved(questionProgressId);
  };

  const handleToggleBookmark = () => {
    if (!questionProgressId) {
      return;
    }
    toggleBookmark(questionProgressId);
  };

  const evaluateSubmission = () => {
    let submission;
    if (answerRecord.type === "MCQ") {
      submission = mcqSelection;
    } else if (answerRecord.type === "MSQ") {
      submission = msqSelection;
    } else {
      submission = natInput;
    }
    const evaluation = evaluateAnswer(answerRecord, submission);
    setResult(evaluation);

    const progress = readJsonFromLocalStorage(PROGRESS_KEY, {});
    const current = progress[storageKey] || { attempts: 0 };
    progress[storageKey] = {
      attempts: current.attempts + 1,
      correct: evaluation.correct,
      lastSubmittedAt: new Date().toISOString(),
      type: answerRecord.type,
      lastInput: submission,
    };
    writeJsonToLocalStorage(PROGRESS_KEY, progress);
  };

  // --- Render Logic for Input Section ---
  const renderInputSection = () => {
    if (!questionIdentity.hasIdentity) {
      return (
        <div className="rounded border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
          Missing question identity.
        </div>
      );
    }

    if (!answerRecord) {
      return (
        <div className="rounded border border-gray-300 bg-gray-50 p-3">
          <div className="mb-2 text-sm text-gray-700">No answer record.</div>
        </div>
      );
    }

    if (["UNSUPPORTED", "SUBJECTIVE", "AMBIGUOUS"].includes(answerRecord.type)) {
      let colorClass = "border-gray-200 bg-gray-50 text-gray-700";
      let message = "Refer to standard solution.";

      if (answerRecord.type === "UNSUPPORTED") {
        colorClass = "border-amber-300 bg-amber-50 text-amber-900";
        message = "Non-standard format.";
      } else if (answerRecord.type === "SUBJECTIVE") {
        colorClass = "border-purple-300 bg-purple-50 text-purple-900";
        message = "Subjective answer.";
      } else if (answerRecord.type === "AMBIGUOUS") {
        colorClass = "border-orange-300 bg-orange-50 text-orange-900";
        message = "Ambiguous question.";
      }

      return (
        <div className={`rounded border p-3 ${colorClass}`}>
          <div className="text-sm">{message}</div>
        </div>
      );
    }

    // Standard Interaction (MCQ, MSQ, NAT)
    return (
      <div className="flex flex-col gap-3">
        {/* Question Type Badge */}
        <div className="flex">
          <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${answerRecord.type === "NAT"
              ? "bg-purple-50 text-purple-700 ring-purple-600/20"
              : answerRecord.type === "MSQ"
                ? "bg-orange-50 text-orange-700 ring-orange-600/20"
                : "bg-blue-50 text-blue-700 ring-blue-600/20"
            }`}>
            {answerRecord.type}
          </span>
        </div>

        {/* Options / Input Row */}
        <div>
          {answerRecord.type === "MCQ" && (
            <div className="flex gap-2">
              {OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setMcqSelection(option)}
                  className={`flex-1 rounded border px-3 py-2 text-center text-sm font-medium transition-colors ${mcqSelection === option
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                >
                  {option}
                </button>
              ))}
            </div>
          )}

          {answerRecord.type === "MSQ" && (
            <div className="flex flex-wrap gap-2">
              {OPTIONS.map((option) => (
                <label
                  key={option}
                  className={`flex-1 flex items-center justify-center gap-2 rounded border px-3 py-2 cursor-pointer transition-colors ${msqSelection.includes(option)
                    ? "border-blue-600 bg-blue-50 text-blue-700 font-medium"
                    : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                >
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={msqSelection.includes(option)}
                    onChange={(event) => {
                      if (event.target.checked) {
                        setMsqSelection([...msqSelection, option]);
                      } else {
                        setMsqSelection(msqSelection.filter((item) => item !== option));
                      }
                    }}
                  />
                  {option}
                </label>
              ))}
            </div>
          )}

          {answerRecord.type === "NAT" && (
            <div>
              <input
                type="text"
                value={natInput}
                onChange={(event) => setNatInput(event.target.value)}
                placeholder="Enter numeric answer"
                className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          )}
        </div>
      </div>
    );
  };

  const isInteractive = answerRecord && ["MCQ", "MSQ", "NAT"].includes(answerRecord.type);

  return (
    <div className="mt-6 border-t border-gray-200 pt-6">

      {/* Input / Status Section */}
      <div className="mb-6">
        {renderInputSection()}

        {/* Result Feedback */}
        {result && (
          <div className={`mt-3 rounded p-2 text-center text-sm font-medium ${result.correct ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
            }`}>
            {result.status === "invalid_input" ? "Invalid Input" : result.correct ? "Correct!" : "Incorrect"}
          </div>
        )}
      </div>

      {/* Unified Action Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">

        {/* 1. Submit Answer */}
        <button
          type="button"
          disabled={!isInteractive}
          className={`flex items-center justify-center rounded px-4 py-3 text-sm font-bold shadow-sm transition-colors h-12 ${isInteractive
            ? "bg-blue-600 text-white hover:bg-blue-700"
            : "bg-gray-100 text-gray-400 cursor-not-allowed"
            }`}
          onClick={evaluateSubmission}
        >
          Submit Answer
        </button>

        {/* 2 + 3. Solved + Bookmark */}
        <QuestionStatusControls
          isSolved={isSolved}
          isBookmarked={isBookmarked}
          disabled={isStatusActionDisabled}
          onToggleSolved={handleToggleSolved}
          onToggleBookmark={handleToggleBookmark}
        />

        {/* 4. View Solution */}
        {solutionLink ? (
          <a
            href={solutionLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center rounded bg-white border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors h-12"
          >
            View Solution
          </a>
        ) : (
          <div className="flex items-center justify-center rounded bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-400 h-12 cursor-not-allowed">
            No Solution
          </div>
        )}

        {/* 5. Next Question */}
        <button
          type="button"
          onClick={onNextQuestion}
          className="flex items-center justify-center rounded bg-green-600 px-4 py-3 text-base font-bold text-white shadow-sm hover:bg-green-700 transition-colors h-12"
        >
          Next Question
        </button>

      </div>

      {isStatusActionDisabled && (
        <p className="mt-3 text-xs text-amber-700">
          Progress status is unavailable for this question identifier.
        </p>
      )}
    </div>
  );
}
