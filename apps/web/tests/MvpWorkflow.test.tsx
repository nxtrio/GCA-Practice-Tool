// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { RunResult, Session } from "@gca-practice/contracts";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App.tsx";
import { demoAssessment } from "../src/assessment/demoAssessment.ts";
import type { AssessmentResultView } from "../src/api/importClient.ts";

vi.mock("@monaco-editor/react", () => ({
  default: ({ value, onChange, options }: { value: string; onChange(value: string): void; options: { ariaLabel: string; readOnly: boolean } }) => (
    <textarea aria-label={options.ariaLabel} value={value} readOnly={options.readOnly} onChange={(event) => onChange(event.target.value)} />
  ),
  loader: { config: vi.fn() },
}));
vi.mock("../src/editor/monacoEnvironment.ts", () => ({ configureLocalMonaco: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("MVP browser workflow", () => {
  it("imports, runs, submits, preserves code, finishes, and displays results", async () => {
    const session = activeSession();
    const execution: RunResult = {
      verdict: "accepted",
      passed: 1,
      total: 1,
      tests: [{ visibility: "visible", testId: "p1-v1", verdict: "accepted", executionTimeMs: 2, expected: 6, actual: 6 }],
    };
    const submitted: RunResult = {
      verdict: "accepted",
      passed: 2,
      total: 2,
      tests: [...execution.tests, { visibility: "hidden", verdict: "accepted", executionTimeMs: 2 }],
    };
    const result = finalResult();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      const method = init?.method ?? "GET";
      if (path.endsWith("/api/problem-catalog")) return json([]);
      if (path.endsWith("/api/environment")) return json(environment());
      if (path.endsWith("/api/assessments/validate")) return json({ valid: true, validationId: "validation-1", assessment: { title: demoAssessment.title, durationSeconds: demoAssessment.durationSeconds, problems: demoAssessment.problems }, errors: [], warnings: [] });
      if (path.endsWith("/api/assessments/import")) return json({ ...demoAssessment, id: "assessment-1" }, 201);
      if (path.endsWith("/api/sessions") && method === "POST") return json(session, 201);
      if (path.endsWith("/api/sessions/session-1") && method === "GET") return json({ session, assessment: demoAssessment, code: [], remainingMs: 4_200_000 });
      if (path.endsWith("/code") && method === "PATCH") return json({ ok: true });
      if (path.endsWith("/api/execution/run")) return json(execution);
      if (path.endsWith("/api/execution/submit")) return json(submitted);
      if (path.endsWith("/finish") && method === "POST") return json(result);
      if (path.endsWith("/results")) return json(result);
      throw new Error(`Unexpected request: ${method} ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<MemoryRouter initialEntries={["/import"]}><App /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("checkbox", { name: /I trust this assessment source/ }));
    fireEvent.change(await screen.findByLabelText("Assessment JSON"), { target: { value: "{\"schemaVersion\":\"1.0\"}" } });
    expect(await screen.findByText("Assessment is ready", {}, { timeout: 2_000 })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /Start Assessment/ }));

    const editor = await screen.findByLabelText("java code editor");
    fireEvent.change(editor, { target: { value: "int solution(int[] values) { return 6; }" } });
    fireEvent.click(screen.getByRole("button", { name: "Run visible tests" }));
    expect(await screen.findByText("1/1 passed · Passed")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByText("2/2 passed · Passed")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /Question 2:/ }));
    fireEvent.change(screen.getByLabelText("Programming language"), { target: { value: "python" } });
    fireEvent.click(screen.getByRole("button", { name: /Question 1:/ }));
    fireEvent.change(screen.getByLabelText("Programming language"), { target: { value: "java" } });
    expect((screen.getByLabelText("java code editor") as HTMLTextAreaElement).value).toBe("int solution(int[] values) { return 6; }");

    fireEvent.click(screen.getByRole("button", { name: "Finish session" }));
    expect(await screen.findByText("Assessment complete")).toBeDefined();
    expect(screen.getByText("1 / 4")).toBeDefined();
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/finish"))).toBe(true));
  }, 10_000);
});

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
}

function environment() {
  return {
    java: { available: true, version: "21", javaPath: "/java", javacPath: "/javac" },
    cpp: { available: true, version: "clang 18", compiler: "clang++", compilerPath: "/clang++" },
    python: { available: true, version: "3.13", pythonPath: "/python3" },
  };
}

function activeSession(): Session {
  return { id: "session-1", assessmentId: "assessment-1", status: "active", startedAt: "2026-08-16T12:00:00.000Z", expiresAt: "2099-08-16T13:10:00.000Z", finishedAt: null, createdAt: "2026-08-16T12:00:00.000Z" };
}

function finalResult(): AssessmentResultView {
  return {
    sessionId: "session-1", assessmentId: "assessment-1", assessmentTitle: demoAssessment.title, status: "completed",
    startedAt: "2026-08-16T12:00:00.000Z", expiresAt: "2026-08-16T13:10:00.000Z", finishedAt: "2026-08-16T13:00:00.000Z",
    problemsSolved: 1, problemCount: 4, testsPassed: 2, testsTotal: 8, timeUsedMs: 3_600_000, timeRemainingMs: 600_000,
    problems: demoAssessment.problems.map((problem, index) => ({ problemId: problem.id, slot: problem.slot, title: problem.title, verdict: index === 0 ? "accepted" : "not_attempted", passed: index === 0 ? 2 : 0, total: 2, ...(index === 0 ? { language: "java" as const } : {}) })),
  };
}
