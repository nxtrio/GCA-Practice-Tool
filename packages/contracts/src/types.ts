export type PrimitiveTypeSpec = {
  kind: "int" | "long" | "boolean" | "string";
};

export type ArrayTypeSpec = {
  kind: "array";
  items: TypeSpec;
};

export type TypeSpec = PrimitiveTypeSpec | ArrayTypeSpec;

export type SupportedValue = number | boolean | string | SupportedValue[];

export type Language = "java" | "cpp" | "python";

export type ReferenceLanguage = "python";

