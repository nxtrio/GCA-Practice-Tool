import type {
  Assessment,
  Problem,
  ProblemExample,
  ProblemLimits,
  TestCase,
  TypeSpec,
} from "@gca-practice/contracts";
import {
  ASSESSMENT_PRESETS,
  AssessmentPresetResolutionError,
  resolveAssessmentPreset,
  type AssessmentPreset,
} from "@gca-practice/contracts";

export type SemanticValidationCode =
  | "invalid_preset"
  | "problem_count"
  | "invalid_slots"
  | "duplicate_problem_id"
  | "duplicate_test_id"
  | "missing_visible_tests"
  | "missing_hidden_tests"
  | "argument_count"
  | "argument_type"
  | "expected_type"
  | "example_argument_count"
  | "example_argument_type"
  | "example_output_type"
  | "invalid_duration"
  | "invalid_limit"
  | "empty_reference_solution"
  | "invalid_function_name"
  | "invalid_parameter_name"
  | "duplicate_parameter_name";

export interface SemanticValidationIssue {
  stage: "semantic";
  code: SemanticValidationCode;
  path: string;
  message: string;
}

interface TypeMismatch {
  path: string;
  actual: string;
}

const INT_MIN = -2_147_483_648;
const INT_MAX = 2_147_483_647;
const LIMIT_BOUNDS: Record<keyof ProblemLimits, { minimum: number; maximum: number }> = {
  executionTimeMs: { minimum: 1, maximum: 10_000 },
  compileTimeMs: { minimum: 1, maximum: 60_000 },
  outputLimitBytes: { minimum: 1_024, maximum: 1_048_576 },
};
const PORTABLE_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const RESERVED_IDENTIFIERS = new Set([
  "False",
  "None",
  "True",
  "_",
  "abstract",
  "alignas",
  "alignof",
  "and",
  "as",
  "assert",
  "async",
  "atomic_cancel",
  "atomic_commit",
  "atomic_noexcept",
  "auto",
  "await",
  "become",
  "bitand",
  "bitor",
  "bool",
  "boolean",
  "break",
  "byte",
  "case",
  "catch",
  "char",
  "char16_t",
  "char32_t",
  "char8_t",
  "class",
  "co_await",
  "co_return",
  "co_yield",
  "compl",
  "concept",
  "const",
  "const_cast",
  "consteval",
  "constexpr",
  "constinit",
  "continue",
  "decltype",
  "def",
  "default",
  "del",
  "delete",
  "do",
  "double",
  "dynamic_cast",
  "elif",
  "else",
  "enum",
  "except",
  "explicit",
  "export",
  "extends",
  "extern",
  "false",
  "final",
  "finally",
  "float",
  "for",
  "friend",
  "from",
  "goto",
  "if",
  "implements",
  "import",
  "in",
  "inline",
  "instanceof",
  "int",
  "interface",
  "is",
  "long",
  "module",
  "mutable",
  "namespace",
  "native",
  "new",
  "noexcept",
  "nonlocal",
  "not",
  "not_eq",
  "nullptr",
  "operator",
  "or",
  "or_eq",
  "override",
  "package",
  "pass",
  "private",
  "protected",
  "public",
  "raise",
  "reflexpr",
  "register",
  "reinterpret_cast",
  "requires",
  "return",
  "short",
  "signed",
  "sizeof",
  "static",
  "static_assert",
  "static_cast",
  "strictfp",
  "struct",
  "super",
  "switch",
  "synchronized",
  "template",
  "this",
  "thread_local",
  "throw",
  "throws",
  "transient",
  "true",
  "try",
  "typedef",
  "typeid",
  "typename",
  "union",
  "unsigned",
  "using",
  "virtual",
  "void",
  "volatile",
  "wchar_t",
  "while",
  "with",
  "xor",
  "xor_eq",
  "yield",
]);

export function validateAssessmentSemantics(
  assessmentDocument: Assessment,
): SemanticValidationIssue[] {
  const issues: SemanticValidationIssue[] = [];
  const { assessment } = assessmentDocument;
  let preset: AssessmentPreset | undefined;
  let presetResolutionIssue: SemanticValidationIssue | undefined;

  try {
    preset = resolveAssessmentPreset(assessment);
  } catch (error) {
    presetResolutionIssue = {
      stage: "semantic",
      code: "invalid_preset",
      path: "/assessment/preset",
      message:
        error instanceof AssessmentPresetResolutionError
          ? error.message
          : "The assessment preset could not be resolved.",
    };
  }

  const validationPreset = preset ?? ASSESSMENT_PRESETS.gca;

  if (assessment.problems.length !== validationPreset.problemCount) {
    issues.push({
      stage: "semantic",
      code: "problem_count",
      path: "/assessment/problems",
      message: `${validationPreset.displayName} requires exactly ${validationPreset.problemCount} problems; received ${assessment.problems.length}.`,
    });
  }

  const expectedSlots = Array.from(
    { length: validationPreset.problemCount },
    (_, index) => index + 1,
  );
  const actualSlots = assessment.problems
    .map(({ slot }) => slot)
    .sort((left, right) => left - right);
  if (
    actualSlots.length !== expectedSlots.length ||
    actualSlots.some((slot, index) => slot !== expectedSlots[index])
  ) {
    issues.push({
      stage: "semantic",
      code: "invalid_slots",
      path: "/assessment/problems",
      message: `${validationPreset.displayName} requires problem slots ${formatSlotList(expectedSlots)}.`,
    });
  }

  if (
    !Number.isSafeInteger(assessment.durationSeconds) ||
    assessment.durationSeconds !== validationPreset.durationSeconds
  ) {
    issues.push({
      stage: "semantic",
      code: "invalid_duration",
      path: "/assessment/durationSeconds",
      message: `${validationPreset.displayName} must last exactly ${validationPreset.durationSeconds} seconds (${validationPreset.durationSeconds / 60} minutes).`,
    });
  }

  if (presetResolutionIssue) {
    issues.push(presetResolutionIssue);
  }

  const problemIds = new Map<string, string>();

  assessment.problems.forEach((problem, problemIndex) => {
    const problemPath = `/assessment/problems/${problemIndex}`;
    const previousProblemPath = problemIds.get(problem.id);

    if (previousProblemPath) {
      issues.push({
        stage: "semantic",
        code: "duplicate_problem_id",
        path: `${problemPath}/id`,
        message: `Problem ID "${problem.id}" duplicates ${previousProblemPath}/id.`,
      });
    } else {
      problemIds.set(problem.id, problemPath);
    }

    validateProblem(problem, problemPath, issues);
  });

  return issues;
}

function formatSlotList(slots: number[]): string {
  if (slots.length === 1) return String(slots[0]);
  return `${slots.slice(0, -1).join(", ")} and ${slots.at(-1)}`;
}

function validateProblem(
  problem: Problem,
  problemPath: string,
  issues: SemanticValidationIssue[],
): void {
  validateSignatureNames(problem, problemPath, issues);

  if (problem.tests.visible.length === 0) {
    issues.push({
      stage: "semantic",
      code: "missing_visible_tests",
      path: `${problemPath}/tests/visible`,
      message: "At least one visible test is required.",
    });
  }

  if (problem.tests.hidden.length === 0) {
    issues.push({
      stage: "semantic",
      code: "missing_hidden_tests",
      path: `${problemPath}/tests/hidden`,
      message: "At least one hidden test is required.",
    });
  }

  validateLimits(problem.limits, `${problemPath}/limits`, issues);

  if (problem.validation.referenceSolution.trim().length === 0) {
    issues.push({
      stage: "semantic",
      code: "empty_reference_solution",
      path: `${problemPath}/validation/referenceSolution`,
      message: "A non-whitespace Python reference solution is required.",
    });
  }

  const testIds = new Map<string, string>();
  validateTestCollection(
    problem,
    problem.tests.visible,
    "visible",
    problemPath,
    testIds,
    issues,
  );
  validateTestCollection(
    problem,
    problem.tests.hidden,
    "hidden",
    problemPath,
    testIds,
    issues,
  );

  problem.examples.forEach((example, exampleIndex) => {
    validateExample(
      problem,
      example,
      `${problemPath}/examples/${exampleIndex}`,
      issues,
    );
  });
}

function validateSignatureNames(
  problem: Problem,
  problemPath: string,
  issues: SemanticValidationIssue[],
): void {
  const signaturePath = `${problemPath}/signature`;

  if (!isPortableIdentifier(problem.signature.name)) {
    issues.push({
      stage: "semantic",
      code: "invalid_function_name",
      path: `${signaturePath}/name`,
      message:
        `Function name "${problem.signature.name}" is not a portable ` +
        "Java/C++/Python identifier.",
    });
  }

  const parameterNames = new Map<string, string>();
  problem.signature.parameters.forEach((parameter, parameterIndex) => {
    const parameterPath = `${signaturePath}/parameters/${parameterIndex}`;

    if (!isPortableIdentifier(parameter.name)) {
      issues.push({
        stage: "semantic",
        code: "invalid_parameter_name",
        path: `${parameterPath}/name`,
        message:
          `Parameter name "${parameter.name}" is not a portable ` +
          "Java/C++/Python identifier.",
      });
    }

    const previousParameterPath = parameterNames.get(parameter.name);
    if (previousParameterPath) {
      issues.push({
        stage: "semantic",
        code: "duplicate_parameter_name",
        path: `${parameterPath}/name`,
        message:
          `Parameter name "${parameter.name}" duplicates ` +
          `${previousParameterPath}/name.`,
      });
    } else {
      parameterNames.set(parameter.name, parameterPath);
    }
  });
}

function isPortableIdentifier(value: string): boolean {
  return PORTABLE_IDENTIFIER.test(value) && !RESERVED_IDENTIFIERS.has(value);
}

function validateLimits(
  limits: ProblemLimits,
  limitsPath: string,
  issues: SemanticValidationIssue[],
): void {
  const entries = Object.entries(limits) as Array<
    [keyof ProblemLimits, number]
  >;

  for (const [name, value] of entries) {
    const bounds = LIMIT_BOUNDS[name];
    if (
      !Number.isSafeInteger(value) ||
      value < bounds.minimum ||
      value > bounds.maximum
    ) {
      issues.push({
        stage: "semantic",
        code: "invalid_limit",
        path: `${limitsPath}/${name}`,
        message:
          `${name} must be an integer between ${bounds.minimum} and ` +
          `${bounds.maximum}.`,
      });
    }
  }
}

function validateTestCollection(
  problem: Problem,
  tests: TestCase[],
  visibility: "visible" | "hidden",
  problemPath: string,
  testIds: Map<string, string>,
  issues: SemanticValidationIssue[],
): void {
  tests.forEach((test, testIndex) => {
    const testPath = `${problemPath}/tests/${visibility}/${testIndex}`;
    const previousTestPath = testIds.get(test.id);

    if (previousTestPath) {
      issues.push({
        stage: "semantic",
        code: "duplicate_test_id",
        path: `${testPath}/id`,
        message: `Test ID "${test.id}" duplicates ${previousTestPath}/id.`,
      });
    } else {
      testIds.set(test.id, testPath);
    }

    validateArguments(
      problem,
      test.arguments,
      `${testPath}/arguments`,
      "argument_count",
      "argument_type",
      issues,
    );
    validateOutput(
      test.expected,
      problem.signature.returnType,
      `${testPath}/expected`,
      "expected_type",
      issues,
    );
  });
}

function validateExample(
  problem: Problem,
  example: ProblemExample,
  examplePath: string,
  issues: SemanticValidationIssue[],
): void {
  validateArguments(
    problem,
    example.arguments,
    `${examplePath}/arguments`,
    "example_argument_count",
    "example_argument_type",
    issues,
  );
  validateOutput(
    example.output,
    problem.signature.returnType,
    `${examplePath}/output`,
    "example_output_type",
    issues,
  );
}

function validateArguments(
  problem: Problem,
  values: TestCase["arguments"],
  argumentsPath: string,
  countCode: "argument_count" | "example_argument_count",
  typeCode: "argument_type" | "example_argument_type",
  issues: SemanticValidationIssue[],
): void {
  const parameters = problem.signature.parameters;

  if (values.length !== parameters.length) {
    issues.push({
      stage: "semantic",
      code: countCode,
      path: argumentsPath,
      message:
        `${problem.signature.name}() accepts ${parameters.length} ` +
        `${parameters.length === 1 ? "argument" : "arguments"}; ` +
        `received ${values.length}.`,
    });
  }

  const comparableCount = Math.min(values.length, parameters.length);
  for (let index = 0; index < comparableCount; index += 1) {
    const parameter = parameters[index];
    const value = values[index];

    if (!parameter || value === undefined) {
      continue;
    }

    const valuePath = `${argumentsPath}/${index}`;
    const mismatch = findTypeMismatch(value, parameter.type, valuePath);
    if (mismatch) {
      issues.push({
        stage: "semantic",
        code: typeCode,
        path: mismatch.path,
        message:
          `Argument ${index + 1} (${parameter.name}) must match ` +
          `${formatTypeSpec(parameter.type)}; received ${mismatch.actual}.`,
      });
    }
  }
}

function validateOutput(
  value: TestCase["expected"],
  returnType: TypeSpec,
  outputPath: string,
  code: "expected_type" | "example_output_type",
  issues: SemanticValidationIssue[],
): void {
  const mismatch = findTypeMismatch(value, returnType, outputPath);
  if (mismatch) {
    issues.push({
      stage: "semantic",
      code,
      path: mismatch.path,
      message:
        `Output must match ${formatTypeSpec(returnType)}; ` +
        `received ${mismatch.actual}.`,
    });
  }
}

function findTypeMismatch(
  value: TestCase["expected"],
  typeSpec: TypeSpec,
  path: string,
): TypeMismatch | null {
  switch (typeSpec.kind) {
    case "int": {
      if (typeof value === "number" && Number.isInteger(value)) {
        return value >= INT_MIN && value <= INT_MAX
          ? null
          : { path, actual: "integer outside the signed 32-bit range" };
      }
      return { path, actual: describeValue(value) };
    }
    case "long": {
      if (typeof value === "number" && Number.isInteger(value)) {
        return Number.isSafeInteger(value)
          ? null
          : { path, actual: "integer outside the JSON safe-integer range" };
      }
      return { path, actual: describeValue(value) };
    }
    case "boolean":
      return typeof value === "boolean"
        ? null
        : { path, actual: describeValue(value) };
    case "string":
      return typeof value === "string"
        ? null
        : { path, actual: describeValue(value) };
    case "array":
      if (!Array.isArray(value)) {
        return { path, actual: describeValue(value) };
      }

      for (let index = 0; index < value.length; index += 1) {
        const nestedValue = value[index];
        if (nestedValue === undefined) {
          continue;
        }
        const mismatch = findTypeMismatch(
          nestedValue,
          typeSpec.items,
          `${path}/${index}`,
        );
        if (mismatch) {
          return mismatch;
        }
      }
      return null;
  }
}

function formatTypeSpec(typeSpec: TypeSpec): string {
  return typeSpec.kind === "array"
    ? `array<${formatTypeSpec(typeSpec.items)}>`
    : typeSpec.kind;
}

function describeValue(value: TestCase["expected"]): string {
  if (Array.isArray(value)) {
    return "array";
  }
  if (typeof value === "number") {
    return Number.isInteger(value) ? "integer" : "number";
  }
  return typeof value;
}
