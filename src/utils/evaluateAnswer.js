const ALLOWED_OPTIONS = new Set(["A", "B", "C", "D"]);

function normalizeMsqInput(input) {
  if (!Array.isArray(input)) {
    return [];
  }
  const seen = new Set();
  const values = [];
  for (const value of input) {
    const upper = String(value || "").toUpperCase().trim();
    if (!ALLOWED_OPTIONS.has(upper) || seen.has(upper)) {
      continue;
    }
    seen.add(upper);
    values.push(upper);
  }
  return values.sort();
}

export function evaluateAnswer(record, userInput) {
  if (!record || !record.type) {
    return { status: "missing_answer", correct: false };
  }

  if (record.type === "MCQ") {
    const submitted = String(userInput || "").toUpperCase().trim();
    return {
      status: "evaluated",
      correct: submitted === record.answer,
    };
  }

  if (record.type === "MSQ") {
    const submitted = normalizeMsqInput(userInput);
    const expected = normalizeMsqInput(record.answer);
    if (!submitted.length) {
      return { status: "invalid_input", correct: false };
    }
    const correct =
      submitted.length === expected.length &&
      submitted.every((value, index) => value === expected[index]);
    return { status: "evaluated", correct };
  }

  if (record.type === "NAT") {
    const submitted = Number(userInput);
    if (!Number.isFinite(submitted)) {
      return { status: "invalid_input", correct: false };
    }
    const expected = Number(record.answer);
    const tolerance = Number(record.tolerance?.abs ?? 0);
    return {
      status: "evaluated",
      correct: Math.abs(submitted - expected) <= tolerance,
    };
  }

  return { status: "unsupported_type", correct: false };
}

