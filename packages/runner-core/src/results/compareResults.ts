import type { SupportedValue } from "@gca-practice/contracts";

export function areSupportedValuesEqual(
  actual: SupportedValue,
  expected: SupportedValue,
): boolean {
  if (typeof actual === "number" && typeof expected === "number") {
    return actual === expected;
  }
  if (Array.isArray(actual) && Array.isArray(expected)) {
    return (
      actual.length === expected.length &&
      actual.every((value, index) => {
        const expectedValue = expected[index];
        return (
          expectedValue !== undefined &&
          areSupportedValuesEqual(value, expectedValue)
        );
      })
    );
  }
  return actual === expected;
}

