import type { PrepareRequest, PreparedProgram } from "./LanguageRunner.js";
import { generatePythonHarness } from "../harness/PythonHarness.js";
import { ProcessRunner } from "../process/ProcessRunner.js";
import type { PythonToolchain } from "../toolchains/PythonToolchain.js";
import {
  BaseLanguageRunner,
  DEFAULT_MAX_SOURCE_BYTES,
} from "./BaseLanguageRunner.js";

type AvailablePythonToolchain = Extract<
  PythonToolchain,
  { available: true }
>;

export class PythonRunner extends BaseLanguageRunner {
  constructor(
    private readonly toolchain: AvailablePythonToolchain,
    processRunner = new ProcessRunner(),
    maxSourceBytes = DEFAULT_MAX_SOURCE_BYTES,
  ) {
    super("python", processRunner, maxSourceBytes);
  }

  async prepare(request: PrepareRequest): Promise<PreparedProgram> {
    const snapshot = structuredClone(request);
    const harnessSource = generatePythonHarness({
      signature: snapshot.signature,
      candidateSource: snapshot.source,
      tests: snapshot.tests,
    });

    return await this.prepareNativeProgram(snapshot, {
      sourceFileName: "solution.py",
      harnessSource,
      compileCommand: {
        executable: this.toolchain.pythonPath,
        args: ["-m", "py_compile", "solution.py"],
      },
      runCommand: (testIndex, resultPath) => ({
        executable: this.toolchain.pythonPath,
        args: ["solution.py", String(testIndex), resultPath],
      }),
    });
  }
}
