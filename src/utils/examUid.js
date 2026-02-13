const LINK_EXAM_PATTERN =
  /gate-cse-(\d{4})(?:-set-(\d+))?-(ga-)?question-([^/?#]+)/i;
const YEAR_TAG_PATTERN = /gatecse-(\d{4})(?:-set(\d+))?/i;
const TITLE_YEAR_PATTERN = /GATE\s+CSE\s+(\d{4})(?:\s+Set\s*(\d+))?/i;
const TITLE_QUESTION_PATTERN =
  /(GA\s+)?Question\s*[: ]\s*([0-9]+(?:\.[0-9]+)?(?:-[A-Za-z0-9]+)*)/i;

function normalizeSetNo(rawSet) {
  const value = Number.parseInt(String(rawSet ?? "").trim(), 10);
  if (!Number.isFinite(value) || value <= 0) {
    return "1";
  }
  return String(value);
}

function normalizeExamQuestionToken(rawToken = "") {
  const cleaned = String(rawToken || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/–/g, "-")
    .replace(/—/g, "-")
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "");

  if (!cleaned) {
    return "";
  }

  return cleaned
    .split(/([.-])/)
    .map((part) => {
      if (part === "." || part === "-") {
        return part;
      }
      if (/^\d+$/.test(part)) {
        return String(Number.parseInt(part, 10));
      }
      return part;
    })
    .join("")
    .replace(/^[.-]+|[.-]+$/g, "");
}

function parseYearTag(yearTag = "") {
  const match = String(yearTag || "").match(YEAR_TAG_PATTERN);
  if (!match) {
    return { year: null, setNo: "1" };
  }
  return { year: match[1], setNo: normalizeSetNo(match[2]) };
}

function buildExamUid(year, setNo, section, questionToken) {
  return `cse:${year}:set${normalizeSetNo(setNo)}:${section}:q${questionToken}`;
}

export function examUidFromLink(link = "", yearTag = "") {
  const raw = String(link || "").trim().replace(/\/+$/, "");
  if (!raw) {
    return null;
  }
  const slug = raw.split("/").at(-1) || "";
  const match = slug.match(LINK_EXAM_PATTERN);
  if (!match) {
    return null;
  }
  const year = match[1];
  const parsedYearTag = parseYearTag(yearTag);
  const setNo =
    match[2] || (parsedYearTag.year === year ? parsedYearTag.setNo : "1");
  const section = match[3] ? "ga" : "main";
  const questionToken = normalizeExamQuestionToken(match[4]);
  if (!questionToken) {
    return null;
  }
  return buildExamUid(year, setNo, section, questionToken);
}

export function examUidFromTitle(title = "", yearTag = "") {
  const rawTitle = String(title || "").trim();
  if (!rawTitle) {
    return null;
  }

  const yearTagParts = parseYearTag(yearTag);
  const yearMatch = rawTitle.match(TITLE_YEAR_PATTERN);
  let year = null;
  let setNo = "1";
  if (yearMatch) {
    year = yearMatch[1];
    setNo = normalizeSetNo(yearMatch[2] || yearTagParts.setNo);
  } else if (yearTagParts.year) {
    year = yearTagParts.year;
    setNo = yearTagParts.setNo;
  } else {
    return null;
  }

  const questionMatch = rawTitle.match(TITLE_QUESTION_PATTERN);
  if (!questionMatch) {
    return null;
  }
  const section = questionMatch[1] ? "ga" : "main";
  const questionToken = normalizeExamQuestionToken(questionMatch[2]);
  if (!questionToken) {
    return null;
  }
  return buildExamUid(year, setNo, section, questionToken);
}

export function getExamUidFromQuestion(question = {}) {
  if (!question || typeof question !== "object") {
    return null;
  }
  const existing = String(question.exam_uid || "").trim();
  if (existing) {
    return existing;
  }
  const yearTag = String(question.year || "").trim();
  return (
    examUidFromLink(String(question.link || ""), yearTag) ||
    examUidFromTitle(String(question.title || ""), yearTag) ||
    null
  );
}
