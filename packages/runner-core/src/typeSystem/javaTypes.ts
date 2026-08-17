import type {
  FunctionSignature,
  SupportedValue,
  TypeSpec,
} from "@gca-practice/contracts";
import { assertValueMatchesType } from "./TypeSpec.js";
import { javaStringLiteral } from "./stringEscaping.js";

export function javaType(typeSpec: TypeSpec): string {
  switch (typeSpec.kind) {
    case "int":
      return "int";
    case "long":
      return "long";
    case "boolean":
      return "boolean";
    case "string":
      return "String";
    case "array":
      return `${javaType(typeSpec.items)}[]`;
  }
}

export function javaSignature(signature: FunctionSignature): string {
  const parameters = signature.parameters
    .map((parameter) => `${javaType(parameter.type)} ${parameter.name}`)
    .join(", ");
  return `${javaType(signature.returnType)} ${signature.name}(${parameters})`;
}

export function javaStarterCode(signature: FunctionSignature): string {
  return `${javaSignature(signature)} {\n    throw new UnsupportedOperationException("Not implemented");\n}`;
}

export function javaLiteral(
  value: SupportedValue,
  typeSpec: TypeSpec,
): string {
  assertValueMatchesType(value, typeSpec);
  return generateJavaLiteral(value, typeSpec);
}

function generateJavaLiteral(
  value: SupportedValue,
  typeSpec: TypeSpec,
): string {
  switch (typeSpec.kind) {
    case "int":
      return String(value);
    case "long":
      return `${String(value)}L`;
    case "boolean":
      return value ? "true" : "false";
    case "string":
      return javaStringLiteral(value as string);
    case "array": {
      const items = value as SupportedValue[];
      const literals = items.map((item) =>
        generateJavaLiteral(item, typeSpec.items),
      );
      return `new ${javaType(typeSpec)}{${literals.join(", ")}}`;
    }
  }
}

