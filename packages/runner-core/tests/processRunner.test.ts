import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  OutputCollector,
  ProcessRunner,
  TempWorkspace,
  type ProcessExecutionRequest,
} from "../src/index.ts";

const runner = new ProcessRunner();

function request(
  source: string,
  overrides: Partial<ProcessExecutionRequest> = {},
): ProcessExecutionRequest {
  return {
    executable: process.execPath,
    args: ["-e", source],
    timeoutMs: 2_000,
    outputLimitBytes: 64 * 1024,
    terminationGraceMs: 50,
    ...overrides,
  };
}

describe("OutputCollector", () => {
  it("captures bytes up to its limit and reports the first overflow", () => {
    const collector = new OutputCollector(5);

    expect(collector.append("abc")).toBe(false);
    expect(collector.append(Buffer.from("def"))).toBe(true);
    expect(collector.append("more")).toBe(false);
    expect(collector.toString()).toBe("abcde");
    expect(collector.byteLength).toBe(5);
    expect(collector.totalObservedBytes).toBe(10);
    expect(collector.limitExceeded).toBe(true);
  });
});

describe("ProcessRunner", () => {
  it("captures stdout, stderr, duration, and a normal exit code", async () => {
    const result = await runner.run(
      request(
        'process.stdout.write("hello 😀"); process.stderr.write("debug");',
      ),
    );

    expect(result).toMatchObject({
      terminationReason: "exited",
      exitCode: 0,
      signal: null,
      stdout: "hello 😀",
      stderr: "debug",
      timedOut: false,
      cancelled: false,
      outputLimitExceeded: null,
    });
    expect(result.stdoutBytes).toBe(Buffer.byteLength("hello 😀"));
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("returns a nonzero exit code without treating it as an internal error", async () => {
    const result = await runner.run(
      request('process.stderr.write("failed"); process.exit(7);'),
    );

    expect(result.terminationReason).toBe("exited");
    expect(result.exitCode).toBe(7);
    expect(result.stderr).toBe("failed");
  });

  it("does not inherit arbitrary parent credentials by default", async () => {
    const key = "GCA_PRACTICE_TEST_SECRET";
    const previous = process.env[key];
    process.env[key] = "must-not-reach-runner";
    try {
      const result = await runner.run(
        request(`process.stdout.write(process.env.${key} ?? "missing")`),
      );
      expect(result.stdout).toBe("missing");
    } finally {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    }
  });

  it("uses an explicit environment when one is intentionally supplied", async () => {
    const result = await runner.run(
      request('process.stdout.write(process.env.ALLOWED_VALUE ?? "missing")', {
        env: { ALLOWED_VALUE: "available" },
      }),
    );

    expect(result.stdout).toBe("available");
  });

  it("terminates an infinite loop at the timeout", async () => {
    const result = await runner.run(
      request("while (true) {}", { timeoutMs: 100 }),
    );

    expect(result.terminationReason).toBe("timeout");
    expect(result.timedOut).toBe(true);
    expect(result.exitCode).toBeNull();
    expect(result.durationMs).toBeLessThan(3_000);
  });

  it.runIf(process.platform !== "win32")(
    "escalates from SIGTERM to SIGKILL after the grace period",
    async () => {
      const result = await runner.run(
        request(
          'process.on("SIGTERM", () => {}); setInterval(() => {}, 1000);',
          // Leave enough startup time for the child to install its signal
          // handler even when the full test suite is running concurrently.
          { timeoutMs: 500, terminationGraceMs: 50 },
        ),
      );

      expect(result.terminationReason).toBe("timeout");
      expect(result.signal).toBe("SIGKILL");
      expect(result.durationMs).toBeLessThan(3_000);
    },
  );

  it("terminates runaway stdout and caps captured output", async () => {
    const result = await runner.run(
      request(
        'process.stdout.write("x".repeat(1024 * 1024)); setInterval(() => {}, 1000);',
        { outputLimitBytes: 4_096 },
      ),
    );

    expect(result.terminationReason).toBe("stdout_limit");
    expect(result.outputLimitExceeded).toBe("stdout");
    expect(result.stdoutBytes).toBe(4_096);
    expect(Buffer.byteLength(result.stdout)).toBeLessThanOrEqual(4_096);
    expect(result.durationMs).toBeLessThan(3_000);
  });

  it("retains the output-limit verdict when a flooding process exits quickly", async () => {
    const result = await runner.run(
      request('process.stdout.write("x".repeat(1024 * 1024));', {
        outputLimitBytes: 4_096,
      }),
    );

    expect(result.terminationReason).toBe("stdout_limit");
    expect(result.outputLimitExceeded).toBe("stdout");
    expect(result.stdoutBytes).toBe(4_096);
  });

  it("terminates runaway stderr and caps captured output", async () => {
    const result = await runner.run(
      request(
        'process.stderr.write("x".repeat(1024 * 1024)); setInterval(() => {}, 1000);',
        { outputLimitBytes: 4_096 },
      ),
    );

    expect(result.terminationReason).toBe("stderr_limit");
    expect(result.outputLimitExceeded).toBe("stderr");
    expect(result.stderrBytes).toBe(4_096);
    expect(Buffer.byteLength(result.stderr)).toBeLessThanOrEqual(4_096);
    expect(result.durationMs).toBeLessThan(3_000);
  });

  it("reports a missing executable as a spawn error", async () => {
    const result = await runner.run({
      executable: `gca-practice-missing-${process.pid}`,
      args: [],
      timeoutMs: 1_000,
      outputLimitBytes: 1_024,
    });

    expect(result.terminationReason).toBe("spawn_error");
    expect(result.exitCode).toBeNull();
    expect(result.spawnError?.code).toBe("ENOENT");
    expect(result.spawnError?.message).toContain("gca-practice-missing");
  });

  it("supports cancellation of an active process", async () => {
    const controller = new AbortController();
    const execution = runner.run(
      request("setInterval(() => {}, 1000);", {
        abortSignal: controller.signal,
        timeoutMs: 5_000,
      }),
    );
    setTimeout(() => controller.abort(), 50);

    const result = await execution;

    expect(result.terminationReason).toBe("cancelled");
    expect(result.cancelled).toBe(true);
    expect(result.timedOut).toBe(false);
    expect(result.durationMs).toBeLessThan(3_000);
  });

  it.runIf(process.platform !== "win32")(
    "terminates descendant processes with the process group",
    async () => {
      const workspace = await TempWorkspace.create();
      const childPidPath = workspace.filePath("child.pid");
      let descendantPid: number | undefined;

      try {
        const source = [
          'const { spawn } = require("node:child_process");',
          'const { writeFileSync } = require("node:fs");',
          'const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" });',
          "writeFileSync(process.argv[1], String(child.pid));",
          "setInterval(() => {}, 1000);",
        ].join("\n");
        const result = await runner.run(
          request(source, {
            args: ["-e", source, childPidPath],
            timeoutMs: 300,
          }),
        );

        expect(result.terminationReason).toBe("timeout");
        descendantPid = Number.parseInt(
          await readFile(childPidPath, "utf8"),
          10,
        );
        await waitFor(() => !isProcessAlive(descendantPid!), 1_000);
        expect(isProcessAlive(descendantPid)).toBe(false);
      } finally {
        if (descendantPid !== undefined && isProcessAlive(descendantPid)) {
          try {
            process.kill(descendantPid, "SIGKILL");
          } catch {
            // The descendant exited between the liveness check and cleanup.
          }
        }
        await workspace.cleanup();
      }
    },
    5_000,
  );

  it("does not spawn when cancellation was already requested", async () => {
    const controller = new AbortController();
    controller.abort();

    const result = await runner.run(
      request('process.stdout.write("should not run")', {
        abortSignal: controller.signal,
      }),
    );

    expect(result.terminationReason).toBe("cancelled");
    expect(result.stdout).toBe("");
    expect(result.signal).toBeNull();
  });

  it("rejects invalid safety limits before spawning", async () => {
    await expect(
      runner.run(request("", { timeoutMs: 0 })),
    ).rejects.toThrow("Process timeout must be a positive safe integer");
    await expect(
      runner.run(request("", { outputLimitBytes: 0 })),
    ).rejects.toThrow("Output limit must be a positive safe integer");
  });
});

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitFor(predicate: () => boolean, timeoutMs: number): Promise<void> {
  const expiresAt = Date.now() + timeoutMs;
  while (!predicate() && Date.now() < expiresAt) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
