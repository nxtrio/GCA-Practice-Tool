import type { FunctionSignature, TypeSpec } from "@gca-practice/contracts";
import { describe, expect, it } from "vitest";
import {
  cppLiteral,
  cppSignature,
  cppStarterCode,
  cppType,
  areSupportedValuesEqual,
  generateCppHarness,
  generateJavaHarness,
  generatePythonHarness,
  javaLiteral,
  javaSignature,
  javaStarterCode,
  javaType,
  pythonLiteral,
  pythonSignature,
  pythonStarterCode,
  pythonType,
} from "../src/index.ts";

const nestedIntArray: TypeSpec = {
  kind: "array",
  items: {
    kind: "array",
    items: { kind: "int" },
  },
};

const signature: FunctionSignature = {
  name: "solution",
  parameters: [
    {
      name: "numbers",
      type: { kind: "array", items: { kind: "int" } },
    },
    { name: "enabled", type: { kind: "boolean" } },
    { name: "label", type: { kind: "string" } },
  ],
  returnType: { kind: "long" },
};

describe("language type and signature generation", () => {
  it("generates Java types, signatures, and starter code", () => {
    expect(javaType(nestedIntArray)).toBe("int[][]");
    expect(javaSignature(signature)).toBe(
      "long solution(int[] numbers, boolean enabled, String label)",
    );
    expect(javaStarterCode(signature)).toContain(
      'throw new UnsupportedOperationException("Not implemented")',
    );
  });

  it("generates C++ types, signatures, and starter code", () => {
    expect(cppType(nestedIntArray)).toBe("vector<vector<int>>");
    expect(cppSignature(signature)).toBe(
      "long long solution(vector<int> numbers, bool enabled, string label)",
    );
    expect(cppStarterCode(signature)).toContain(
      'throw runtime_error("Not implemented")',
    );
  });

  it("generates Python types, signatures, and starter code", () => {
    expect(pythonType(nestedIntArray)).toBe("list[list[int]]");
    expect(pythonSignature(signature)).toBe(
      "def solution(numbers, enabled, label):",
    );
    expect(pythonStarterCode(signature)).toBe(
      "def solution(numbers, enabled, label):\n    pass",
    );
  });
});

describe("language source literal generation", () => {
  const escaped = 'quote " slash \\ newline\n tab\t return\r nul\0 café 😀';
  const stringType: TypeSpec = { kind: "string" };

  it("generates scalar literals", () => {
    expect(javaLiteral(-12, { kind: "int" })).toBe("-12");
    expect(javaLiteral(5_000_000_000, { kind: "long" })).toBe(
      "5000000000L",
    );
    expect(javaLiteral(true, { kind: "boolean" })).toBe("true");

    expect(cppLiteral(-12, { kind: "int" })).toBe("-12");
    expect(cppLiteral(5_000_000_000, { kind: "long" })).toBe(
      "5000000000LL",
    );
    expect(cppLiteral(false, { kind: "boolean" })).toBe("false");

    expect(pythonLiteral(5_000_000_000, { kind: "long" })).toBe(
      "5000000000",
    );
    expect(pythonLiteral(true, { kind: "boolean" })).toBe("True");
  });

  it("escapes quotes, slashes, controls, empty strings, and Unicode", () => {
    expect(javaLiteral(escaped, stringType)).toBe(
      '"quote \\" slash \\\\ newline\\n tab\\t return\\r nul\\000 café 😀"',
    );
    expect(cppLiteral(escaped, stringType)).toBe(
      'string("quote \\" slash \\\\ newline\\n tab\\t return\\r nul\\000 café 😀", 53)',
    );
    expect(pythonLiteral(escaped, stringType)).toBe(
      '"quote \\" slash \\\\ newline\\n tab\\t return\\r nul\\u0000 café 😀"',
    );
    expect(javaLiteral("", stringType)).toBe('""');
    expect(cppLiteral("", stringType)).toBe('string("", 0)');
    expect(pythonLiteral("", stringType)).toBe('""');
  });

  it("generates empty and nested arrays with explicit element types", () => {
    const value = [[1], []];

    expect(javaLiteral(value, nestedIntArray)).toBe(
      "new int[][]{new int[]{1}, new int[]{}}",
    );
    expect(cppLiteral(value, nestedIntArray)).toBe(
      "vector<vector<int>>{vector<int>{1}, vector<int>{}}",
    );
    expect(pythonLiteral(value, nestedIntArray)).toBe("[[1], []]");
  });

  it("rejects values that do not match their TypeSpec", () => {
    expect(() => javaLiteral("1", { kind: "int" })).toThrow(
      "value must match int",
    );
    expect(() => cppLiteral([1, "2"], {
      kind: "array",
      items: { kind: "int" },
    })).toThrow("value[1] must match int");
    expect(() =>
      pythonLiteral(Number.MAX_SAFE_INTEGER + 1, { kind: "long" }),
    ).toThrow("JSON safe integer");
  });
});

describe("harness call generation", () => {
  const callSignature: FunctionSignature = {
    name: "solution",
    parameters: [
      {
        name: "numbers",
        type: { kind: "array", items: { kind: "int" } },
      },
      { name: "label", type: { kind: "string" } },
    ],
    returnType: { kind: "boolean" },
  };

  it("materializes typed function arguments without stdin parsing", () => {
    const common = {
      signature: callSignature,
      tests: [{ arguments: [[1, 2, 3], "abc"] }],
    };

    expect(
      generateJavaHarness({
        ...common,
        candidateSource:
          "boolean solution(int[] numbers, String label) { return true; }",
      }),
    ).toContain(
      'candidate.solution(new int[]{1, 2, 3}, "abc")',
    );
    expect(
      generateCppHarness({
        ...common,
        candidateSource:
          "bool solution(vector<int> numbers, string label) { return true; }",
      }),
    ).toContain(
      'solution(vector<int>{1, 2, 3}, string("abc", 3))',
    );
    expect(
      generatePythonHarness({
        ...common,
        candidateSource:
          "def solution(numbers, label):\n    return True",
      }),
    ).toContain('solution([1, 2, 3], "abc")');
  });

  it("rejects a harness testcase with the wrong argument count", () => {
    expect(() =>
      generateJavaHarness({
        signature: callSignature,
        candidateSource:
          "boolean solution(int[] numbers, String label) { return true; }",
        tests: [{ arguments: [[1, 2, 3]] }],
      }),
    ).toThrow("Harness test 0 has 1 arguments; expected 2.");
  });
});

describe("supported result comparison", () => {
  it("compares nested values structurally and treats negative zero as JSON zero", () => {
    expect(areSupportedValuesEqual(-0, 0)).toBe(true);
    expect(areSupportedValuesEqual([[1], [], [2]], [[1], [], [2]])).toBe(
      true,
    );
    expect(areSupportedValuesEqual([[1]], [[2]])).toBe(false);
  });
});
