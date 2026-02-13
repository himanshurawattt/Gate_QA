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
    this.questions = bestCandidate.data
      .map((question) => this.normalizeQuestion(question))
      .filter((q) => q.title !== "General");

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

  static TOPIC_HIERARCHY = {
    "Discrete Mathematics": [
      "Combinatory", "Balls In Bins", "Counting", "Generating Functions", "Modular Arithmetic",
      "Pigeonhole Principle", "Recurrence Relation", "Summation", "Degree of Graph", "Graph Coloring",
      "Graph Connectivity", "Graph Isomorphism", "Graph Matching", "Graph Planarity", "First Order Logic",
      "Logical Reasoning", "Propositional Logic", "Binary Operation", "Countable Uncountable Set",
      "Functions", "Group Theory", "Identify Function", "Lattice", "Mathematical Induction",
      "Number Theory", "Onto", "Partial Order", "Polynomials", "Relations", "Set Theory"
    ],
    "Engineering Mathematics": [
      "Calculus", "Continuity", "Definite Integral", "Differentiation", "Integration", "Limits",
      "Maxima Minima", "Polynomials", "Linear Algebra", "Cartesian Coordinates", "Determinant",
      "Eigen Value", "Gaussian Elimination", "Lu Decomposition", "Matrix", "Orthonormality",
      "Rank of Matrix", "Singular Value Decomposition", "Subspace", "System of Equations", "Vector Space",
      "Probability", "Bayes Theorem", "Bayesian Network", "Bernoulli Distribution", "Binomial Distribution",
      "Conditional Probability", "Continuous Distribution", "Expectation", "Exponential Distribution",
      "Independent Events", "Normal Distribution", "Poisson Distribution", "Probability Density Function",
      "Probability Distribution", "Random Variable", "Square Invariant", "Statistics", "Uniform Distribution",
      "Variance"
    ],
    "General Aptitude": [
      "Analytical Aptitude", "Age Relation", "Code Words", "Coding Decoding", "Counting Figure",
      "Direction Sense", "Family Relationship", "Inequality", "Logical Inference", "Logical Reasoning",
      "Number Relations", "Odd One", "Passage Reading", "Round Table Arrangement", "Seating Arrangement",
      "Sequence Series", "Statements Follow", "Quantitative Aptitude", "Absolute Value", "Algebra",
      "Alligation Mixture", "Area", "Arithmetic Series", "Average", "Bar Graph", "Calendar",
      "Cartesian Coordinates", "Circle", "Clock Time", "Combinatory", "Compound Interest",
      "Conditional Probability", "Cones", "Contour Plots", "Cost Market Price", "Counting", "Cube",
      "Currency Notes", "Curves", "Data Interpretation", "Digital Image Processing", "Factors",
      "Fractions", "Functions", "Geometry", "Graph Coloring", "Inequality", "LCM HCF", "Line Graph",
      "Lines", "Logarithms", "Maps", "Maxima Minima", "Mensuration", "Modular Arithmetic", "Number Series",
      "Number System", "Number Theory", "Numerical Computation", "Percentage", "Permutation and Combination",
      "Pie Chart", "Polynomials", "Powers", "Prime Numbers", "Probability", "Probability Density Function",
      "Profit Loss", "Quadratic Equations", "Radar Chart", "Ratio Proportion", "Scatter Plot",
      "Seating Arrangement", "Sequence Series", "Set Theory", "Speed Time Distance", "Squares", "Statistics",
      "System of Equations", "Tables", "Tabular Data", "Triangles", "Trigonometry", "Unit Digit",
      "Venn Diagram", "Volume", "Work Time", "Spatial Aptitude", "Assembling Pieces", "Counting Figure",
      "Grouping", "Image Rotation", "Mirror Image", "Paper Folding", "Patterns In Three Dimensions",
      "Patterns In Two Dimensions", "Verbal Aptitude", "Articles", "Comparative Forms", "English Grammar",
      "Grammatical Error", "Incorrect Sentence Part", "Most Appropriate Word", "Narrative Sequencing",
      "Noun Verb Adjective", "Opposite", "Passage Reading", "Phrasal Verb", "Phrase Meaning",
      "Prepositions", "Pronouns", "Sentence Ordering", "Statement Sufficiency", "Statements Follow",
      "Synonyms", "Tenses", "Verbal Reasoning", "Word Meaning", "Word Pairs"
    ],
    "Algorithms": [
      "Algorithm Design", "Algorithm Design Technique", "Asymptotic Notation", "Asymptotic Notations",
      "Bellman Ford", "Binary Search", "Bitonic Array", "Depth First Search", "Dijkstras Algorithm",
      "Directed Graph", "Double Hashing", "Dynamic Programming", "Graph Algorithms", "Graph Search",
      "Greedy Algorithms", "Hashing", "Huffman Code", "Identify Function", "Insertion Sort",
      "Linear Probing", "Matrix Chain Ordering", "Merge Sort", "Merging", "Minimum Spanning Tree",
      "Prims Algorithm", "Quick Sort", "Recurrence Relation", "Recursion", "Searching", "Shortest Path",
      "Sorting", "Space Complexity", "Strongly Connected Components", "Time Complexity", "Topological Sort"
    ],
    "CO & Architecture": [
      "Addressing Modes", "Average Memory Access Time", "CISC RISC Architecture", "Cache Memory",
      "Clock Cycles", "DMA", "Data Dependency", "Data Path", "IO Handling", "Instruction Execution",
      "Instruction Format", "Instruction Set Architecture", "Interrupts", "Machine Instruction",
      "Memory Interfacing", "Microprogramming", "Pipelining", "Runtime Environment", "Speedup", "Virtual Memory"
    ],
    "Compiler Design": [
      "Assembler", "Backpatching", "Basic Blocks", "Code Optimization", "Compilation Phases",
      "Expression Evaluation", "First and Follow", "Grammar", "Intermediate Code", "LR Parser",
      "Lexical Analysis", "Linker", "Live Variable Analysis", "Macros", "Operator Precedence",
      "Parameter Passing", "Parsing", "Register Allocation", "Runtime Environment", "Static Single Assignment",
      "Symbol Table", "Syntax Directed Translation", "Variable Scope"
    ],
    "Computer Networks": [
      "Application Layer Protocols", "Arp", "Bit Stuffing", "Bridges", "CRC Polynomial", "CSMA CD",
      "Channel Utilization", "Communication", "Congestion Control", "Distance Vector Routing",
      "Error Detection", "Ethernet", "Fragmentation", "IP Addressing", "IP Packet", "LAN Technologies",
      "MAC Protocol", "Network Flow", "Network Layering", "Network Protocols", "Network Switching",
      "Osi Model", "Probability", "Routing", "Routing Protocols", "Sliding Window", "Sockets",
      "Stop and Wait", "Subnetting", "TCP", "Token Bucket", "UDP"
    ],
    "Databases": [
      "B Tree", "Candidate Key", "Conflict Serializable", "Database Design", "Database Normalization",
      "Decomposition", "ER Diagram", "Functional Dependency", "Indexing", "Joins", "Multivalued Dependency 4nf",
      "Natural Join", "Query", "Referential Integrity", "Relational Algebra", "Relational Calculus",
      "Relational Model", "SQL", "Transaction and Concurrency", "Tuple Relational Calculus"
    ],
    "Digital Logic": [
      "Adder", "Array Multiplier", "Boolean Algebra", "Booths Algorithm", "Canonical Normal Form",
      "Carry Generator", "Circuit Output", "Combinational Circuit", "Decoder", "Digital Circuits",
      "Digital Counter", "Finite State Machines", "Fixed Point Representation", "Flip Flop",
      "Floating Point Representation", "Functional Completeness", "IEEE Representation", "K Map",
      "Memory Interfacing", "Min No Gates", "Min Products of Sum Form", "Min Sum of Products Form",
      "Multiplexer", "Number Representation", "Prime Implicants", "ROM", "Ripple Counter Operation",
      "Sequential Circuit", "Shift Registers", "Static Hazard", "Synchronous Asynchronous Circuits"
    ],
    "Operating System": [
      "Context Switch", "Deadlock Prevention Avoidance Detection", "Disk", "Disk Scheduling", "File System",
      "Fork System Call", "IO Handling", "Input Output", "Inter Process Communication", "Interrupts",
      "Linked Allocation", "Memory Management", "Multilevel Paging", "OS Protection", "Optimal Page Replacement",
      "Page Replacement", "Precedence Graph", "Process", "Process Scheduling", "Process Synchronization",
      "Resource Allocation", "Resource Allocation Graph", "Semaphore", "Srtf", "System Calls", "Threads",
      "Virtual Memory"
    ],
    "Programming and DS": [
      "AVL Tree", "Array", "Binary Heap", "Binary Search Tree", "Binary Tree", "Data Structures",
      "Hashing", "Infix Prefix", "Linked List", "Number of Swap", "Priority Queue", "Queue", "Stack",
      "Time Complexity", "Tree"
    ],
    "Programming in C": [
      "Aliasing", "Array", "Functions", "Goto", "Identify Function", "Loop Invariants", "Output",
      "Parameter Passing", "Pointers", "Programming Constructs", "Programming In C", "Programming Paradigms",
      "Recursion", "Strings", "Structure", "Switch Case", "Type Checking", "Union", "Variable Binding"
    ],
    "Theory of Computation": [
      "Closure Property", "Context Free Grammar", "Context Free Language", "Countable Uncountable Set",
      "Decidability", "Dpda", "Finite Automata", "Finite State Machines", "Identify Class Language",
      "Minimal State Automata", "Non Determinism", "Number of States", "Pumping Lemma", "Pushdown Automata",
      "Recursive and Recursively Enumerable Languages", "Reduction", "Regular Expression", "Regular Grammar",
      "Regular Language"
    ]
  };

  // Helper to normalize strings for comparison (lowercase, handle slight variations if needed)
  static normalizeString(str) {
    return str.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  static getStructuredTags() {
    const years = [];
    // Convert strict hierarchy to map for easier lookup
    // Map<NormalizedSubtopic, DisplaySubtopic>
    // We also need to map NormalizedTopic -> DisplayTopic
    const topicMap = new Map();
    const subtopicMap = new Map(); // NormalizedSubtopic -> Set<DisplayTopic> (One subtopic might belong to multiple topics potentially? Unlikely based on list, but good to handle)

    const structuredTopics = {};

    Object.keys(this.TOPIC_HIERARCHY).forEach(topic => {
      structuredTopics[topic] = []; // Initialize
      this.TOPIC_HIERARCHY[topic].forEach(sub => {
        const normSub = this.normalizeString(sub);
        subtopicMap.set(normSub, {
          display: sub,
          topic: topic
        });
      });
    });

    // We will scan all available tags in the system
    // If a tag matches a known year, add to years.
    // If a tag matches (roughly) a known topic or subtopic, classify it.

    const validTopics = new Set(Object.keys(this.TOPIC_HIERARCHY));

    // Some questions might use tags that match the TOPIC name itself (e.g. "Data Structures")
    // or tags that match SUBTOPIC names.
    // The user's provided list is Title Case like "Data Structures", "Graph Theory".
    // Sometimes the tag in JSON might be "operating-system" (Topic) or "paging" (Subtopic).

    for (const tag of this.tags) {
      if (tag.startsWith("gate")) {
        years.push(tag);
      }
    }

    // Filter out redundant generic years (e.g., 'gate2024') if specific sets exist (e.g., 'gate20241')
    // We group tags by their 4-digit year.
    const yearGroups = {};
    years.forEach(tag => {
      const match = tag.match(/(\d{4})/);
      if (match) {
        const y = match[1];
        if (!yearGroups[y]) yearGroups[y] = [];
        yearGroups[y].push(tag);
      }
    });

    const filteredYears = [];
    Object.keys(yearGroups).forEach(year => {
      const group = yearGroups[year];
      // Check if this group has any "Set" tags.
      // We assume a "Set" tag has more than 4 digits in its numeric part (e.g., 20241 has length 5).
      const hasSets = group.some(t => t.replace(/[^0-9]/g, '').length > 4);

      if (hasSets) {
        // Only include the set-specific tags
        group.forEach(t => {
          if (t.replace(/[^0-9]/g, '').length > 4) {
            filteredYears.push(t);
          }
        });
      } else {
        // Include all (likely just the generic one)
        filteredYears.push(...group);
      }
    });

    // Replace original years array with filtered one
    years.length = 0;
    years.push(...filteredYears);

    // Now populate the structuredTopics based on what is actually present in the questions
    // But the user explicitly said: "i want them only related syllabus topics not unnecessary topics"
    // So we should only show subtopics that EXIST in the question set AND are Valid.

    const availableSubtopics = new Set();

    this.questions.forEach(q => {
      q.tags.forEach(t => {
        // Check if 't' matches any known subtopic (fuzzy match?)
        // The JSON tags are hyphenated strings like "data-structures", "graph-theory".
        // The user list is Title Case like "Data Structures", "Graph Theory".
        const normTag = this.normalizeString(t);

        if (subtopicMap.has(normTag)) {
          const { display, topic } = subtopicMap.get(normTag);
          if (!structuredTopics[topic].includes(display)) {
            structuredTopics[topic].push(display);
          }
        }

        // Also check if the tag matches a Topic name directly?
        // e.g. if tag is "operating-system", does it map to "Operating System"?
        // If so, it's a general tag for that topic.
        // The user's request focused on cleaning subtopics.
      });
    });

    // Sort subtopics
    Object.keys(structuredTopics).forEach(t => {
      structuredTopics[t].sort();
      // Remove topics with no active subtopics? 
      // Or keep them? User "providing subjects and all subtopics I want them only filter".
      // Let's keep only topics that have at least one subtopic or match? 
      // Actually, if a topic has 0 matching subtopics found in the current dataset, it's useless filter.
      if (structuredTopics[t].length === 0) {
        delete structuredTopics[t];
      }
    });

    // Extract numeric years for range slider
    const numericYears = years.map(y => {
      const match = y.match(/\d{4}/);
      return match ? parseInt(match[0], 10) : 0;
    }).filter(y => y > 0);

    return {
      years: years.sort().reverse(), // descending
      topics: Object.keys(structuredTopics).sort(),
      structuredTopics,
      minYear: Math.min(...numericYears),
      maxYear: Math.max(...numericYears)
    };
  }

  static getMinMaxYears() {
    const years = [];
    for (const tag of this.tags) {
      if (tag.startsWith("gate")) {
        const match = tag.match(/\d{4}/);
        if (match) years.push(parseInt(match[0], 10));
      }
    }
    if (years.length === 0) return { min: 2000, max: 2025 };
    return { min: Math.min(...years), max: Math.max(...years) };
  }

  static getCount(tag) {
    return this.count.get(tag) || 0;
  }
}
