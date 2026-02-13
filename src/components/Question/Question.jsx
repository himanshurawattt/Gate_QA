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

        <AnswerPanel
          question={question}
          onNextQuestion={changeQuestion}
          solutionLink={question.link}
        />
      </div>
    </div>
  );
}
