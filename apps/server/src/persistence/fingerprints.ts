import { createHash } from "node:crypto";

export function contentFingerprint(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

export function canonicalJson(value: unknown): string {
  const serialized = JSON.stringify(normalize(value));
  if (serialized === undefined) {
    throw new TypeError("Only JSON-serializable values can be fingerprinted.");
  }
  return serialized;
}

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (value === null || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, normalize(child)]),
  );
}
