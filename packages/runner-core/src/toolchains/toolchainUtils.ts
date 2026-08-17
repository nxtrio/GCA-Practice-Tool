import { ProcessRunner } from "../process/ProcessRunner.js";

export const TOOLCHAIN_VERSION_TIMEOUT_MS = 10_000;

export async function readToolVersion(
  executable: string,
  args: string[],
  processRunner: ProcessRunner,
): Promise<string | null> {
  const result = await processRunner.run({
    executable,
    args,
    // A freshly installed JDK can take several seconds to initialize on a
    // cold, resource-constrained machine even though it is fully functional.
    timeoutMs: TOOLCHAIN_VERSION_TIMEOUT_MS,
    outputLimitBytes: 64 * 1024,
  });
  if (result.terminationReason !== "exited" || result.exitCode !== 0) {
    return null;
  }

  const output = [result.stdout, result.stderr]
    .filter((part) => part.length > 0)
    .join("\n")
    .trim();
  return output.split(/\r?\n/, 1)[0] ?? null;
}
