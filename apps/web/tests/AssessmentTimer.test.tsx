// @vitest-environment jsdom

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AssessmentTimer,
  formatRemainingTime,
  remainingTimeMs,
} from "../src/assessment/AssessmentTimer.tsx";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("AssessmentTimer", () => {
  it("derives remaining time directly from expiresAt", () => {
    const now = Date.parse("2026-08-16T12:30:00.000Z");
    const expiresAt = "2026-08-16T13:10:00.000Z";

    expect(remainingTimeMs(expiresAt, now)).toBe(40 * 60 * 1_000);
    expect(formatRemainingTime(40 * 60 * 1_000)).toBe("40:00");
    expect(formatRemainingTime(70 * 60 * 1_000)).toBe("1:10:00");
  });

  it("announces expiration once rather than decrementing stored session time", () => {
    vi.useFakeTimers();
    let now = Date.parse("2026-08-16T12:00:00.000Z");
    const onExpire = vi.fn();
    render(
      <AssessmentTimer
        expiresAt="2026-08-16T12:00:02.000Z"
        now={() => now}
        onExpire={onExpire}
      />,
    );

    expect(screen.getByText("00:02")).toBeDefined();
    now += 2_000;
    act(() => vi.advanceTimersByTime(2_000));
    expect(screen.getByText("Time expired")).toBeDefined();
    expect(onExpire).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(5_000));
    expect(onExpire).toHaveBeenCalledTimes(1);
  });
});
