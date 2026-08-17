import { dirname, join } from "node:path";
import type { PrepareRequest, PreparedProgram } from "./LanguageRunner.js";
import { generateCppHarness } from "../harness/CppHarness.js";
import { ProcessRunner } from "../process/ProcessRunner.js";
import type { CppToolchain } from "../toolchains/CppToolchain.js";
import {
  BaseLanguageRunner,
  DEFAULT_MAX_SOURCE_BYTES,
} from "./BaseLanguageRunner.js";

type AvailableCppToolchain = Extract<CppToolchain, { available: true }>;

export class CppRunner extends BaseLanguageRunner {
  constructor(
    private readonly toolchain: AvailableCppToolchain,
    processRunner = new ProcessRunner(),
    maxSourceBytes = DEFAULT_MAX_SOURCE_BYTES,
  ) {
    super("cpp", processRunner, maxSourceBytes);
  }

  async prepare(request: PrepareRequest): Promise<PreparedProgram> {
    const snapshot = structuredClone(request);
    const executableName = process.platform === "win32" ? "solution.exe" : "solution";
    const harnessSource = generateCppHarness({
      signature: snapshot.signature,
      candidateSource: snapshot.source,
      tests: snapshot.tests,
    });

    return await this.prepareNativeProgram(snapshot, {
      sourceFileName: "solution.cpp",
      harnessSource,
      compileCommand: {
        executable: this.toolchain.compilerPath,
        args: [
          "-std=c++20",
          "-O2",
          "solution.cpp",
          "-o",
          executableName,
        ],
      },
      runCommand: (testIndex, resultPath) => ({
        executable: join(dirname(resultPath), executableName),
        args: [String(testIndex), resultPath],
      }),
    });
  }
}
