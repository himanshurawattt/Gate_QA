import { AnswerService } from "./AnswerService";

describe("AnswerService", () => {
  beforeEach(() => {
    AnswerService.answersByQuestionUid = {};
    AnswerService.answersByUid = {};
    AnswerService.answersByExamUid = {};
    AnswerService.unsupportedQuestionUids = new Set();
    AnswerService.loaded = false;
    AnswerService.loadError = "";
  });

  test("builds answer uid for a question with id_str and volume", () => {
    const uid = AnswerService.getAnswerUid({
      volume: 2,
      id_str: "1.24.30",
    });
    expect(uid).toBe("v2:1.24.30");
  });

  test("builds question uid from gateoverflow link", () => {
    const uid = AnswerService.getQuestionUid({
      link: "https://gateoverflow.in/399311/gate-cse-2023-question-1",
    });
    expect(uid).toBe("go:399311");
  });

  test("extracts full gateoverflow numeric id without truncation", () => {
    expect(
      AnswerService.extractGateOverflowId(
        "https://gateoverflow.in/371497/sample-question"
      )
    ).toBe("371497");
    expect(
      AnswerService.extractGateOverflowId(
        "https://gateoverflow.in/497/gate-cse-2008-question-78"
      )
    ).toBe("497");
    expect(
      AnswerService.extractGateOverflowId("https://gateoverflow.in/blog/17024/post")
    ).toBeNull();
  });

  test("builds exam uid from gate cse link slug", () => {
    const examUid = AnswerService.getExamUid({
      link: "https://gateoverflow.in/460817/gate-cse-2025-set-2-question-18",
    });
    expect(examUid).toBe("cse:2025:set2:main:q18");
  });

  test("reports missing identity when no join keys are present", () => {
    const identity = AnswerService.getQuestionIdentity({
      title: "Sample without keys",
    });
    expect(identity.hasIdentity).toBe(false);
    expect(identity.reason).toBe("missing_join_keys");
  });

  test("treats local question_uid as storage-only identity", () => {
    const identity = AnswerService.getQuestionIdentity({
      question_uid: "local:abc123",
    });
    expect(identity.hasIdentity).toBe(false);
    expect(identity.storageUid).toBe("local:abc123");
    expect(AnswerService.getStorageKeyForQuestion({ question_uid: "local:abc123" })).toBe(
      "local:abc123"
    );
  });

  test("builds identity from volume + id_str when question_uid is absent", () => {
    const identity = AnswerService.getQuestionIdentity({
      volume: 1,
      id_str: "1.24.30",
    });
    expect(identity.hasIdentity).toBe(true);
    expect(identity.questionUid).toBeNull();
    expect(identity.answerUid).toBe("v1:1.24.30");
  });

  test("returns answer from question_uid map when present", () => {
    AnswerService.answersByQuestionUid = {
      "go:399311": {
        answer_uid: "v2:1.24.30",
        type: "MSQ",
        answer: ["A", "B", "C"],
      },
    };
    const answer = AnswerService.getAnswerForQuestion({
      question_uid: "go:399311",
    });
    expect(answer.type).toBe("MSQ");
  });

  test("falls back to answer uid map when question_uid is missing", () => {
    AnswerService.answersByUid = {
      "v2:1.24.30": {
        uid: "v2:1.24.30",
        type: "MCQ",
        answer: "A",
      },
    };
    const answer = AnswerService.getAnswerForQuestion({
      volume: 2,
      id_str: "1.24.30",
    });
    expect(answer.type).toBe("MCQ");
  });

  test("falls back to exam uid map when question_uid answer is missing", () => {
    AnswerService.answersByExamUid = {
      "cse:2008:set1:main:q78": {
        answer_uid: "exam:cse:2008:set1:main:q78",
        type: "MCQ",
        answer: "D",
      },
    };
    const answer = AnswerService.getAnswerForQuestion({
      question_uid: "go:497",
      link: "https://gateoverflow.in/497/gate-cse-2008-question-78",
      title: "GATE CSE 2008 | Question: 78",
      year: "gatecse-2008",
    });
    expect(answer.type).toBe("MCQ");
    expect(answer.answer).toBe("D");
  });

  test("hasAnswer returns false when record is missing", () => {
    expect(AnswerService.hasAnswer({ question_uid: "go:999999" })).toBe(false);
  });

  test("returns unsupported marker when question uid is in unsupported registry", () => {
    AnswerService.unsupportedQuestionUids = new Set(["go:401"]);
    const answer = AnswerService.getAnswerForQuestion({
      question_uid: "go:401",
      link: "https://gateoverflow.in/401/gate-cse-2008-question-3",
    });
    expect(answer.type).toBe("UNSUPPORTED");
    expect(answer.answer_uid).toBe("unsupported:go:401");
  });
});
