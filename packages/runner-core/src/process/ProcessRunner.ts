import {
  spawn,
  type ChildProcess,
  type SpawnOptions,
} from "node:child_process";
import { performance } from "node:perf_hooks";
import { OutputCollector } from "./OutputCollector.js";
import { ProcessKiller } from "./ProcessKiller.js";

export type ProcessTerminationReason =
  | "exited"
  | "timeout"
  | "cancelled"
  | "stdout_limit"
  | "stderr_limit"
  | "spawn_error";

export interface ProcessExecutionRequest {
  executable: string;
  args: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs: number;
  outputLimitBytes: number;
  terminationGraceMs?: number;
  abortSignal?: AbortSignal;
}

export interface ProcessSpawnError {
  code?: string;
  message: string;
}

export interface ProcessExecutionResult {
  terminationReason: ProcessTerminationReason;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  stdoutBytes: number;
  stderrBytes: number;
  durationMs: number;
  timedOut: boolean;
  cancelled: boolean;
  outputLimitExceeded: "stdout" | "stderr" | null;
  spawnError?: ProcessSpawnError;
}

const DEFAULT_TERMINATION_GRACE_MS = 100;
const INHERITED_RUNNER_ENVIRONMENT_KEYS = [
  "PATH",
  "Path",
  "PATHEXT",
  "SystemRoot",
  "SystemDrive",
  "WINDIR",
  "ComSpec",
  "TEMP",
  "TMP",
  "TMPDIR",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "JAVA_HOME",
  "SDKROOT",
  "DEVELOPER_DIR",
  "MACOSX_DEPLOYMENT_TARGET",
  "LD_LIBRARY_PATH",
  "DYLD_LIBRARY_PATH",
  "LIBRARY_PATH",
  "CPATH",
  "CPLUS_INCLUDE_PATH",
  "INCLUDE",
  "LIB",
] as const;

export class ProcessRunner {
  async run(request: ProcessExecutionRequest): Promise<ProcessExecutionResult> {
    validateRequest(request);
    const startedAt = performance.now();

    if (request.abortSignal?.aborted) {
      return emptyResult("cancelled", performance.now() - startedAt);
    }

    const stdout = new OutputCollector(request.outputLimitBytes);
    const stderr = new OutputCollector(request.outputLimitBytes);
    const spawnOptions: SpawnOptions = {
      shell: false,
      detached: process.platform !== "win32",
      env: request.env ?? runnerEnvironment(process.env, request.cwd),
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    };
    if (request.cwd !== undefined) {
      spawnOptions.cwd = request.cwd;
    }

    let child: ChildProcess;
    try {
      child = spawn(request.executable, [...request.args], spawnOptions);
    } catch (error) {
      return {
        ...emptyResult("spawn_error", performance.now() - startedAt),
        spawnError: normalizeSpawnError(error),
      };
    }

    return await new Promise<ProcessExecutionResult>((resolve) => {
      const killer = new ProcessKiller(child);
      const graceMs =
        request.terminationGraceMs ?? DEFAULT_TERMINATION_GRACE_MS;
      let requestedTermination: Exclude<
        ProcessTerminationReason,
        "exited" | "spawn_error"
      > | null = null;
      let spawnError: ProcessSpawnError | undefined;
      let timeoutHandle: NodeJS.Timeout | undefined;
      let forceKillHandle: NodeJS.Timeout | undefined;
      let settled = false;

      const requestTermination = (
        reason: Exclude<ProcessTerminationReason, "exited" | "spawn_error">,
      ): void => {
        if (requestedTermination !== null) return;

        const alreadyExited =
          child.exitCode !== null || child.signalCode !== null;
        if (alreadyExited && reason !== "stdout_limit" && reason !== "stderr_limit") {
          return;
        }

        requestedTermination = reason;
        if (alreadyExited) return;
        killer.terminate();
        if (graceMs === 0) {
          killer.forceKill();
        } else {
          forceKillHandle = setTimeout(() => killer.forceKill(), graceMs);
        }
      };

      child.stdout?.on("data", (chunk: Buffer) => {
        if (stdout.append(chunk)) {
          requestTermination("stdout_limit");
        }
      });
      child.stderr?.on("data", (chunk: Buffer) => {
        if (stderr.append(chunk)) {
          requestTermination("stderr_limit");
        }
      });

      child.once("error", (error) => {
        spawnError = normalizeSpawnError(error);
      });

      const abortListener = (): void => requestTermination("cancelled");
      request.abortSignal?.addEventListener("abort", abortListener, {
        once: true,
      });
      if (request.abortSignal?.aborted) {
        abortListener();
      }

      timeoutHandle = setTimeout(
        () => requestTermination("timeout"),
        request.timeoutMs,
      );

      child.once("close", (exitCode, signal) => {
        if (settled) return;
        settled = true;

        if (timeoutHandle) clearTimeout(timeoutHandle);
        if (forceKillHandle) clearTimeout(forceKillHandle);
        request.abortSignal?.removeEventListener("abort", abortListener);

        const terminationReason = spawnError
          ? "spawn_error"
          : (requestedTermination ?? "exited");
        const outputLimitExceeded =
          terminationReason === "stdout_limit"
            ? "stdout"
            : terminationReason === "stderr_limit"
              ? "stderr"
              : null;

        resolve({
          terminationReason,
          exitCode: spawnError ? null : exitCode,
          signal,
          stdout: stdout.toString(),
          stderr: stderr.toString(),
          stdoutBytes: stdout.byteLength,
          stderrBytes: stderr.byteLength,
          durationMs: performance.now() - startedAt,
          timedOut: terminationReason === "timeout",
          cancelled: terminationReason === "cancelled",
          outputLimitExceeded,
          ...(spawnError ? { spawnError } : {}),
        });
      });
    });
  }
}

/**
 * Keeps toolchain/runtime settings while excluding credentials commonly held
 * in the parent process environment. This reduces accidental disclosure; it
 * does not sandbox native code from the host filesystem or network.
 */
export function runnerEnvironment(
  parent: NodeJS.ProcessEnv,
  workspacePath?: string,
): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {};
  for (const key of INHERITED_RUNNER_ENVIRONMENT_KEYS) {
    const value = parent[key];
    if (value !== undefined) environment[key] = value;
  }
  if (workspacePath) {
    environment.HOME = workspacePath;
    environment.USERPROFILE = workspacePath;
  }
  environment.PYTHONNOUSERSITE = "1";
  return environment;
}

function validateRequest(request: ProcessExecutionRequest): void {
  if (request.executable.length === 0) {
    throw new TypeError("Process executable must not be empty.");
  }
  if (!Number.isSafeInteger(request.timeoutMs) || request.timeoutMs <= 0) {
    throw new RangeError("Process timeout must be a positive safe integer.");
  }
  if (
    !Number.isSafeInteger(request.outputLimitBytes) ||
    request.outputLimitBytes <= 0
  ) {
    throw new RangeError("Output limit must be a positive safe integer.");
  }
  if (
    request.terminationGraceMs !== undefined &&
    (!Number.isSafeInteger(request.terminationGraceMs) ||
      request.terminationGraceMs < 0)
  ) {
    throw new RangeError(
      "Termination grace period must be a nonnegative safe integer.",
    );
  }
}

function emptyResult(
  terminationReason: ProcessTerminationReason,
  durationMs: number,
): ProcessExecutionResult {
  return {
    terminationReason,
    exitCode: null,
    signal: null,
    stdout: "",
    stderr: "",
    stdoutBytes: 0,
    stderrBytes: 0,
    durationMs,
    timedOut: terminationReason === "timeout",
    cancelled: terminationReason === "cancelled",
    outputLimitExceeded: null,
  };
}

function normalizeSpawnError(error: unknown): ProcessSpawnError {
  if (error instanceof Error) {
    const code = (error as NodeJS.ErrnoException).code;
    return {
      ...(code ? { code } : {}),
      message: error.message,
    };
  }
  return { message: String(error) };
}
