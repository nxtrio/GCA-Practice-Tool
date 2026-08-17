import type { PrepareRequest, PreparedProgram } from "./LanguageRunner.js";
import { generateJavaHarness } from "../harness/JavaHarness.js";
import { ProcessRunner } from "../process/ProcessRunner.js";
import type { JavaToolchain } from "../toolchains/JavaToolchain.js";
import {
  BaseLanguageRunner,
  DEFAULT_MAX_SOURCE_BYTES,
} from "./BaseLanguageRunner.js";

type AvailableJavaToolchain = Extract<JavaToolchain, { available: true }>;

export class JavaRunner extends BaseLanguageRunner {
  constructor(
    private readonly toolchain: AvailableJavaToolchain,
    processRunner = new ProcessRunner(),
    maxSourceBytes = DEFAULT_MAX_SOURCE_BYTES,
  ) {
    super("java", processRunner, maxSourceBytes);
  }

  async prepare(request: PrepareRequest): Promise<PreparedProgram> {
    const snapshot = structuredClone(request);
    const harnessSource = generateJavaHarness({
      signature: snapshot.signature,
      candidateSource: snapshot.source,
      tests: snapshot.tests,
    });

    return await this.prepareNativeProgram(snapshot, {
      sourceFileName: "Main.java",
      harnessSource,
      compileCommand: {
        executable: this.toolchain.javacPath,
        args: ["-encoding", "UTF-8", "Main.java"],
      },
      runCommand: (testIndex, resultPath) => ({
        executable: this.toolchain.javaPath,
        args: [
          "-Xmx256m",
          "-cp",
          ".",
          "Main",
          String(testIndex),
          resultPath,
        ],
      }),
    });
  }
}
