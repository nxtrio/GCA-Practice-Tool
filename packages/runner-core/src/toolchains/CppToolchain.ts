import { ProcessRunner } from "../process/ProcessRunner.js";
import { findExecutable } from "./findExecutable.js";
import { readToolVersion } from "./toolchainUtils.js";

export type CppCompiler = "clang++" | "g++";

export type CppToolchain =
  | {
      available: true;
      compiler: CppCompiler;
      compilerPath: string;
      version: string;
    }
  | {
      available: false;
      compiler: null;
      compilerPath: null;
      version: null;
      installationHint: string;
    };

export async function detectCpp(
  processRunner = new ProcessRunner(),
  env: NodeJS.ProcessEnv = process.env,
): Promise<CppToolchain> {
  for (const compiler of ["clang++", "g++"] as const) {
    const compilerPath = await findExecutable([compiler], env);
    if (!compilerPath) continue;
    const version = await readToolVersion(
      compilerPath,
      ["--version"],
      processRunner,
    );
    if (version) {
      return {
        available: true,
        compiler,
        compilerPath,
        version,
      };
    }
  }

  return {
    available: false,
    compiler: null,
    compilerPath: null,
    version: null,
    installationHint:
      "Install clang++ or g++ with C++20 support and add it to PATH.",
  };
}

