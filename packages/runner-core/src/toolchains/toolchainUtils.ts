import { ProcessRunner } from "../process/ProcessRunner.js";

export async function readToolVersion(
  executable: string,
  args: string[],
  processRunner: ProcessRunner,
): Promise<string | null> {
  const result = await processRunner.run({
    executable,
    args,
    timeoutMs: 3_000,
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

