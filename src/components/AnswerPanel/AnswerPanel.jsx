import React, { useEffect, useMemo, useState } from "react";
import { AnswerService } from "../../services/AnswerService";
import { evaluateAnswer } from "../../utils/evaluateAnswer";

const PROGRESS_KEY = "gateqa_progress_v1";
const BOOKMARKS_KEY = "gateqa_bookmarks_v1";
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

export default function AnswerPanel({ question = {} }) {
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
  const [bookmarked, setBookmarked] = useState(false);

  useEffect(() => {
    setMcqSelection("");
    setMsqSelection([]);
    setNatInput("");
    setResult(null);

    if (!storageKey) {
      setBookmarked(false);
      return;
    }
    const bookmarks = readJsonFromLocalStorage(BOOKMARKS_KEY, []);
    setBookmarked(Array.isArray(bookmarks) && bookmarks.includes(storageKey));
  }, [storageKey]);

  if (!questionIdentity.hasIdentity) {
    return (
      <div className="mt-4 rounded border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
        Missing question identity for answer lookup (no `question_uid`, no
        GateOverflow link-derived exam identity, and no `volume + id_str`).
      </div>
    );
  }

  const toggleBookmark = () => {
    const bookmarks = readJsonFromLocalStorage(BOOKMARKS_KEY, []);
    const bookmarkSet = new Set(Array.isArray(bookmarks) ? bookmarks : []);
    if (bookmarkSet.has(storageKey)) {
      bookmarkSet.delete(storageKey);
    } else {
      bookmarkSet.add(storageKey);
    }
    const updated = Array.from(bookmarkSet);
    writeJsonToLocalStorage(BOOKMARKS_KEY, updated);
    setBookmarked(updated.includes(storageKey));
  };

  if (!answerRecord) {
    return (
      <div className="mt-4 rounded border border-gray-300 bg-gray-50 p-3">
        <div className="mb-2 text-sm text-gray-700">
          No mapped answer record for this question.
        </div>
        <div className="mb-2 text-xs text-gray-600">
          lookup keys: q_uid=
          {questionIdentity.questionUid || "-"}, answer_uid=
          {questionIdentity.answerUid || "-"}, exam_uid=
          {questionIdentity.examUid || "-"}
        </div>
        <button
          type="button"
          className="rounded bg-slate-700 px-3 py-1 text-white"
          onClick={toggleBookmark}
        >
          {bookmarked ? "Remove Bookmark" : "Bookmark"}
        </button>
      </div>
    );
  }

  if (answerRecord.type === "UNSUPPORTED") {
    return (
      <div className="mt-4 rounded border border-amber-300 bg-amber-50 p-3">
        <div className="mb-2 text-sm text-amber-900">
          Answer exists in source as a non-standard/unsupported format for strict
          MCQ/MSQ/NAT evaluation.
        </div>
        <div className="mb-2 text-xs text-amber-800">
          lookup keys: q_uid=
          {questionIdentity.questionUid || "-"}, answer_uid=
          {questionIdentity.answerUid || "-"}, exam_uid=
          {questionIdentity.examUid || "-"}
        </div>
        <button
          type="button"
          className="rounded bg-slate-700 px-3 py-1 text-white"
          onClick={toggleBookmark}
        >
          {bookmarked ? "Remove Bookmark" : "Bookmark"}
        </button>
      </div>
    );
  }

  if (answerRecord.type === "SUBJECTIVE") {
    return (
      <div className="mt-4 rounded border border-purple-300 bg-purple-50 p-3">
        <div className="mb-2 text-sm text-purple-900">
          This question interprets a subjective or descriptive answer that cannot
          be strictly evaluated.
        </div>
        <div className="mb-2 text-xs text-purple-800">
          Note: {answerRecord.source?.notes || "Refer to standard solution text."}
        </div>
        <button
          type="button"
          className="rounded bg-slate-700 px-3 py-1 text-white"
          onClick={toggleBookmark}
        >
          {bookmarked ? "Remove Bookmark" : "Bookmark"}
        </button>
      </div>
    );
  }

  if (answerRecord.type === "AMBIGUOUS") {
    return (
      <div className="mt-4 rounded border border-orange-300 bg-orange-50 p-3">
        <div className="mb-2 text-sm text-orange-900">
          This question has been marked as ambiguous or having multiple correct interpretations.
        </div>
        <div className="mb-2 text-xs text-orange-800">
          Note: {answerRecord.source?.notes || "No single correct answer."}
        </div>
        <button
          type="button"
          className="rounded bg-slate-700 px-3 py-1 text-white"
          onClick={toggleBookmark}
        >
          {bookmarked ? "Remove Bookmark" : "Bookmark"}
        </button>
      </div>
    );
  }

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

  return (
    <div className="mt-4 rounded border border-blue-200 bg-blue-50 p-4">
      <div className="mb-2 text-sm font-semibold text-blue-900">
        Answer Check ({answerRecord.type})
      </div>

      {answerRecord.type === "MCQ" && (
        <div className="mb-3 flex flex-wrap gap-2">
          {OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setMcqSelection(option)}
              className={`rounded border px-3 py-1 ${mcqSelection === option
                  ? "border-blue-700 bg-blue-700 text-white"
                  : "border-blue-300 bg-white text-blue-900"
                }`}
            >
              {option}
            </button>
          ))}
        </div>
      )}

      {answerRecord.type === "MSQ" && (
        <div className="mb-3 flex flex-wrap gap-4">
          {OPTIONS.map((option) => (
            <label key={option} className="flex items-center gap-2 text-blue-900">
              <input
                type="checkbox"
                checked={msqSelection.includes(option)}
                onChange={(event) => {
                  if (event.target.checked) {
                    setMsqSelection([...msqSelection, option]);
                  } else {
                    setMsqSelection(
                      msqSelection.filter((item) => item !== option)
                    );
                  }
                }}
              />
              {option}
            </label>
          ))}
        </div>
      )}

      {answerRecord.type === "NAT" && (
        <div className="mb-3">
          <input
            type="text"
            value={natInput}
            onChange={(event) => setNatInput(event.target.value)}
            placeholder="Enter numeric answer"
            className="w-full rounded border border-blue-300 px-3 py-2 text-blue-900"
          />
          <div className="mt-1 text-xs text-blue-700">
            Absolute tolerance: {answerRecord.tolerance?.abs ?? 0}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded bg-blue-700 px-4 py-2 text-white"
          onClick={evaluateSubmission}
        >
          Submit Answer
        </button>
        <button
          type="button"
          className="rounded bg-slate-700 px-4 py-2 text-white"
          onClick={toggleBookmark}
        >
          {bookmarked ? "Remove Bookmark" : "Bookmark"}
        </button>
      </div>

      {result && (
        <div
          className={`mt-3 rounded p-2 text-sm ${result.correct
              ? "bg-green-100 text-green-900"
              : "bg-red-100 text-red-900"
            }`}
        >
          {result.status === "invalid_input"
            ? "Invalid input format."
            : result.correct
              ? "Correct."
              : "Incorrect."}
        </div>
      )}
    </div>
  );
}
