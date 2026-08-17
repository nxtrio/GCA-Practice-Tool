import { afterEach, describe, expect, it, vi } from "vitest";
import type { RunResult } from "@gca-practice/contracts";
import { ApiJudgeClient, JudgeRequestError } from "../src/api/client.ts";

const accepted: RunResult = {
  verdict: "accepted",
  passed: 1,
  total: 1,
  tests: [
    {
      visibility: "visible",
      testId: "v1",
      verdict: "accepted",
      executionTimeMs: 2,
      expected: 4,
      actual: 4,
    },
  ],
};

afterEach(() => vi.unstubAllGlobals());

describe("ApiJudgeClient", () => {
  it("posts source to the mode-specific execution endpoint", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(accepted), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await new ApiJudgeClient("http://localhost:3001").execute({
      sessionId: "s1",
      problemId: "p1",
      language: "cpp",
      source: "int solution(int value) { return value; }",
      mode: "submit",
    });

    expect(result).toEqual(accepted);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/execution/submit",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          sessionId: "s1",
          problemId: "p1",
          language: "cpp",
          source: "int solution(int value) { return value; }",
        }),
      }),
    );
  });

  it("surfaces JSON API errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: "Session expired." }), {
          status: 409,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    await expect(
      new ApiJudgeClient().execute({
        sessionId: "s1",
        problemId: "p1",
        language: "python",
        source: "pass",
        mode: "run",
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<JudgeRequestError>>({
        name: "JudgeRequestError",
        message: "Session expired.",
        status: 409,
      }),
    );
  });
});
