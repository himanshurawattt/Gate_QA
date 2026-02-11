export class QuestionService {
  static questions = [];
  static loaded = false;
  static count = new Map();
  static tags = [];

  static async init() {
    if (this.loaded) {
      return;
    }

    // For GitHub Pages, BASE_URL might be '/Gate_QA/' or './'.
    // We want to ensure we fetch from the correct root.
    const baseUrl = import.meta.env.BASE_URL.endsWith('/')
      ? import.meta.env.BASE_URL
      : `${import.meta.env.BASE_URL}/`;

    const dataUrl = new URL('questions-filtered.json', new URL(baseUrl, window.location.origin)).href;
    const response = await fetch(dataUrl, { cache: "no-cache" });

    if (!response.ok) {
      throw new Error(`Failed to load questions (${response.status}).`);
    }

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("Question bank is empty or invalid.");
    }

    this.questions = data;
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
