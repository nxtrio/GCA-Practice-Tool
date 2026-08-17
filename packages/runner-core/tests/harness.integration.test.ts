import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  FunctionSignature,
  SupportedValue,
  TypeSpec,
} from "@gca-practice/contracts";
import { describe, expect, it } from "vitest";
import {
  cppSignature,
  generateCppHarness,
  generateJavaHarness,
  generatePythonHarness,
  javaSignature,
  pythonSignature,
  type HarnessRequest,
} from "../src/index.ts";

interface RoundTripGroup {
  name: string;
  type: TypeSpec;
  values: SupportedValue[];
}

const escapedString =
  'quote " slash \\ newline\n tab\t return\r backspace\b formfeed\f nul\0 café 😀';

const roundTripGroups: RoundTripGroup[] = [
  {
    name: "int",
    type: { kind: "int" },
    values: [-2_147_483_648, 0, 2_147_483_647],
  },
  {
    name: "long",
    type: { kind: "long" },
    values: [-5_000_000_000, 5_000_000_000],
  },
  {
    name: "boolean",
    type: { kind: "boolean" },
    values: [true, false],
  },
  {
    name: "string",
    type: { kind: "string" },
    values: ["", escapedString],
  },
  {
    name: "int arrays",
    type: { kind: "array", items: { kind: "int" } },
    values: [[], [1, -2, 3]],
  },
  {
    name: "long arrays",
    type: { kind: "array", items: { kind: "long" } },
    values: [[5_000_000_000, -5_000_000_000]],
  },
  {
    name: "boolean arrays",
    type: { kind: "array", items: { kind: "boolean" } },
    values: [[], [true, false, true]],
  },
  {
    name: "string arrays",
    type: { kind: "array", items: { kind: "string" } },
    values: [["", escapedString]],
  },
  {
    name: "nested arrays",
    type: {
      kind: "array",
      items: { kind: "array", items: { kind: "int" } },
    },
    values: [[[], [1, -2], []]],
  },
];

const javaAvailable = commandAvailable("javac") && commandAvailable("java");
const cppCompiler = commandAvailable("clang++")
  ? "clang++"
  : commandAvailable("g++")
    ? "g++"
    : null;
const pythonAvailable = commandAvailable("python3");

describe.runIf(javaAvailable)("generated Java harness", () => {
  it(
    "compiles once and round-trips every supported value shape per test process",
    () => {
      for (const group of roundTripGroups) {
        const signature = identitySignature(group.type);
        const request = harnessRequest(
          signature,
          `${javaSignature(signature)} { System.out.print("debug"); return value; }`,
          group.values,
        );
        runCompiledHarness(
          group,
          "Main.java",
          generateJavaHarness(request),
          (workspace) =>
            spawn("javac", ["Main.java"], workspace, `javac (${group.name})`),
          (workspace, testIndex, resultPath) =>
            spawn(
              "java",
              ["-cp", workspace, "Main", String(testIndex), resultPath],
              workspace,
              `java (${group.name})`,
            ),
        );
      }
    },
    60_000,
  );
});

describe.runIf(cppCompiler !== null)("generated C++ harness", () => {
  it(
    "compiles once and round-trips every supported value shape per test process",
    () => {
      if (!cppCompiler) return;

      for (const group of roundTripGroups) {
        const signature = identitySignature(group.type);
        const request = harnessRequest(
          signature,
          `${cppSignature(signature)} { cout << "debug"; return value; }`,
          group.values,
        );
        runCompiledHarness(
          group,
          "solution.cpp",
          generateCppHarness(request),
          (workspace) =>
            spawn(
              cppCompiler,
              ["-std=c++20", "-O0", "solution.cpp", "-o", "solution"],
              workspace,
              `${cppCompiler} (${group.name})`,
            ),
          (workspace, testIndex, resultPath) =>
            spawn(
              join(workspace, "solution"),
              [String(testIndex), resultPath],
              workspace,
              `C++ executable (${group.name})`,
            ),
        );
      }
    },
    60_000,
  );
});

describe.runIf(pythonAvailable)("generated Python harness", () => {
  it(
    "parses and round-trips every supported value shape per test process",
    () => {
      for (const group of roundTripGroups) {
        const signature = identitySignature(group.type);
        const request = harnessRequest(
          signature,
          `${pythonSignature(signature)}\n    print("debug", end="")\n    return value`,
          group.values,
        );
        runCompiledHarness(
          group,
          "solution.py",
          generatePythonHarness(request),
          (workspace) =>
            spawn(
              "python3",
              ["-m", "py_compile", "solution.py"],
              workspace,
              `python parse (${group.name})`,
            ),
          (workspace, testIndex, resultPath) =>
            spawn(
              "python3",
              ["solution.py", String(testIndex), resultPath],
              workspace,
              `python (${group.name})`,
            ),
        );
      }
    },
    60_000,
  );
});

function identitySignature(type: TypeSpec): FunctionSignature {
  return {
    name: "solution",
    parameters: [{ name: "value", type }],
    returnType: type,
  };
}

function harnessRequest(
  signature: FunctionSignature,
  candidateSource: string,
  values: SupportedValue[],
): HarnessRequest {
  return {
    signature,
    candidateSource,
    tests: values.map((value) => ({ arguments: [value] })),
  };
}

function runCompiledHarness(
  group: RoundTripGroup,
  sourceName: string,
  source: string,
  compile: (workspace: string) => SpawnSyncReturns<string>,
  run: (
    workspace: string,
    testIndex: number,
    resultPath: string,
  ) => SpawnSyncReturns<string>,
): void {
  const workspace = mkdtempSync(join(tmpdir(), "gca-harness-test-"));

  try {
    writeFileSync(join(workspace, sourceName), source, "utf8");
    assertSuccess(compile(workspace));

    group.values.forEach((expected, testIndex) => {
      const resultPath = join(workspace, `result-${testIndex}.json`);
      const execution = run(workspace, testIndex, resultPath);
      assertSuccess(execution);
      expect(execution.stdout).toBe("debug");
      expect(JSON.parse(readFileSync(resultPath, "utf8"))).toEqual(expected);
    });
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
}

function spawn(
  command: string,
  args: string[],
  cwd: string,
  label: string,
): SpawnSyncReturns<string> {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    shell: false,
    timeout: 20_000,
  });
  Object.defineProperty(result, "__label", { value: label });
  return result;
}

function assertSuccess(result: SpawnSyncReturns<string>): void {
  const label = (result as SpawnSyncReturns<string> & { __label?: string })
    .__label;
  expect(
    result.status,
    `${label ?? "process"} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  ).toBe(0);
}

function commandAvailable(command: string): boolean {
  const result = spawnSync(command, ["--version"], {
    encoding: "utf8",
    shell: false,
    timeout: 5_000,
  });
  return result.status === 0;
}

