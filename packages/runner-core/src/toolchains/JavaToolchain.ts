import { ProcessRunner } from "../process/ProcessRunner.js";
import { findExecutable } from "./findExecutable.js";
import { readToolVersion } from "./toolchainUtils.js";

export type JavaToolchain =
  | {
      available: true;
      javaPath: string;
      javacPath: string;
      version: string;
    }
  | {
      available: false;
      javaPath: string | null;
      javacPath: string | null;
      version: null;
      installationHint: string;
    };

export async function detectJava(
  processRunner = new ProcessRunner(),
  env: NodeJS.ProcessEnv = process.env,
): Promise<JavaToolchain> {
  const [javaPath, javacPath] = await Promise.all([
    findExecutable(["java"], env),
    findExecutable(["javac"], env),
  ]);

  if (!javaPath || !javacPath) {
    return {
      available: false,
      javaPath,
      javacPath,
      version: null,
      installationHint:
        "Install a JDK and ensure both java and javac are available on PATH.",
    };
  }

  const [version, javacVersion] = await Promise.all([
    readToolVersion(javaPath, ["-version"], processRunner),
    readToolVersion(javacPath, ["-version"], processRunner),
  ]);
  if (!version || !javacVersion) {
    return {
      available: false,
      javaPath,
      javacPath,
      version: null,
      installationHint:
        "Java was found but could not be executed; verify the JDK installation.",
    };
  }

  return { available: true, javaPath, javacPath, version };
}
