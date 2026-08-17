import { pythonLiteral } from "../typeSystem/pythonTypes.js";
import {
  assertHarnessArgumentCount,
  type HarnessGenerator,
  type HarnessRequest,
} from "./HarnessGenerator.js";

export function generatePythonHarness(request: HarnessRequest): string {
  const branches = request.tests.map((test, testIndex) => {
    assertHarnessArgumentCount(request, testIndex);
    const argumentsSource = test.arguments
      .map((argument, argumentIndex) => {
        const parameter = request.signature.parameters[argumentIndex];
        if (!parameter) {
          throw new TypeError(`Missing parameter ${argumentIndex}.`);
        }
        return pythonLiteral(argument, parameter.type);
      })
      .join(", ");
    const keyword = testIndex === 0 ? "if" : "elif";
    return `    ${keyword} test_index == ${testIndex}:\n        return ${request.signature.name}(${argumentsSource})`;
  });

  return `import json
import sys

${request.candidateSource}

def __gca_run_test(test_index):
${branches.join("\n")}
    raise IndexError(f"Unknown test index: {test_index}")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise ValueError("Expected test index and result path")
    result = __gca_run_test(int(sys.argv[1]))
    with open(sys.argv[2], "w", encoding="utf-8") as result_file:
        json.dump(result, result_file, ensure_ascii=False, separators=(",", ":"))
`;
}

export const pythonHarnessGenerator: HarnessGenerator = {
  generate: generatePythonHarness,
};
