import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import type { RunRequest, RunResult } from "@gca-practice/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.ts";

const accepted: RunResult = {
  verdict: "accepted",
  passed: 1,
  total: 1,
  tests: [
    {
      visibility: "visible",
      testId: "v1",
      verdict: "accepted",
      executionTimeMs: 3,
      expected: 2,
      actual: 2,
    },
  ],
};

describe("execution API", () => {
  let server: Server | undefined;

  afterEach(async () => {
    if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = undefined;
  });

  it.each(["run", "submit"] as const)(
    "maps POST /api/execution/%s to the requested mode",
    async (mode) => {
      const execute = vi.fn(async (_request: RunRequest) => accepted);
      const running = await listen(createApp({ executionService: { execute } }));
      server = running.server;

      const response = await fetch(`${running.origin}/api/execution/${mode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: "session-1",
          problemId: "p1",
          language: "python",
          source: "def solution(value): return value",
        }),
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(accepted);
      expect(execute).toHaveBeenCalledWith(
        expect.objectContaining({ mode, sessionId: "session-1" }),
      );
    },
  );

  it("maps custom input execution without persisting hidden testcase data", async () => {
    const execute = vi.fn(async (_request: RunRequest) => accepted);
    const running = await listen(createApp({ executionService: { execute } }));
    server = running.server;

    const response = await fetch(`${running.origin}/api/execution/custom`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: "session-1",
        problemId: "p1",
        language: "python",
        source: "def solution(value): return value",
        customTest: { arguments: [7], expected: 7 },
      }),
    });

    expect(response.status).toBe(200);
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      mode: "custom",
      customTest: { arguments: [7], expected: 7 },
    }));
  });

  it("rejects malformed custom input before invoking the judge", async () => {
    const execute = vi.fn(async (_request: RunRequest) => accepted);
    const running = await listen(createApp({ executionService: { execute } }));
    server = running.server;

    const response = await fetch(`${running.origin}/api/execution/custom`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: "session-1",
        problemId: "p1",
        language: "python",
        source: "pass",
        customTest: { arguments: null, expected: 1 },
      }),
    });

    expect(response.status).toBe(400);
    expect(execute).not.toHaveBeenCalled();
  });

  it("returns actionable toolchain diagnostics", async () => {
    const toolchains = {
      java: { available: false as const, javaPath: null, javacPath: null, version: null, installationHint: "Install a JDK." },
      cpp: { available: true as const, compiler: "clang++" as const, compilerPath: "/usr/bin/clang++", version: "clang 18" },
      python: { available: true as const, pythonPath: "/usr/bin/python3", version: "Python 3.13" },
    };
    const running = await listen(createApp({ toolchains }));
    server = running.server;

    const response = await fetch(`${running.origin}/api/environment`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(toolchains);
  });

  it("rejects malformed execution requests before invoking the judge", async () => {
    const execute = vi.fn(async (_request: RunRequest) => accepted);
    const running = await listen(createApp({ executionService: { execute } }));
    server = running.server;

    const response = await fetch(`${running.origin}/api/execution/run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: "", language: "ruby", source: 4 }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "sessionId must be a nonempty string.",
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it("rejects oversized candidate source before invoking the judge", async () => {
    const execute = vi.fn(async (_request: RunRequest) => accepted);
    const running = await listen(createApp({ executionService: { execute } }));
    server = running.server;

    const response = await fetch(`${running.origin}/api/execution/run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: "s1", problemId: "p1", language: "python", source: "x".repeat(1024 * 1024 + 1) }),
    });

    expect(response.status).toBe(400);
    expect(execute).not.toHaveBeenCalled();
  });

  it("whitelists hidden result fields at the HTTP boundary", async () => {
    const unsafeResult = {
      verdict: "wrong_answer",
      passed: 0,
      total: 1,
      tests: [
        {
          visibility: "hidden",
          verdict: "wrong_answer",
          executionTimeMs: 9,
          testId: "hidden-secret-id",
          arguments: ["hidden-secret-input"],
          expected: "hidden-secret-expected",
          actual: "hidden-secret-actual",
          stdout: "hidden-secret-stdout",
          stderr: "hidden-secret-stderr",
        },
      ],
    } as unknown as RunResult;
    const running = await listen(
      createApp({ executionService: { execute: async () => unsafeResult } }),
    );
    server = running.server;

    const response = await fetch(`${running.origin}/api/execution/submit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: "session-1",
        problemId: "p1",
        language: "python",
        source: "pass",
      }),
    });
    const body = await response.json();

    expect(body.tests[0]).toEqual({
      visibility: "hidden",
      verdict: "wrong_answer",
      executionTimeMs: 9,
    });
    expect(JSON.stringify(body)).not.toContain("hidden-secret");
  });
});

async function listen(app: ReturnType<typeof createApp>): Promise<{
  server: Server;
  origin: string;
}> {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address() as AddressInfo;
  return { server, origin: `http://127.0.0.1:${address.port}` };
}
