import React from "react";
import { MathJax } from "better-react-mathjax";
import DOMPurify from "dompurify";
import { FaCheckCircle, FaStar } from "react-icons/fa";
import AnswerPanel from "../AnswerPanel/AnswerPanel";
import { useFilters } from "../../contexts/FilterContext";

export default function Question({ question = {}, changeQuestion }) {
  const { isQuestionSolved, isQuestionBookmarked, getQuestionProgressId } = useFilters();
  const questionHtml = (question.question || "")
    .replace(/\n\n/g, "<br />")
    .replace(/\n<li>/g, "<br><li>");
  const sanitizedQuestionHtml = DOMPurify.sanitize(questionHtml);
  const questionProgressId = getQuestionProgressId(question);
  const isSolved = isQuestionSolved(questionProgressId);
  const isBookmarked = isQuestionBookmarked(questionProgressId);

  return (
    <div>
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="mb-4">
          <div className="flex flex-wrap items-start justify-between gap-3 pb-3">
            <h2 className="text-2xl font-medium">{question.title}</h2>
            <div className="flex items-center gap-2">
              {isSolved && (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800">
                  <FaCheckCircle className="text-green-600" />
                  Solved
                </span>
              )}
              {isBookmarked && (
                <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-800">
                  <FaStar className="text-orange-500" />
                  Bookmarked
                </span>
              )}
            </div>
          </div>
          <MathJax
            dynamic="true"
            className="text-gray-500 mt-1 leading-6 text-xl overflow-auto whitespace-normal"
          >
            <div
              dangerouslySetInnerHTML={{
                __html: sanitizedQuestionHtml,
              }}
            ></div>
          </MathJax>
        </div>

        <AnswerPanel
          question={question}
          onNextQuestion={changeQuestion}
          solutionLink={question.link}
        />
      </div>
    </div>
  );
}
