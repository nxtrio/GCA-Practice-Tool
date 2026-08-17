import type {
  FunctionSignature,
  SupportedValue,
} from "@gca-practice/contracts";

export interface HarnessTest {
  arguments: SupportedValue[];
}

export interface HarnessRequest {
  signature: FunctionSignature;
  candidateSource: string;
  tests: HarnessTest[];
}

export interface HarnessGenerator {
  generate(request: HarnessRequest): string;
}

export function assertHarnessArgumentCount(
  request: HarnessRequest,
  testIndex: number,
): void {
  const test = request.tests[testIndex];
  if (!test) {
    throw new RangeError(`Missing harness test at index ${testIndex}.`);
  }

  const expected = request.signature.parameters.length;
  const actual = test.arguments.length;
  if (actual !== expected) {
    throw new TypeError(
      `Harness test ${testIndex} has ${actual} arguments; expected ${expected}.`,
    );
  }
}

