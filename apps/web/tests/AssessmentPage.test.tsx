// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { demoAssessment } from "../src/assessment/demoAssessment.ts";
import { MemoryCodePersistence } from "../src/editor/codePersistence.ts";
import { AssessmentPage } from "../src/pages/AssessmentPage.tsx";
import type { CompletionCodeSnapshot } from "../src/api/importClient.ts";

vi.mock("@monaco-editor/react", () => ({
  default: ({
    value,
    onChange,
    options,
  }: {
    value: string;
    onChange: (value: string) => void;
    options: { ariaLabel: string; readOnly: boolean };
  }) => (
    <textarea
      aria-label={options.ariaLabel}
      value={value}
      readOnly={options.readOnly}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const expiresAt = "2099-08-16T13:10:00.000Z";

describe("AssessmentPage", () => {
  it("navigates all problems and languages without losing isolated drafts", () => {
    const persistence = new MemoryCodePersistence();
    render(
      <AssessmentPage
        sessionId="session-1"
        assessment={demoAssessment}
        expiresAt={expiresAt}
        persistence={persistence}
      />,
    );

    for (let slot = 1; slot <= 4; slot += 1) {
      expect(
        screen.getByRole("button", { name: new RegExp(`Question ${slot}:`) }),
      ).toBeDefined();
    }
    const languageSelect = screen.getByLabelText(
      "Programming language",
    ) as HTMLSelectElement;
    expect(Array.from(languageSelect.options).map(({ text }) => text)).toEqual([
      "Java",
      "C++",
      "Python",
    ]);

    fireEvent.change(screen.getByLabelText("java code editor"), {
      target: { value: "JAVA Q1 DRAFT" },
    });
    fireEvent.change(languageSelect, { target: { value: "python" } });
    fireEvent.change(screen.getByLabelText("python code editor"), {
      target: { value: "PYTHON Q1 DRAFT" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Question 4:/ }));
    fireEvent.change(screen.getByLabelText("python code editor"), {
      target: { value: "PYTHON Q4 DRAFT" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Question 1:/ }));
    expect(
      (screen.getByLabelText("python code editor") as HTMLTextAreaElement)
        .value,
    ).toBe("PYTHON Q1 DRAFT");

    fireEvent.change(languageSelect, { target: { value: "java" } });
    expect(
      (screen.getByLabelText("java code editor") as HTMLTextAreaElement).value,
    ).toBe("JAVA Q1 DRAFT");
    expect(
      screen.getByRole("button", { name: /Question 1:.*written/ }),
    ).toBeDefined();
  });

  it("restores persisted source after the page is remounted", () => {
    const persistence = new MemoryCodePersistence();
    const firstRender = render(
      <AssessmentPage
        sessionId="session-reload"
        assessment={demoAssessment}
        expiresAt={expiresAt}
        persistence={persistence}
      />,
    );
    fireEvent.change(screen.getByLabelText("java code editor"), {
      target: { value: "SOURCE SURVIVES RELOAD" },
    });
    firstRender.unmount();

    render(
      <AssessmentPage
        sessionId="session-reload"
        assessment={demoAssessment}
        expiresAt={expiresAt}
        persistence={persistence}
      />,
    );

    expect(
      (screen.getByLabelText("java code editor") as HTMLTextAreaElement).value,
    ).toBe("SOURCE SURVIVES RELOAD");
  });

  it("autosaves the active draft after a short debounce", () => {
    vi.useFakeTimers();
    const persistence = new MemoryCodePersistence();
    render(
      <AssessmentPage
        sessionId="session-autosave"
        assessment={demoAssessment}
        expiresAt={expiresAt}
        persistence={persistence}
      />,
    );
    const location = {
      sessionId: "session-autosave",
      problemId: "p1",
      language: "java" as const,
    };

    fireEvent.change(screen.getByLabelText("java code editor"), {
      target: { value: "AUTOSAVED SOURCE" },
    });
    act(() => vi.advanceTimersByTime(449));
    expect(persistence.load(location)).toBeUndefined();
    act(() => vi.advanceTimersByTime(1));
    expect(persistence.load(location)).toBe("AUTOSAVED SOURCE");
  });

  it("does not issue a late draft save while completion is navigating away", async () => {
    let resolveFinish!: () => void;
    const finishPending = new Promise<void>((resolve) => {
      resolveFinish = resolve;
    });
    const persistence = new MemoryCodePersistence();
    const save = vi.spyOn(persistence, "save");
    const view = render(
      <AssessmentPage
        sessionId="session-finishing"
        assessment={demoAssessment}
        expiresAt={expiresAt}
        persistence={persistence}
        onFinish={() => finishPending}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Finish session" }));
    view.unmount();

    expect(save).not.toHaveBeenCalled();
    resolveFinish();
  });

  it("shows only visible test payloads and leaves judging disabled for Phase 8", () => {
    render(
      <AssessmentPage
        sessionId="session-2"
        assessment={demoAssessment}
        expiresAt={expiresAt}
        persistence={new MemoryCodePersistence()}
      />,
    );

    expect(screen.getByText("Test results")).toBeDefined();
    expect(
      screen.getByText(
        "Hidden test details stay private and are evaluated only on Submit.",
      ),
    ).toBeDefined();
    expect(
      (screen.getByRole("button", {
        name: "Run visible tests",
      }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Submit" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("freezes and sends final snapshots automatically at expiration", async () => {
    vi.useFakeTimers();
    const now = new Date("2026-08-16T12:00:00.000Z");
    vi.setSystemTime(now);
    const onFinish = vi.fn(async (_code: CompletionCodeSnapshot[]) => undefined);
    render(
      <AssessmentPage
        sessionId="session-expiry"
        assessment={demoAssessment}
        expiresAt="2026-08-16T12:00:02.000Z"
        persistence={new MemoryCodePersistence()}
        onFinish={onFinish}
      />,
    );
    fireEvent.change(screen.getByLabelText("java code editor"), {
      target: { value: "FINAL SNAPSHOT" },
    });

    await act(async () => vi.advanceTimersByTime(2_000));

    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish.mock.calls[0]?.[0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          problemId: "p1",
          language: "java",
          source: "FINAL SNAPSHOT",
        }),
      ]),
    );
    expect((screen.getByLabelText("java code editor") as HTMLTextAreaElement).readOnly).toBe(true);
  });
});
