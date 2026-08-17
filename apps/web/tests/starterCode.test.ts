import { describe, expect, it } from "vitest";
import { demoAssessment } from "../src/assessment/demoAssessment.ts";
import { starterCode } from "../src/editor/starterCode.ts";

describe("starterCode", () => {
  it("generates deterministic signatures for all three languages", () => {
    const matrixSignature = demoAssessment.problems[2]!.signature;

    expect(starterCode("java", matrixSignature)).toContain(
      "long solution(int[][] matrix)",
    );
    expect(starterCode("cpp", matrixSignature)).toContain(
      "long long solution(vector<vector<int>> matrix)",
    );
    expect(starterCode("python", matrixSignature)).toBe(
      "def solution(matrix):\n    pass",
    );
  });
});
