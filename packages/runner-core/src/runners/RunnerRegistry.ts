import type { Language } from "@gca-practice/contracts";
import { ProcessRunner } from "../process/ProcessRunner.js";
import {
  detectCpp,
  type CppToolchain,
} from "../toolchains/CppToolchain.js";
import {
  detectJava,
  type JavaToolchain,
} from "../toolchains/JavaToolchain.js";
import {
  detectPython,
  type PythonToolchain,
} from "../toolchains/PythonToolchain.js";
import { CppRunner } from "./CppRunner.js";
import type { LanguageRunner } from "./LanguageRunner.js";
import { JavaRunner } from "./JavaRunner.js";
import { PythonRunner } from "./PythonRunner.js";

export interface DetectedToolchains {
  java: JavaToolchain;
  cpp: CppToolchain;
  python: PythonToolchain;
}

export class RunnerRegistry {
  private readonly runners = new Map<Language, LanguageRunner>();

  constructor(
    readonly toolchains: DetectedToolchains,
    processRunner = new ProcessRunner(),
  ) {
    if (toolchains.java.available) {
      this.runners.set("java", new JavaRunner(toolchains.java, processRunner));
    }
    if (toolchains.cpp.available) {
      this.runners.set("cpp", new CppRunner(toolchains.cpp, processRunner));
    }
    if (toolchains.python.available) {
      this.runners.set(
        "python",
        new PythonRunner(toolchains.python, processRunner),
      );
    }
  }

  static async detect(
    processRunner = new ProcessRunner(),
    env: NodeJS.ProcessEnv = process.env,
  ): Promise<RunnerRegistry> {
    const [java, cpp, python] = await Promise.all([
      detectJava(processRunner, env),
      detectCpp(processRunner, env),
      detectPython(processRunner, env),
    ]);
    return new RunnerRegistry({ java, cpp, python }, processRunner);
  }

  get(language: Language): LanguageRunner | undefined {
    return this.runners.get(language);
  }

  has(language: Language): boolean {
    return this.runners.has(language);
  }

  availableLanguages(): Language[] {
    return [...this.runners.keys()];
  }
}
