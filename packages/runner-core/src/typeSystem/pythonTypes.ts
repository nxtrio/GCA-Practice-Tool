import type {
  FunctionSignature,
  SupportedValue,
  TypeSpec,
} from "@gca-practice/contracts";
import { assertValueMatchesType } from "./TypeSpec.js";
import { pythonStringLiteral } from "./stringEscaping.js";

export function pythonType(typeSpec: TypeSpec): string {
  switch (typeSpec.kind) {
    case "int":
    case "long":
      return "int";
    case "boolean":
      return "bool";
    case "string":
      return "str";
    case "array":
      return `list[${pythonType(typeSpec.items)}]`;
  }
}

export function pythonSignature(signature: FunctionSignature): string {
  const parameters = signature.parameters
    .map((parameter) => parameter.name)
    .join(", ");
  return `def ${signature.name}(${parameters}):`;
}

export function pythonStarterCode(signature: FunctionSignature): string {
  return `${pythonSignature(signature)}\n    pass`;
}

export function pythonLiteral(
  value: SupportedValue,
  typeSpec: TypeSpec,
): string {
  assertValueMatchesType(value, typeSpec);
  return generatePythonLiteral(value, typeSpec);
}

function generatePythonLiteral(
  value: SupportedValue,
  typeSpec: TypeSpec,
): string {
  switch (typeSpec.kind) {
    case "int":
    case "long":
      return String(value);
    case "boolean":
      return value ? "True" : "False";
    case "string":
      return pythonStringLiteral(value as string);
    case "array": {
      const items = value as SupportedValue[];
      const literals = items.map((item) =>
        generatePythonLiteral(item, typeSpec.items),
      );
      return `[${literals.join(", ")}]`;
    }
  }
}
