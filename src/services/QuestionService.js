import { getExamUidFromQuestion } from "../utils/examUid";

export class QuestionService {
  static questions = [];
  static loaded = false;
  static count = new Map();
  static tags = [];
  static sourceUrl = "";

  static extractGateOverflowId(link = "") {
    const raw = String(link || "").trim();
    if (!raw) {
      return null;
    }
    const absoluteMatch = raw.match(
      /(?:https?:\/\/)?(?:www\.)?gateoverflow\.in\/(\d+)(?:[/?#]|$)/i
    );
    if (absoluteMatch) {
      return absoluteMatch[1];
    }
    const relativeMatch = raw.match(/^\/?(\d+)(?:[/?#]|$)/);
    return relativeMatch ? relativeMatch[1] : null;
  }

  static hashString(value = "") {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16);
  }

  static buildQuestionUid(question = {}) {
    if (question.question_uid) {
      return String(question.question_uid);
    }
    const goId = this.extractGateOverflowId(question.link || "");
    if (goId) {
      return `go:${goId}`;
    }
    const key = `${question.title || ""}||${question.question || ""}||${question.link || ""}`;
    return `local:${this.hashString(key)}`;
  }

  static hasNativeJoinIdentity(question = {}) {
    if (!question || typeof question !== "object") {
      return false;
    }
    if (question.question_uid && String(question.question_uid).trim()) {
      return true;
    }
    if (this.extractGateOverflowId(question.link || "")) {
      return true;
    }
    if (
      question.id_str != null &&
      question.volume != null &&
      String(question.id_str).trim()
    ) {
      return true;
    }
    if (getExamUidFromQuestion(question)) {
      return true;
    }
    return false;
  }

  static normalizeQuestion(question = {}) {
    const normalized =
      question && typeof question === "object" ? { ...question } : {};
    normalized.title = normalized.title || "";
    normalized.question = normalized.question || "";
    normalized.link = normalized.link || "";
    normalized.tags = Array.isArray(normalized.tags) ? normalized.tags : [];
    normalized.question_uid = this.buildQuestionUid(normalized);
    normalized.exam_uid = getExamUidFromQuestion(normalized) || "";
    return normalized;
  }

  static async init() {
    if (this.loaded) {
      return;
    }

    // For GitHub Pages, BASE_URL might be '/Gate_QA/' or './'.
    // We want to ensure we fetch from the correct root.
    // BASE_URL is now explicit in vite.config.js
    const baseUrl = import.meta.env.BASE_URL.endsWith('/')
      ? import.meta.env.BASE_URL
      : `${import.meta.env.BASE_URL}/`;

    const dataCandidates = [
      `${baseUrl}questions-with-answers.json`,
      `${baseUrl}questions-filtered-with-ids.json`,
      `${baseUrl}questions-filtered.json`,
    ];

    let bestCandidate = null;
    let lastStatus = 0;
    for (const dataUrl of dataCandidates) {
      const response = await fetch(dataUrl, { cache: "no-cache" });
      lastStatus = response.status;
      if (!response.ok) {
        continue;
      }
      const payload = await response.json();
      if (!Array.isArray(payload) || payload.length === 0) {
        continue;
      }

      const objectRows = payload.filter(
        (question) => question && typeof question === "object"
      );
      if (!objectRows.length) {
        continue;
      }

      const joinReadyCount = objectRows.reduce(
        (count, question) =>
          count + (this.hasNativeJoinIdentity(question) ? 1 : 0),
        0
      );
      const joinCoverage = joinReadyCount / objectRows.length;

      if (!bestCandidate || joinCoverage > bestCandidate.joinCoverage) {
        bestCandidate = {
          dataUrl,
          data: objectRows,
          joinCoverage,
          joinReadyCount,
        };
      }

      if (joinCoverage === 1) {
        break;
      }
    }

    if (!bestCandidate) {
      throw new Error(`Failed to load questions (${lastStatus}).`);
    }

    this.sourceUrl = bestCandidate.dataUrl;
    this.questions = bestCandidate.data.map((question) =>
      this.normalizeQuestion(question)
    );

    if (bestCandidate.joinCoverage < 1) {
      console.warn(
        `[QuestionService] Using ${bestCandidate.dataUrl} with ${bestCandidate.joinReadyCount}/${bestCandidate.data.length} native join identities.`
      );
    }

    this.loaded = true;
    this.buildIndexes();
  }

  static buildIndexes() {
    this.count = new Map();
    const tagSet = new Set();

    for (const question of this.questions) {
      for (const tag of question.tags || []) {
        tagSet.add(tag);
        this.count.set(tag, (this.count.get(tag) || 0) + 1);
      }
    }

    this.tags = Array.from(tagSet).sort((a, b) => a.localeCompare(b));
  }

  static getErrorQuestion(title = "No matching question for this filter.") {
    return {
      title,
      question: "",
      link: "",
      tags: [],
    };
  }

  static getRandomQuestion(tags = []) {
    if (!this.questions.length) {
      return this.getErrorQuestion("Questions are not loaded yet.");
    }

    if (!tags || tags.length === 0) {
      return this.questions[Math.floor(Math.random() * this.questions.length)];
    }

    const year = new Set();
    const tag = new Set();

    for (const t of tags) {
      if (t.startsWith("gate")) {
        year.add(t);
      } else {
        tag.add(t);
      }
    }

    const filtered = this.questions.filter((question) => {
      let valid = false;
      for (const y of year) {
        if (question.tags.includes(y)) {
          valid = true;
          break;
        }
      }

      if (!valid && year.size !== 0) return false;

      for (const t of tag) {
        if (question.tags.includes(t)) return true;
      }

      if (tag.size === 0) return true;

      return false;
    });

    if (filtered.length === 0) {
      return this.getErrorQuestion();
    }

    return filtered[Math.floor(Math.random() * filtered.length)];
  }

  static getTags() {
    return this.tags;
  }

  static getCount(tag) {
    return this.count.get(tag) || 0;
  }
}
