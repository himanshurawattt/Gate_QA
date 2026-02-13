import React from "react";
import { MathJax } from "better-react-mathjax";
import DOMPurify from "dompurify";
import AnswerPanel from "../AnswerPanel/AnswerPanel";

export default function Question({ question = {}, changeQuestion }) {
  const questionHtml = (question.question || "")
    .replace(/\n\n/g, "<br />")
    .replace(/\n<li>/g, "<br><li>");
  const sanitizedQuestionHtml = DOMPurify.sanitize(questionHtml);

  return (
    <div>
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="mb-4">
          <h2 className="text-2xl font-medium pb-3">{question.title}</h2>
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
        <div className="mb-4">
          {(question.tags || []).map((tag) => (
            <span
              key={tag}
              className="inline-block bg-gray-200 rounded-full px-3 py-1 text-sm font-semibold text-gray-700 mr-2 mb-2"
            >
              #{tag}
            </span>
          ))}
        </div>
        {question.link && (
          <a
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded inline-block"
            href={question.link}
            target="_blank"
            rel="noopener noreferrer"
          >
            Solution
          </a>
        )}
        <button
          className="bg-green-500 hover:bg-green-700 ml-5 text-white font-bold py-2 px-4 rounded"
          onClick={changeQuestion}
        >
          Get Question
        </button>

        <AnswerPanel question={question} />
      </div>
    </div>
  );
}
