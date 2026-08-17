// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Session } from "@gca-practice/contracts";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  AssessmentValidationView,
  ImportWorkflowClient,
} from "../src/api/importClient.ts";
import { demoAssessment } from "../src/assessment/demoAssessment.ts";
import { ImportAssessmentPage } from "../src/pages/ImportAssessmentPage.tsx";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ImportAssessmentPage", () => {
  it("requires trust confirmation, then automatically validates and starts", async () => {
    const client = fakeClient({
      valid: true,
      validationId: "validation-1",
      assessment: {
        title: demoAssessment.title,
        durationSeconds: demoAssessment.durationSeconds,
        problems: demoAssessment.problems,
      },
      errors: [],
      warnings: ["Problem 4 contains only 7 hidden tests."],
    });
    render(
      <MemoryRouter initialEntries={["/import"]}>
        <Routes>
          <Route path="/import" element={<ImportAssessmentPage client={client} />} />
          <Route path="/assessment/:id" element={<div>Assessment started</div>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Assessment JSON"), {
      target: { value: "{\"schemaVersion\":\"1.0\"}" },
    });

    expect(await screen.findByText("Trust confirmation required")).toBeDefined();
    expect(client.validateAssessment).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("checkbox", { name: /I trust this assessment source/ }));
    expect(await screen.findByText("Assessment is ready", {}, { timeout: 2000 })).toBeDefined();
    expect(screen.getByText("Reference solutions verified")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /Start Assessment/ }));

    expect(await screen.findByText("Assessment started")).toBeDefined();
    expect(client.importAssessment).toHaveBeenCalledWith("validation-1");
    expect(client.startSession).toHaveBeenCalledWith("assessment-1");
  });

  it("shows validation errors and copies a repair prompt", async () => {
    const writeText = vi.fn(async (_value: string) => undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    const client = fakeClient({
      valid: false,
      errors: [{ stage: "schema", code: "schema_validation", path: "/assessment/problems", message: "must contain 4 items" }],
      warnings: [],
    });
    render(<MemoryRouter><ImportAssessmentPage client={client} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("checkbox", { name: /I trust this assessment source/ }));
    fireEvent.change(screen.getByLabelText("Assessment JSON"), { target: { value: "{}" } });

    expect(await screen.findByText("1 validation error", {}, { timeout: 2000 })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Copy Repair Prompt" }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText.mock.calls[0]?.[0]).toContain("ENTIRE corrected JSON document");
    expect(writeText.mock.calls[0]?.[0]).toContain("/assessment/problems");
  });

  it("loads an uploaded JSON file and validates it after trust confirmation", async () => {
    const client = fakeClient({ valid: false, errors: [], warnings: [] });
    render(<MemoryRouter><ImportAssessmentPage client={client} /></MemoryRouter>);
    const source = '{"schemaVersion":"1.0"}';
    const file = new File([source], "practice-assessment.json", {
      type: "application/json",
    });

    fireEvent.change(screen.getByLabelText("Upload JSON file"), {
      target: { files: [file] },
    });

    expect(await screen.findByText("Loaded practice-assessment.json")).toBeDefined();
    expect((screen.getByLabelText("Assessment JSON") as HTMLTextAreaElement).value).toBe(source);
    expect(client.validateAssessment).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("checkbox", { name: /I trust this assessment source/ }));
    await waitFor(() => expect(client.validateAssessment).toHaveBeenCalledWith(source), {
      timeout: 2_000,
    });
  });

  it("rejects oversized and non-JSON uploads before validation", async () => {
    const client = fakeClient({ valid: false, errors: [], warnings: [] });
    render(<MemoryRouter><ImportAssessmentPage client={client} /></MemoryRouter>);
    const upload = screen.getByLabelText("Upload JSON file");

    fireEvent.change(upload, {
      target: { files: [new File(["plain text"], "assessment.txt", { type: "text/plain" })] },
    });
    expect(await screen.findByText("Choose a JSON file with a .json extension.")).toBeDefined();

    fireEvent.change(upload, {
      target: {
        files: [new File([new Uint8Array(1_500_001)], "assessment.json", { type: "application/json" })],
      },
    });
    expect(await screen.findByText("JSON files must be 1.5 MB or smaller.")).toBeDefined();
    expect(client.validateAssessment).not.toHaveBeenCalled();
  });

  it("warns that imported reference code executes locally", () => {
    render(<MemoryRouter><ImportAssessmentPage client={fakeClient({ valid: false, errors: [], warnings: [] })} /></MemoryRouter>);

    expect(screen.getByText("Imported code runs on this computer")).toBeDefined();
    expect(screen.getByText(/not sandboxed/)).toBeDefined();
  });
});

function fakeClient(validation: AssessmentValidationView): ImportWorkflowClient {
  const session: Session = {
    id: "session-1",
    assessmentId: "assessment-1",
    status: "active",
    startedAt: "2026-08-16T12:00:00.000Z",
    expiresAt: "2026-08-16T13:10:00.000Z",
    finishedAt: null,
    createdAt: "2026-08-16T12:00:00.000Z",
  };
  return {
    environment: vi.fn(async () => ({
      java: { available: true, version: "21" },
      cpp: { available: true, version: "clang 18", compiler: "clang++" },
      python: { available: true, version: "3.13" },
    })),
    problemHistory: vi.fn(async () => []),
    validateAssessment: vi.fn(async () => validation),
    importAssessment: vi.fn(async () => ({ ...demoAssessment, id: "assessment-1" })),
    startSession: vi.fn(async () => session),
    finishSession: vi.fn(async () => { throw new Error("not used"); }),
    results: vi.fn(async () => { throw new Error("not used"); }),
    history: vi.fn(async () => ({ unfinished: [], completed: [] })),
    resumeSession: vi.fn(async () => ({ session, assessment: demoAssessment, code: [], remainingMs: 4200000 })),
    saveCode: vi.fn(async () => undefined),
  };
}
