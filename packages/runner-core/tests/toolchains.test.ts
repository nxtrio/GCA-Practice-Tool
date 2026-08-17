import { isAbsolute } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ProcessRunner,
  RunnerRegistry,
  detectCpp,
  detectJava,
  detectPython,
} from "../src/index.ts";

describe("toolchain detection", () => {
  it("detects installed runtimes with absolute paths and versions", async () => {
    const processRunner = new ProcessRunner();
    const [java, cpp, python] = await Promise.all([
      detectJava(processRunner),
      detectCpp(processRunner),
      detectPython(processRunner),
    ]);

    expect(java.available).toBe(true);
    expect(cpp.available).toBe(true);
    expect(python.available).toBe(true);
    if (java.available) {
      expect(isAbsolute(java.javaPath)).toBe(true);
      expect(isAbsolute(java.javacPath)).toBe(true);
      expect(java.version.length).toBeGreaterThan(0);
    }
    if (cpp.available) {
      expect(["clang++", "g++"]).toContain(cpp.compiler);
      expect(isAbsolute(cpp.compilerPath)).toBe(true);
      expect(cpp.version.length).toBeGreaterThan(0);
    }
    if (python.available) {
      expect(isAbsolute(python.pythonPath)).toBe(true);
      expect(python.version).toMatch(/Python 3/);
    }
  });

  it("reports unavailable tools with installation hints", async () => {
    const emptyPathEnvironment = {
      PATH: "",
      Path: "",
      PATHEXT: process.env.PATHEXT,
    };
    const [java, cpp, python] = await Promise.all([
      detectJava(new ProcessRunner(), emptyPathEnvironment),
      detectCpp(new ProcessRunner(), emptyPathEnvironment),
      detectPython(new ProcessRunner(), emptyPathEnvironment),
    ]);

    expect(java).toMatchObject({ available: false, version: null });
    expect(cpp).toMatchObject({ available: false, version: null });
    expect(python).toMatchObject({ available: false, version: null });
    if (!java.available) expect(java.installationHint).toContain("JDK");
    if (!cpp.available) expect(cpp.installationHint).toContain("clang++");
    if (!python.available) expect(python.installationHint).toContain("Python 3");
  });

  it("creates a registry whose compiler choices remain fixed", async () => {
    const registry = await RunnerRegistry.detect();

    expect(registry.availableLanguages().sort()).toEqual([
      "cpp",
      "java",
      "python",
    ]);
    expect(registry.get("java")).toBe(registry.get("java"));
    expect(registry.get("cpp")).toBe(registry.get("cpp"));
    expect(registry.get("python")).toBe(registry.get("python"));
  });
});
