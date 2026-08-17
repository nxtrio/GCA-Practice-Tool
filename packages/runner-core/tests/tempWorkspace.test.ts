import {
  access,
  mkdtemp,
  rm,
  utimes,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  TempWorkspace,
  cleanupAbandonedTempWorkspaces,
  startAbandonedWorkspaceCleanup,
  withTempWorkspace,
} from "../src/index.ts";

describe("TempWorkspace", () => {
  it("creates unique workspaces and cleans them idempotently", async () => {
    const root = await mkdtemp(join(tmpdir(), "gca-workspace-root-"));

    try {
      const first = await TempWorkspace.create({ baseDirectory: root });
      const second = await TempWorkspace.create({ baseDirectory: root });

      expect(first.path).not.toBe(second.path);
      await writeFile(first.filePath("source.txt"), "candidate", "utf8");
      await expect(access(first.path)).resolves.toBeUndefined();

      expect(await first.cleanup()).toBe(true);
      expect(await first.cleanup()).toBe(true);
      await expect(access(first.path)).rejects.toMatchObject({ code: "ENOENT" });
      await second.cleanup();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects paths that escape the workspace", async () => {
    const workspace = await TempWorkspace.create();
    try {
      expect(() => workspace.filePath("../outside.txt")).toThrow(
        "must remain inside the workspace",
      );
      expect(() => workspace.filePath("")).toThrow(
        "must be a nonempty relative path",
      );
    } finally {
      await workspace.cleanup();
    }
  });

  it("cleans up in finally when an action fails", async () => {
    const root = await mkdtemp(join(tmpdir(), "gca-workspace-root-"));
    let workspacePath = "";

    try {
      await expect(
        withTempWorkspace(
          async (workspace) => {
            workspacePath = workspace.path;
            throw new Error("action failed");
          },
          { baseDirectory: root },
        ),
      ).rejects.toThrow("action failed");
      await expect(access(workspacePath)).rejects.toMatchObject({
        code: "ENOENT",
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("removes abandoned workspaces while preserving recent ones", async () => {
    const root = await mkdtemp(join(tmpdir(), "gca-workspace-root-"));
    const now = Date.now();

    try {
      const abandoned = await TempWorkspace.create({ baseDirectory: root });
      const recent = await TempWorkspace.create({ baseDirectory: root });
      const oldDate = new Date(now - 60_000);
      await utimes(abandoned.path, oldDate, oldDate);

      const cleanup = await cleanupAbandonedTempWorkspaces({
        baseDirectory: root,
        olderThanMs: 30_000,
        now,
      });

      expect(cleanup.removed).toContain(abandoned.path);
      expect(cleanup.failed).toEqual([]);
      await expect(access(abandoned.path)).rejects.toMatchObject({
        code: "ENOENT",
      });
      await expect(access(recent.path)).resolves.toBeUndefined();
      await recent.cleanup();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("can clean abandoned workspaces on a non-overlapping schedule", async () => {
    const root = await mkdtemp(join(tmpdir(), "gca-workspace-root-"));
    const abandoned = await TempWorkspace.create({ baseDirectory: root });
    const oldDate = new Date(Date.now() - 60_000);
    await utimes(abandoned.path, oldDate, oldDate);
    const schedule = startAbandonedWorkspaceCleanup({
      baseDirectory: root,
      olderThanMs: 30_000,
      intervalMs: 10,
    });

    try {
      await waitForMissing(abandoned.path, 1_000);
      await expect(access(abandoned.path)).rejects.toMatchObject({
        code: "ENOENT",
      });
    } finally {
      schedule.stop();
      await rm(root, { recursive: true, force: true });
    }
  });
});

async function waitForMissing(path: string, timeoutMs: number): Promise<void> {
  const expiresAt = Date.now() + timeoutMs;
  while (Date.now() < expiresAt) {
    try {
      await access(path);
    } catch {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
