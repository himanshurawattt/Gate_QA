import { QuestionService } from "./QuestionService";

describe("QuestionService", () => {
  beforeEach(() => {
    QuestionService.questions = [];
    QuestionService.loaded = false;
    QuestionService.count = new Map();
    QuestionService.tags = [];
    QuestionService.sourceUrl = "";
  });

  test("builds tag indexes correctly", () => {
    QuestionService.questions = [
      { tags: ["gatecse-2024-set1", "graphs"] },
      { tags: ["gatecse-2024-set1", "dp"] },
      { tags: ["gatecse-2025-set1", "graphs"] },
    ];

    QuestionService.buildIndexes();

    expect(QuestionService.getCount("gatecse-2024-set1")).toBe(2);
    expect(QuestionService.getCount("graphs")).toBe(2);
    expect(QuestionService.getCount("missing")).toBe(0);
    expect(QuestionService.getTags()).toEqual([
      "dp",
      "gatecse-2024-set1",
      "gatecse-2025-set1",
      "graphs",
    ]);
  });

  test("filters by paper and topic tags", () => {
    QuestionService.questions = [
      { title: "Q1", tags: ["gatecse-2024-set1", "graphs"] },
      { title: "Q2", tags: ["gatecse-2024-set1", "dp"] },
      { title: "Q3", tags: ["gatecse-2025-set1", "graphs"] },
    ];
    QuestionService.buildIndexes();

    jest.spyOn(global.Math, "random").mockReturnValue(0);
    const result = QuestionService.getRandomQuestion([
      "gatecse-2024-set1",
      "graphs",
    ]);

    expect(result.title).toBe("Q1");
    global.Math.random.mockRestore();
  });

  test("returns an error object when filter has no matches", () => {
    QuestionService.questions = [
      { title: "Q1", tags: ["gatecse-2024-set1", "graphs"] },
    ];
    QuestionService.buildIndexes();

    const result = QuestionService.getRandomQuestion(["gatecse-2025-set2"]);

    expect(result.title).toContain("No matching question");
    expect(result.tags).toEqual([]);
  });

  test("does not overwrite existing question_uid", () => {
    const uid = QuestionService.buildQuestionUid({
      question_uid: "go:497",
      link: "https://gateoverflow.in/371497/another-link",
    });
    expect(uid).toBe("go:497");
  });
});
