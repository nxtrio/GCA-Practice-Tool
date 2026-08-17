import { access, readFile } from "node:fs/promises";
import type {
  FunctionSignature,
  Language,
  ProblemLimits,
  TestCase,
} from "@gca-practice/contracts";
import { beforeAll, describe, expect, it } from "vitest";
import {
  ProcessRunner,
  PythonRunner,
  RunnerRegistry,
  type LanguageRunner,
  type TestExecutionResult,
} from "../src/index.ts";

const languages: Language[] = ["java", "cpp", "python"];
const defaultLimits: ProblemLimits = {
  executionTimeMs: 500,
  compileTimeMs: 10_000,
  outputLimitBytes: 64 * 1024,
};
const arraySignature: FunctionSignature = {
  name: "solution",
  parameters: [
    {
      name: "values",
      type: { kind: "array", items: { kind: "int" } },
    },
  ],
  returnType: { kind: "int" },
};
const arrayTests: TestCase[] = [
  {
    id: "v1",
    arguments: [[1, 2, 3]],
    expected: 6,
    category: "example",
  },
  {
    id: "h1",
    arguments: [[]],
    expected: 0,
    category: "boundary",
  },
];

let registry: RunnerRegistry;

beforeAll(async () => {
  registry = await RunnerRegistry.detect();
});

describe.each(languages)("%s runner", (language) => {
  it(
    "accepts correct code, compiles once, runs tests separately, and captures debug output",
    async () => {
      const runner = requiredRunner(language);
      const { program, results } = await prepareAndRun(
        runner,
        language,
        arraySignature,
        sourceFor(language, "accepted"),
        arrayTests,
      );

      expect(program.preparationVerdict).toBe("accepted");
      expect(results.map((result) => result.verdict)).toEqual([
        "accepted",
        "accepted",
      ]);
      expect(results.map((result) => result.actual)).toEqual([6, 0]);
      expect(results.every((result) => result.stdout === "debug")).toBe(true);
      await expect(access(program.workspacePath)).rejects.toMatchObject({
        code: "ENOENT",
      });
    },
    30_000,
  );

  it(
    "returns wrong_answer with the actual value",
    async () => {
      const { results } = await prepareAndRun(
        requiredRunner(language),
        language,
        arraySignature,
        sourceFor(language, "wrong"),
        [arrayTests[0]!],
      );

      expect(results[0]).toMatchObject({
        verdict: "wrong_answer",
        expected: 6,
        actual: 0,
      });
    },
    30_000,
  );

  it(
    "reports syntax and compile errors without running a test",
    async () => {
      const runner = requiredRunner(language);
      const program = await runner.prepare({
        language,
        source: sourceFor(language, "syntax"),
        signature: arraySignature,
        tests: [arrayTests[0]!],
        limits: defaultLimits,
      });

      try {
        expect(program.preparationVerdict).toBe("compile_error");
        expect(program.compileStderr.length).toBeGreaterThan(0);
        const result = await runner.runTest(program, arrayTests[0]!);
        expect(result.verdict).toBe("compile_error");
        expect(result.executionTimeMs).toBe(0);
      } finally {
        await runner.cleanup(program);
      }
    },
    30_000,
  );

  it(
    "reports runtime exceptions and crashes",
    async () => {
      const { results } = await prepareAndRun(
        requiredRunner(language),
        language,
        arraySignature,
        sourceFor(language, "runtime"),
        [arrayTests[0]!],
      );

      expect(results[0]?.verdict).toBe("runtime_error");
      expect(results[0]?.stderr.length).toBeGreaterThan(0);
    },
    30_000,
  );

  it(
    "reports per-test timeouts",
    async () => {
      const { results } = await prepareAndRun(
        requiredRunner(language),
        language,
        arraySignature,
        sourceFor(language, "timeout"),
        [arrayTests[0]!],
        { ...defaultLimits, executionTimeMs: 150 },
      );

      expect(results[0]?.verdict).toBe("time_limit_exceeded");
    },
    30_000,
  );

  it(
    "reports and caps runaway candidate output",
    async () => {
      const { results } = await prepareAndRun(
        requiredRunner(language),
        language,
        arraySignature,
        sourceFor(language, "output"),
        [arrayTests[0]!],
        { ...defaultLimits, outputLimitBytes: 4_096 },
      );

      expect(results[0]?.verdict).toBe("output_limit_exceeded");
      expect(Buffer.byteLength(results[0]?.stdout ?? "")).toBeLessThanOrEqual(
        4_096,
      );
    },
    30_000,
  );

  it(
    "round-trips matrices and long results",
    async () => {
      const matrixSignature: FunctionSignature = {
        name: "solution",
        parameters: [
          {
            name: "matrix",
            type: {
              kind: "array",
              items: { kind: "array", items: { kind: "int" } },
            },
          },
        ],
        returnType: { kind: "long" },
      };
      const matrixTest: TestCase = {
        id: "matrix",
        arguments: [[[], [1, 2], [-3, 5]]],
        expected: 5,
        category: "matrix",
      };
      const { results } = await prepareAndRun(
        requiredRunner(language),
        language,
        matrixSignature,
        sourceFor(language, "matrix"),
        [matrixTest],
      );

      expect(results[0]).toMatchObject({ verdict: "accepted", actual: 5 });
    },
    30_000,
  );

  it(
    "round-trips escaped and Unicode strings",
    async () => {
      const stringSignature: FunctionSignature = {
        name: "solution",
        parameters: [{ name: "text", type: { kind: "string" } }],
        returnType: { kind: "string" },
      };
      const value =
        'quote " slash \\ newline\n tab\t return\r nul\0 café 😀';
      const stringTest: TestCase = {
        id: "string",
        arguments: [value],
        expected: value,
        category: "escaping",
      };
      const { results } = await prepareAndRun(
        requiredRunner(language),
        language,
        stringSignature,
        sourceFor(language, "string"),
        [stringTest],
      );

      expect(results[0]).toMatchObject({
        verdict: "accepted",
        actual: value,
      });
    },
    30_000,
  );
});

describe("runner coordination", () => {
  it(
    "serializes concurrent test requests for one prepared program",
    async () => {
      const language: Language = "python";
      const runner = requiredRunner(language);
      const source = [
        "def solution(values):",
        "    import time",
        '    with open("order.log", "a", encoding="utf-8") as output:',
        '        output.write("start\\n")',
        "    time.sleep(0.1)",
        '    with open("order.log", "a", encoding="utf-8") as output:',
        '        output.write("end\\n")',
        "    return sum(values)",
      ].join("\n");
      const program = await runner.prepare({
        language,
        source,
        signature: arraySignature,
        tests: arrayTests,
        limits: defaultLimits,
      });

      try {
        const results = await Promise.all(
          arrayTests.map((test) => runner.runTest(program, test)),
        );
        expect(results.map((result) => result.verdict)).toEqual([
          "accepted",
          "accepted",
        ]);
        expect(await readFile(`${program.workspacePath}/order.log`, "utf8")).toBe(
          "start\nend\nstart\nend\n",
        );
      } finally {
        await runner.cleanup(program);
      }
    },
    30_000,
  );

  it("rejects candidate source above the configured size limit", async () => {
    const python = registry.toolchains.python;
    if (!python.available) throw new Error("python toolchain is required");
    const runner = new PythonRunner(python, new ProcessRunner(), 16);

    await expect(
      runner.prepare({
        language: "python",
        source: "def solution(values):\n    return sum(values)",
        signature: arraySignature,
        tests: [arrayTests[0]!],
        limits: defaultLimits,
      }),
    ).rejects.toThrow("Candidate source exceeds the 16-byte limit");
  });
});

function requiredRunner(language: Language): LanguageRunner {
  const runner = registry.get(language);
  if (!runner) throw new Error(`${language} toolchain is required for this test`);
  return runner;
}

async function prepareAndRun(
  runner: LanguageRunner,
  language: Language,
  signature: FunctionSignature,
  source: string,
  tests: TestCase[],
  limits: ProblemLimits = defaultLimits,
): Promise<{
  program: Awaited<ReturnType<LanguageRunner["prepare"]>>;
  results: TestExecutionResult[];
}> {
  const program = await runner.prepare({
    language,
    source,
    signature,
    tests,
    limits,
  });
  const results: TestExecutionResult[] = [];

  try {
    for (const test of tests) {
      results.push(await runner.runTest(program, test));
    }
  } finally {
    await runner.cleanup(program);
  }

  return { program, results };
}

function sourceFor(
  language: Language,
  scenario:
    | "accepted"
    | "wrong"
    | "syntax"
    | "runtime"
    | "timeout"
    | "output"
    | "matrix"
    | "string",
): string {
  const sources: Record<Language, Record<typeof scenario, string>> = {
    java: {
      accepted:
        'int solution(int[] values) { System.out.print("debug"); int total = 0; for (int value : values) total += value; return total; }',
      wrong: "int solution(int[] values) { return 0; }",
      syntax: "int solution(int[] values) { return ; }",
      runtime:
        'int solution(int[] values) { throw new RuntimeException("boom"); }',
      timeout: "int solution(int[] values) { while (true) {} }",
      output:
        'int solution(int[] values) { System.out.print("x".repeat(1024 * 1024)); return 0; }',
      matrix:
        "long solution(int[][] matrix) { long total = 0; for (int[] row : matrix) for (int value : row) total += value; return total; }",
      string: "String solution(String text) { return text; }",
    },
    cpp: {
      accepted:
        'int solution(vector<int> values) { cout << "debug"; return accumulate(values.begin(), values.end(), 0); }',
      wrong: "int solution(vector<int> values) { return 0; }",
      syntax: "int solution(vector<int> values) { return ; }",
      runtime:
        'int solution(vector<int> values) { throw runtime_error("boom"); }',
      timeout: "int solution(vector<int> values) { while (true) {} }",
      output:
        "int solution(vector<int> values) { cout << string(1024 * 1024, 'x'); return 0; }",
      matrix:
        "long long solution(vector<vector<int>> matrix) { long long total = 0; for (const auto& row : matrix) for (int value : row) total += value; return total; }",
      string: "string solution(string text) { return text; }",
    },
    python: {
      accepted:
        'def solution(values):\n    print("debug", end="")\n    return sum(values)',
      wrong: "def solution(values):\n    return 0",
      syntax: "def solution(values)\n    return 0",
      runtime: 'def solution(values):\n    raise RuntimeError("boom")',
      timeout: "def solution(values):\n    while True:\n        pass",
      output:
        'def solution(values):\n    print("x" * (1024 * 1024), end="")\n    return 0',
      matrix:
        "def solution(matrix):\n    return sum(sum(row) for row in matrix)",
      string: "def solution(text):\n    return text",
    },
  };
  return sources[language][scenario];
}
