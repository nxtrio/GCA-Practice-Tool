import type { SupportedValue, TypeSpec } from "@gca-practice/contracts";

const INT_MIN = -2_147_483_648;
const INT_MAX = 2_147_483_647;

export function assertValueMatchesType(
  value: SupportedValue,
  typeSpec: TypeSpec,
  path = "value",
): void {
  switch (typeSpec.kind) {
    case "int":
      if (
        typeof value !== "number" ||
        !Number.isInteger(value) ||
        value < INT_MIN ||
        value > INT_MAX
      ) {
        throw typeError(path, "int");
      }
      return;
    case "long":
      if (typeof value !== "number" || !Number.isSafeInteger(value)) {
        throw typeError(path, "long (JSON safe integer)");
      }
      return;
    case "boolean":
      if (typeof value !== "boolean") {
        throw typeError(path, "boolean");
      }
      return;
    case "string":
      if (typeof value !== "string") {
        throw typeError(path, "string");
      }
      return;
    case "array":
      if (!Array.isArray(value)) {
        throw typeError(path, formatTypeSpec(typeSpec));
      }
      value.forEach((item, index) => {
        assertValueMatchesType(item, typeSpec.items, `${path}[${index}]`);
      });
  }
}

export function formatTypeSpec(typeSpec: TypeSpec): string {
  return typeSpec.kind === "array"
    ? `array<${formatTypeSpec(typeSpec.items)}>`
    : typeSpec.kind;
}

function typeError(path: string, expected: string): TypeError {
  return new TypeError(`${path} must match ${expected}.`);
}

