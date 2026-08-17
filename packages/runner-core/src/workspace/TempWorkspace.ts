import {
  mkdir,
  mkdtemp,
  readdir,
  rm,
  stat,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";

const WORKSPACE_PREFIX = "run-";
export const defaultTempWorkspaceRoot = join(tmpdir(), "gca-practice");

export interface TempWorkspaceOptions {
  baseDirectory?: string;
}

export class TempWorkspace {
  private cleaned = false;

  private constructor(readonly path: string) {}

  static async create(options: TempWorkspaceOptions = {}): Promise<TempWorkspace> {
    const baseDirectory = resolve(
      options.baseDirectory ?? defaultTempWorkspaceRoot,
    );
    await mkdir(baseDirectory, { recursive: true });
    const path = await mkdtemp(join(baseDirectory, WORKSPACE_PREFIX));
    return new TempWorkspace(path);
  }

  filePath(relativePath: string): string {
    if (relativePath.length === 0 || isAbsolute(relativePath)) {
      throw new TypeError("Workspace file path must be a nonempty relative path.");
    }

    const candidate = resolve(this.path, relativePath);
    const relativeCandidate = relative(this.path, candidate);
    if (
      relativeCandidate === "" ||
      relativeCandidate === ".." ||
      relativeCandidate.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) ||
      isAbsolute(relativeCandidate)
    ) {
      throw new RangeError("Workspace file path must remain inside the workspace.");
    }
    return candidate;
  }

  /** Cleanup is idempotent and intentionally does not throw. */
  async cleanup(): Promise<boolean> {
    if (this.cleaned) return true;

    try {
      await rm(this.path, { recursive: true, force: true });
      this.cleaned = true;
      return true;
    } catch {
      return false;
    }
  }
}

export async function withTempWorkspace<T>(
  action: (workspace: TempWorkspace) => Promise<T>,
  options: TempWorkspaceOptions = {},
): Promise<T> {
  const workspace = await TempWorkspace.create(options);
  try {
    return await action(workspace);
  } finally {
    await workspace.cleanup();
  }
}

export interface AbandonedWorkspaceCleanupOptions extends TempWorkspaceOptions {
  olderThanMs: number;
  now?: number;
}

export interface AbandonedWorkspaceCleanupResult {
  removed: string[];
  failed: string[];
}

export interface AbandonedWorkspaceCleanupScheduleOptions
  extends AbandonedWorkspaceCleanupOptions {
  intervalMs: number;
  onError?: (error: unknown) => void;
}

export interface AbandonedWorkspaceCleanupSchedule {
  runNow(): Promise<AbandonedWorkspaceCleanupResult>;
  stop(): void;
}

export async function cleanupAbandonedTempWorkspaces(
  options: AbandonedWorkspaceCleanupOptions,
): Promise<AbandonedWorkspaceCleanupResult> {
  if (!Number.isSafeInteger(options.olderThanMs) || options.olderThanMs < 0) {
    throw new RangeError("Abandoned workspace age must be nonnegative.");
  }

  const baseDirectory = resolve(
    options.baseDirectory ?? defaultTempWorkspaceRoot,
  );
  const cutoff = (options.now ?? Date.now()) - options.olderThanMs;
  const result: AbandonedWorkspaceCleanupResult = { removed: [], failed: [] };

  let entries;
  try {
    entries = await readdir(baseDirectory, { withFileTypes: true });
  } catch (error) {
    if (isMissingPath(error)) return result;
    throw error;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith(WORKSPACE_PREFIX)) {
      continue;
    }

    const workspacePath = join(baseDirectory, entry.name);
    try {
      const workspaceStat = await stat(workspacePath);
      if (workspaceStat.mtimeMs > cutoff) continue;
      await rm(workspacePath, { recursive: true, force: true });
      result.removed.push(workspacePath);
    } catch {
      result.failed.push(workspacePath);
    }
  }

  return result;
}

export function startAbandonedWorkspaceCleanup(
  options: AbandonedWorkspaceCleanupScheduleOptions,
): AbandonedWorkspaceCleanupSchedule {
  if (!Number.isSafeInteger(options.intervalMs) || options.intervalMs <= 0) {
    throw new RangeError("Cleanup interval must be a positive safe integer.");
  }

  let stopped = false;
  let activeRun: Promise<AbandonedWorkspaceCleanupResult> | undefined;
  const runNow = (): Promise<AbandonedWorkspaceCleanupResult> => {
    if (activeRun) return activeRun;
    activeRun = cleanupAbandonedTempWorkspaces(options).finally(() => {
      activeRun = undefined;
    });
    return activeRun;
  };
  const timer = setInterval(() => {
    if (stopped) return;
    void runNow().catch((error: unknown) => options.onError?.(error));
  }, options.intervalMs);
  timer.unref();

  return {
    runNow,
    stop(): void {
      if (stopped) return;
      stopped = true;
      clearInterval(timer);
    },
  };
}

function isMissingPath(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}
