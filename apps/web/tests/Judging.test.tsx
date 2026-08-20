// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type {
  ExecutionVerdict,
  RunRequest,
  RunResult,
} from "@gca-practice/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { JudgeClient } from "../src/api/client.ts";
import { demoAssessment } from "../src/assessment/demoAssessment.ts";
import { MemoryCodePersistence } from "../src/editor/codePersistence.ts";
import { AssessmentPage } from "../src/pages/AssessmentPage.tsx";

vi.mock("@monaco-editor/react", () => ({
  default: ({
    defaultValue,
    value,
    onChange,
    options,
  }: {
    defaultValue?: string;
    value?: string;
    onChange: (value: string) => void;
    options: { ariaLabel: string; readOnly: boolean };
  }) => (
    <textarea
      aria-label={options.ariaLabel}
      value={value ?? defaultValue}
      readOnly={options.readOnly}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

afterEach(() => cleanup());

const expiresAt = "2099-08-16T13:10:00.000Z";

describe("AssessmentPage judging", () => {
  it("marks a fully accepted submission as solved", async () => {
    const execute = vi.fn(async (): Promise<RunResult> => ({
      verdict: "accepted",
      passed: 2,
      total: 2,
      tests: [
        {
          visibility: "visible",
          testId: "p1-v1",
          verdict: "accepted",
          executionTimeMs: 2,
          expected: 6,
          actual: 6,
        },
        {
          visibility: "hidden",
          verdict: "accepted",
          executionTimeMs: 3,
        },
      ],
    }));
    renderPage({ execute });

    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("2/2 passed · Passed")).toBeDefined();
    expect(
      screen.getByRole("button", { name: /Question 1:.*solved/ }),
    ).toBeDefined();
  });

  it("runs visible tests and renders expected, actual, output, and timing", async () => {
    const execute = vi.fn(async (_request: RunRequest): Promise<RunResult> => ({
      verdict: "wrong_answer",
      compileTimeMs: 18,
      passed: 0,
      total: 1,
      tests: [
        {
          visibility: "visible",
          testId: "p1-v1",
          verdict: "wrong_answer",
          executionTimeMs: 7,
          expected: 6,
          actual: 7,
          stdout: "candidate debug output",
        },
      ],
    }));
    renderPage({ execute });
    fireEvent.change(screen.getByLabelText("java code editor"), {
      target: { value: "candidate source" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Run visible tests" }));

    expect((await screen.findAllByText("Wrong answer")).length).toBeGreaterThan(0);
    expect(screen.getByText("7 ms")).toBeDefined();
    expect(screen.getByText("candidate debug output")).toBeDefined();
    expect(screen.getByText("7")).toBeDefined();
    expect(execute).toHaveBeenCalledWith({
      sessionId: "session-judge",
      problemId: "p1",
      language: "java",
      source: "candidate source",
      mode: "run",
    });
  });

  it("shows hidden pass/fail metadata without rendering hidden details", async () => {
    const secret = "NEVER_RENDER_THIS_HIDDEN_VALUE";
    const execute = vi.fn(async (): Promise<RunResult> => ({
      verdict: "wrong_answer",
      passed: 1,
      total: 2,
      tests: [
        {
          visibility: "visible",
          testId: "p1-v1",
          verdict: "accepted",
          executionTimeMs: 3,
          expected: 6,
          actual: 6,
        },
        ({
          visibility: "hidden",
          verdict: "wrong_answer",
          executionTimeMs: 5,
          testId: "p1-h1",
          expected: secret,
          actual: secret,
          stdout: secret,
          stderr: secret,
        } as never),
      ],
    }));
    renderPage({ execute });

    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("Hidden test 1")).toBeDefined();
    expect(screen.getByText("5 ms · testcase details are private")).toBeDefined();
    expect(document.body.textContent).not.toContain(secret);
    expect(screen.queryByText("p1-h1")).toBeNull();
    expect(
      screen.getByRole("button", { name: /Question 1:.*partial/ }),
    ).toBeDefined();
  });

  it.each([
    ["compile_error", "Compile error"],
    ["runtime_error", "Runtime error"],
    ["time_limit_exceeded", "Time limit exceeded"],
    ["output_limit_exceeded", "Output limit exceeded"],
  ] as const)("renders %s diagnostics", async (verdict, label) => {
    const judgeClient = diagnosticClient(verdict, label);
    renderPage(judgeClient);

    fireEvent.click(screen.getByRole("button", { name: "Run visible tests" }));

    await waitFor(() =>
      expect(screen.getAllByText(label).length).toBeGreaterThan(0),
    );
    expect(screen.getByText(`${label} details`)).toBeDefined();
    expect(screen.getByText(`${label} stderr`)).toBeDefined();
  });
});

function renderPage(judgeClient: JudgeClient) {
  return render(
    <AssessmentPage
      sessionId="session-judge"
      assessment={demoAssessment}
      expiresAt={expiresAt}
      persistence={new MemoryCodePersistence()}
      judgeClient={judgeClient}
    />,
  );
}

function diagnosticClient(
  verdict: ExecutionVerdict,
  label: string,
): JudgeClient {
  return {
    async execute() {
      return {
        verdict,
        passed: 0,
        total: 1,
        tests: [
          {
            visibility: "visible",
            testId: "p1-v1",
            verdict,
            executionTimeMs: 9,
            expected: 6,
            message: `${label} details`,
            stderr: `${label} stderr`,
          },
        ],
      };
    },
  };
}
