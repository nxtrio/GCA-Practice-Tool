import type {
  FunctionSignature,
  Language,
  TypeSpec,
} from "@gca-practice/contracts";

export function starterCode(
  language: Language,
  signature: FunctionSignature,
): string {
  const parameters = signature.parameters
    .map((parameter) => parameter.name)
    .join(", ");

  switch (language) {
    case "java":
      return `${javaType(signature.returnType)} ${signature.name}(${signature.parameters
        .map((parameter) => `${javaType(parameter.type)} ${parameter.name}`)
        .join(", ")}) {\n    throw new UnsupportedOperationException("Not implemented");\n}`;
    case "cpp":
      return `${cppType(signature.returnType)} ${signature.name}(${signature.parameters
        .map((parameter) => `${cppType(parameter.type)} ${parameter.name}`)
        .join(", ")}) {\n    throw runtime_error("Not implemented");\n}`;
    case "python":
      return `def ${signature.name}(${parameters}):\n    pass`;
  }
}

function javaType(type: TypeSpec): string {
  switch (type.kind) {
    case "int":
      return "int";
    case "long":
      return "long";
    case "boolean":
      return "boolean";
    case "string":
      return "String";
    case "array":
      return `${javaType(type.items)}[]`;
  }
}

function cppType(type: TypeSpec): string {
  switch (type.kind) {
    case "int":
      return "int";
    case "long":
      return "long long";
    case "boolean":
      return "bool";
    case "string":
      return "string";
    case "array":
      return `vector<${cppType(type.items)}>`;
  }
}
