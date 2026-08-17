import type {
  FunctionSignature,
  SupportedValue,
  TypeSpec,
} from "@gca-practice/contracts";
import { assertValueMatchesType } from "./TypeSpec.js";
import { cppStringContents } from "./stringEscaping.js";

export function cppType(typeSpec: TypeSpec): string {
  switch (typeSpec.kind) {
    case "int":
      return "int";
    case "long":
      return "long long";
    case "boolean":
      return "bool";
    case "string":
      return "string";
    case "array":
      return `vector<${cppType(typeSpec.items)}>`;
  }
}

export function cppSignature(signature: FunctionSignature): string {
  const parameters = signature.parameters
    .map((parameter) => `${cppType(parameter.type)} ${parameter.name}`)
    .join(", ");
  return `${cppType(signature.returnType)} ${signature.name}(${parameters})`;
}

export function cppStarterCode(signature: FunctionSignature): string {
  return `${cppSignature(signature)} {\n    throw runtime_error("Not implemented");\n}`;
}

export function cppLiteral(
  value: SupportedValue,
  typeSpec: TypeSpec,
): string {
  assertValueMatchesType(value, typeSpec);
  return generateCppLiteral(value, typeSpec);
}

function generateCppLiteral(
  value: SupportedValue,
  typeSpec: TypeSpec,
): string {
  switch (typeSpec.kind) {
    case "int":
      return String(value);
    case "long":
      return `${String(value)}LL`;
    case "boolean":
      return value ? "true" : "false";
    case "string": {
      const stringValue = value as string;
      return `string(${cppStringContents(stringValue)}, ${utf8ByteLength(stringValue)})`;
    }
    case "array": {
      const items = value as SupportedValue[];
      const literals = items.map((item) =>
        generateCppLiteral(item, typeSpec.items),
      );
      return `${cppType(typeSpec)}{${literals.join(", ")}}`;
    }
  }
}

function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint === undefined) continue;
    if (codePoint <= 0x7f) bytes += 1;
    else if (codePoint <= 0x7ff) bytes += 2;
    else if (codePoint <= 0xffff) bytes += 3;
    else bytes += 4;
  }
  return bytes;
}
