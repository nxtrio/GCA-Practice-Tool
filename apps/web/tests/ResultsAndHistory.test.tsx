// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AssessmentResultView, ImportWorkflowClient } from "../src/api/importClient.ts";
import { HistoryPage } from "../src/pages/HistoryPage.tsx";
import { ResultsPage } from "../src/pages/ResultsPage.tsx";

afterEach(() => cleanup());

const result: AssessmentResultView = {
  sessionId: "session-1",
  assessmentId: "assessment-1",
  assessmentTitle: "Sunday Practice",
  preset: "gca",
  status: "completed",
  startedAt: "2026-08-16T12:00:00.000Z",
  expiresAt: "2026-08-16T13:10:00.000Z",
  finishedAt: "2026-08-16T13:05:42.000Z",
  problemsSolved: 3,
  problemCount: 4,
  testsPassed: 72,
  testsTotal: 81,
  timeUsedMs: 3_942_000,
  timeRemainingMs: 258_000,
  problems: [
    { problemId: "p1", slot: 1, title: "Array Total", verdict: "accepted", passed: 15, total: 15, language: "python" },
    { problemId: "p2", slot: 2, title: "Mirror Text", verdict: "accepted", passed: 18, total: 18, language: "java" },
    { problemId: "p3", slot: 3, title: "Matrix Total", verdict: "wrong_answer", passed: 14, total: 20, language: "cpp" },
    { problemId: "p4", slot: 4, title: "All Flags", verdict: "accepted", passed: 25, total: 28, language: "python" },
  ],
};

describe("Phase 10 result and history pages", () => {
  it("renders the required final summary and problem breakdown", async () => {
    const client = partialClient({ results: vi.fn(async () => result) });
    render(<MemoryRouter initialEntries={["/results/session-1"]}><Routes><Route path="/results/:sessionId" element={<ResultsPage client={client} />} /></Routes></MemoryRouter>);

    expect(await screen.findByText("Sunday Practice")).toBeDefined();
    expect(screen.getByText("3 / 4")).toBeDefined();
    expect(screen.getByText("72 / 81")).toBeDefined();
    expect(screen.getByText("1:05:42")).toBeDefined();
    expect(screen.getByText("04:18")).toBeDefined();
    expect(screen.getByText("14/20")).toBeDefined();
    const exportLink = screen.getByRole("link", { name: "Export analysis JSON" });
    expect(exportLink.getAttribute("href")).toBe("/api/sessions/session-1/export");
    expect(exportLink.getAttribute("download")).toBe(
      "sunday-practice-readiness-analysis.json",
    );
  });

  it("links unfinished sessions for resume and completed sessions to results", async () => {
    const client = partialClient({ history: vi.fn(async () => ({
      unfinished: [{ sessionId: "active-1", assessmentTitle: "Active Practice", preset: "gca" as const, startedAt: result.startedAt, expiresAt: result.expiresAt, problemsSolved: 1, problemCount: 4 }],
      completed: [result],
    })) });
    render(<MemoryRouter><HistoryPage client={client} /></MemoryRouter>);

    expect(await screen.findByText("Active Practice")).toBeDefined();
    expect(screen.getByRole("link", { name: /Active Practice/ }).getAttribute("href")).toBe("/assessment/active-1");
    expect(screen.getByRole("link", { name: "View results" }).getAttribute("href")).toBe("/results/session-1");
    expect(screen.getByRole("button", { name: "Redo Sunday Practice" })).toBeDefined();
  });

  it("starts a fresh session from a selected history entry", async () => {
    const user = userEvent.setup();
    const startSession = vi.fn(async () => ({
      id: "session-redo",
      assessmentId: result.assessmentId,
      status: "active" as const,
      startedAt: "2026-08-16T14:00:00.000Z",
      expiresAt: "2026-08-16T15:10:00.000Z",
      finishedAt: null,
      createdAt: "2026-08-16T14:00:00.000Z",
    }));
    const client = partialClient({
      startSession,
      history: vi.fn(async () => ({ unfinished: [], completed: [result] })),
    });
    render(
      <MemoryRouter initialEntries={["/history"]}>
        <Routes>
          <Route path="/history" element={<HistoryPage client={client} />} />
          <Route path="/assessment/:sessionId" element={<p>Fresh assessment session</p>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole("button", { name: "Redo Sunday Practice" }));

    expect(startSession).toHaveBeenCalledWith("assessment-1");
    expect(await screen.findByText("Fresh assessment session")).toBeDefined();
  });

  it("restarts the same assessment directly from its results", async () => {
    const user = userEvent.setup();
    const startSession = vi.fn(async () => ({
      id: "session-redo",
      assessmentId: result.assessmentId,
      status: "active" as const,
      startedAt: "2026-08-16T14:00:00.000Z",
      expiresAt: "2026-08-16T15:10:00.000Z",
      finishedAt: null,
      createdAt: "2026-08-16T14:00:00.000Z",
    }));
    const client = partialClient({
      results: vi.fn(async () => result),
      startSession,
    });
    render(
      <MemoryRouter initialEntries={["/results/session-1"]}>
        <Routes>
          <Route path="/results/:sessionId" element={<ResultsPage client={client} />} />
          <Route path="/assessment/:sessionId" element={<p>Fresh assessment session</p>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole("button", { name: "Redo this assessment" }));

    expect(startSession).toHaveBeenCalledWith("assessment-1");
    expect(await screen.findByText("Fresh assessment session")).toBeDefined();
  });

  it("labels Roblox results and history without GCA branding", async () => {
    const robloxResult: AssessmentResultView = {
      ...result,
      assessmentTitle: "Roblox Practice Set",
      preset: "roblox",
      problemsSolved: 1,
      problemCount: 2,
      problems: result.problems.slice(0, 2),
    };
    const resultsRender = render(
      <MemoryRouter initialEntries={["/results/session-1"]}>
        <Routes>
          <Route
            path="/results/:sessionId"
            element={<ResultsPage client={partialClient({ results: vi.fn(async () => robloxResult) })} />}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Roblox Practice Set")).toBeDefined();
    expect(screen.getByText(/Roblox Coding Assessment · Assessment complete/)).toBeDefined();
    expect(screen.getByRole("link", { name: "Roblox Practice" })).toBeDefined();
    expect(screen.queryByText("GCA Practice")).toBeNull();
    resultsRender.unmount();

    render(
      <MemoryRouter>
        <HistoryPage
          client={partialClient({
            history: vi.fn(async () => ({
              unfinished: [{
                sessionId: "roblox-active",
                assessmentTitle: "Roblox Active Set",
                preset: "roblox" as const,
                startedAt: result.startedAt,
                expiresAt: result.expiresAt,
                problemsSolved: 0,
                problemCount: 2,
              }],
              completed: [robloxResult],
            })),
          })}
        />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Roblox Active Set")).toBeDefined();
    expect(screen.getAllByText(/Roblox ·/)).toHaveLength(2);
    expect(screen.queryByText("GCA Practice")).toBeNull();
  });

  it("labels IMC results and history and keeps the analysis export available", async () => {
    const imcResult: AssessmentResultView = {
      ...result,
      assessmentTitle: "IMC SWE Practice Set",
      preset: "imc",
      problemsSolved: 1,
      problemCount: 2,
      problems: result.problems.slice(0, 2),
    };
    const resultsRender = render(
      <MemoryRouter initialEntries={["/results/session-1"]}>
        <Routes>
          <Route path="/results/:sessionId" element={<ResultsPage client={partialClient({ results: vi.fn(async () => imcResult) })} />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("IMC SWE Practice Set")).toBeDefined();
    expect(screen.getByText(/IMC Software Engineering Assessment · Assessment complete/)).toBeDefined();
    expect(screen.getByRole("link", { name: "IMC SWE Practice" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Export analysis JSON" })).toBeDefined();
    resultsRender.unmount();

    render(
      <MemoryRouter>
        <HistoryPage client={partialClient({ history: vi.fn(async () => ({ unfinished: [], completed: [imcResult] })) })} />
      </MemoryRouter>,
    );
    expect(await screen.findByText("IMC SWE Practice Set")).toBeDefined();
    expect(screen.getByText(/IMC ·/)).toBeDefined();
  });
});

function partialClient(methods: Partial<ImportWorkflowClient>): ImportWorkflowClient {
  return methods as ImportWorkflowClient;
}
