import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { delimiter, extname, isAbsolute, join } from "node:path";

export async function findExecutable(
  names: string[],
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): Promise<string | null> {
  const pathEntries = (env.PATH ?? env.Path ?? env.path ?? "")
    .split(delimiter)
    .filter((entry) => entry.length > 0);
  const windowsExtensions =
    platform === "win32"
      ? (env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD")
          .split(";")
          .filter(Boolean)
      : [""];

  for (const name of names) {
    const candidates = isAbsolute(name)
      ? [name]
      : pathEntries.flatMap((entry) => {
          if (platform !== "win32" || extname(name).length > 0) {
            return [join(entry, name)];
          }
          return windowsExtensions.map((extension) =>
            join(entry, `${name}${extension.toLowerCase()}`),
          );
        });

    for (const candidate of candidates) {
      try {
        await access(candidate, constants.X_OK);
        return candidate;
      } catch {
        // Continue through PATH candidates.
      }
    }
  }

  return null;
}

