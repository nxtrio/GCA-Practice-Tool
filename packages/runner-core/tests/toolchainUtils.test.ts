import { describe, expect, it } from "vitest";
import {
  ProcessRunner,
  type ProcessExecutionRequest,
  type ProcessExecutionResult,
} from "../src/index.ts";
import {
  readToolVersion,
  TOOLCHAIN_VERSION_TIMEOUT_MS,
} from "../src/toolchains/toolchainUtils.ts";

class RecordingProcessRunner extends ProcessRunner {
  request: ProcessExecutionRequest | undefined;

  override async run(
    request: ProcessExecutionRequest,
  ): Promise<ProcessExecutionResult> {
    this.request = request;
    return {
      terminationReason: "exited",
      exitCode: 0,
      signal: null,
      stdout: "",
      stderr: "openjdk version 21.0.8\nadditional details",
      stdoutBytes: 0,
      stderrBytes: 41,
      durationMs: 4_000,
      timedOut: false,
      cancelled: false,
      outputLimitExceeded: null,
    };
  }
}

describe("toolchain version detection", () => {
  it("allows cold toolchains enough time to report their version", async () => {
    const runner = new RecordingProcessRunner();

    const version = await readToolVersion("/fake/java", ["-version"], runner);

    expect(version).toBe("openjdk version 21.0.8");
    expect(runner.request).toMatchObject({
      executable: "/fake/java",
      args: ["-version"],
      timeoutMs: TOOLCHAIN_VERSION_TIMEOUT_MS,
    });
    expect(TOOLCHAIN_VERSION_TIMEOUT_MS).toBeGreaterThanOrEqual(10_000);
  });
});
