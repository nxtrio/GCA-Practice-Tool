import { ProcessRunner } from "../process/ProcessRunner.js";
import { findExecutable } from "./findExecutable.js";
import { readToolVersion } from "./toolchainUtils.js";

export type PythonToolchain =
  | {
      available: true;
      pythonPath: string;
      version: string;
    }
  | {
      available: false;
      pythonPath: null;
      version: null;
      installationHint: string;
    };

export async function detectPython(
  processRunner = new ProcessRunner(),
  env: NodeJS.ProcessEnv = process.env,
): Promise<PythonToolchain> {
  const pythonPath = await findExecutable(["python3"], env);
  if (!pythonPath) {
    return {
      available: false,
      pythonPath: null,
      version: null,
      installationHint: "Install Python 3 and ensure python3 is available on PATH.",
    };
  }

  const version = await readToolVersion(
    pythonPath,
    ["--version"],
    processRunner,
  );
  if (!version) {
    return {
      available: false,
      pythonPath: null,
      version: null,
      installationHint:
        "Python 3 was found but could not be executed; verify the installation.",
    };
  }

  return { available: true, pythonPath, version };
}
