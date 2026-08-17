import type { TypeSpec } from "@gca-practice/contracts";
import { cppLiteral, cppType } from "../typeSystem/cppTypes.js";
import {
  assertHarnessArgumentCount,
  type HarnessGenerator,
  type HarnessRequest,
} from "./HarnessGenerator.js";

export function generateCppHarness(request: HarnessRequest): string {
  const cases = request.tests.map((test, testIndex) => {
    assertHarnessArgumentCount(request, testIndex);
    const argumentsSource = test.arguments
      .map((argument, argumentIndex) => {
        const parameter = request.signature.parameters[argumentIndex];
        if (!parameter) {
          throw new TypeError(`Missing parameter ${argumentIndex}.`);
        }
        return cppLiteral(argument, parameter.type);
      })
      .join(", ");

    return [
      `        case ${testIndex}: {`,
      `            ${cppType(request.signature.returnType)} result = ${request.signature.name}(${argumentsSource});`,
      "            __gcaWriteResult(argv[2], __gcaSerializeResult(result));",
      "            break;",
      "        }",
    ].join("\n");
  });

  return `#include <algorithm>
#include <array>
#include <bitset>
#include <chrono>
#include <climits>
#include <cmath>
#include <cstdint>
#include <cstring>
#include <deque>
#include <fstream>
#include <functional>
#include <iostream>
#include <iomanip>
#include <limits>
#include <list>
#include <map>
#include <numeric>
#include <queue>
#include <random>
#include <set>
#include <sstream>
#include <stack>
#include <stdexcept>
#include <string>
#include <tuple>
#include <unordered_map>
#include <unordered_set>
#include <utility>
#include <vector>
using namespace std;

${request.candidateSource}

${CPP_JSON_QUOTE_HELPER}

${generateCppSerializer(request.signature.returnType)}

static void __gcaWriteResult(const string& path, const string& value) {
    ofstream output(path, ios::binary);
    if (!output) throw runtime_error("Unable to open judge result file");
    output << value;
}

int main(int argc, char** argv) {
    if (argc != 3) throw invalid_argument("Expected test index and result path");
    int testIndex = stoi(argv[1]);

    switch (testIndex) {
${cases.join("\n")}
        default:
            throw invalid_argument("Unknown test index: " + to_string(testIndex));
    }

    return 0;
}
`;
}

export const cppHarnessGenerator: HarnessGenerator = {
  generate: generateCppHarness,
};

function generateCppSerializer(returnType: TypeSpec): string {
  const methods: string[] = [];
  let arrayIndex = 0;

  const addMethod = (typeSpec: TypeSpec, methodName: string): void => {
    if (typeSpec.kind !== "array") {
      const parameterType =
        typeSpec.kind === "string"
          ? "const string&"
          : cppType(typeSpec);
      methods.push(
        [
          `static string ${methodName}(${parameterType} value) {`,
          `    return ${cppScalarSerialization("value", typeSpec)};`,
          "}",
        ].join("\n"),
      );
      return;
    }

    let itemExpression: string;
    if (typeSpec.items.kind === "array") {
      const itemMethodName = `__gcaSerializeArray${arrayIndex}`;
      arrayIndex += 1;
      addMethod(typeSpec.items, itemMethodName);
      itemExpression = `${itemMethodName}(value[index])`;
    } else {
      itemExpression = cppScalarSerialization("value[index]", typeSpec.items);
    }

    methods.push(
      [
        `static string ${methodName}(const ${cppType(typeSpec)}& value) {`,
        '    string output = "[";',
        "    for (size_t index = 0; index < value.size(); index += 1) {",
        "        if (index > 0) output.push_back(',');",
        `        output += ${itemExpression};`,
        "    }",
        "    output.push_back(']');",
        "    return output;",
        "}",
      ].join("\n"),
    );
  };

  addMethod(returnType, "__gcaSerializeResult");
  return methods.join("\n\n");
}

function cppScalarSerialization(expression: string, typeSpec: TypeSpec): string {
  switch (typeSpec.kind) {
    case "int":
    case "long":
      return `to_string(${expression})`;
    case "boolean":
      return `(${expression} ? "true" : "false")`;
    case "string":
      return `__gcaQuoteJson(${expression})`;
    case "array":
      throw new TypeError("Array serialization requires a generated method.");
  }
}

const CPP_JSON_QUOTE_HELPER = String.raw`static string __gcaQuoteJson(const string& value) {
    static const char* hex = "0123456789abcdef";
    string output = "\"";
    for (unsigned char character : value) {
        switch (character) {
            case '"': output += "\\\""; break;
            case '\\': output += "\\\\"; break;
            case '\b': output += "\\b"; break;
            case '\f': output += "\\f"; break;
            case '\n': output += "\\n"; break;
            case '\r': output += "\\r"; break;
            case '\t': output += "\\t"; break;
            default:
                if (character < 0x20) {
                    output += "\\u00";
                    output.push_back(hex[(character >> 4) & 0x0f]);
                    output.push_back(hex[character & 0x0f]);
                } else {
                    output.push_back(static_cast<char>(character));
                }
        }
    }
    output.push_back('"');
    return output;
}`;
