import type { TypeSpec } from "@gca-practice/contracts";
import {
  javaLiteral,
  javaType,
} from "../typeSystem/javaTypes.js";
import {
  assertHarnessArgumentCount,
  type HarnessGenerator,
  type HarnessRequest,
} from "./HarnessGenerator.js";

export function generateJavaHarness(request: HarnessRequest): string {
  const cases = request.tests.map((test, testIndex) => {
    assertHarnessArgumentCount(request, testIndex);
    const argumentsSource = test.arguments
      .map((argument, argumentIndex) => {
        const parameter = request.signature.parameters[argumentIndex];
        if (!parameter) {
          throw new TypeError(`Missing parameter ${argumentIndex}.`);
        }
        return javaLiteral(argument, parameter.type);
      })
      .join(", ");

    return [
      `            case ${testIndex} -> {`,
      `                ${javaType(request.signature.returnType)} result = candidate.${request.signature.name}(${argumentsSource});`,
      "                __gcaWriteResult(args[1], __gcaSerializeResult(result));",
      "            }",
    ].join("\n");
  });

  return `import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;

public class Main {
${request.candidateSource}

    public static void main(String[] args) throws Exception {
        if (args.length != 2) {
            throw new IllegalArgumentException("Expected test index and result path");
        }

        int testIndex = Integer.parseInt(args[0]);
        Main candidate = new Main();

        switch (testIndex) {
${cases.join("\n")}
            default -> throw new IllegalArgumentException("Unknown test index: " + testIndex);
        }
    }

${generateJavaSerializer(request.signature.returnType)}

    private static void __gcaWriteResult(String path, String value) throws Exception {
        Files.writeString(Path.of(path), value, StandardCharsets.UTF_8);
    }

${JAVA_JSON_QUOTE_HELPER}
}
`;
}

export const javaHarnessGenerator: HarnessGenerator = {
  generate: generateJavaHarness,
};

function generateJavaSerializer(returnType: TypeSpec): string {
  const methods: string[] = [];
  let arrayIndex = 0;

  const addMethod = (typeSpec: TypeSpec, methodName: string): void => {
    if (typeSpec.kind !== "array") {
      methods.push(
        [
          `    private static String ${methodName}(${javaType(typeSpec)} value) {`,
          `        return ${javaScalarSerialization("value", typeSpec)};`,
          "    }",
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
      itemExpression = javaScalarSerialization("value[index]", typeSpec.items);
    }

    methods.push(
      [
        `    private static String ${methodName}(${javaType(typeSpec)} value) {`,
        "        StringBuilder output = new StringBuilder(\"[\");",
        "        for (int index = 0; index < value.length; index += 1) {",
        "            if (index > 0) output.append(',');",
        `            output.append(${itemExpression});`,
        "        }",
        "        return output.append(']').toString();",
        "    }",
      ].join("\n"),
    );
  };

  addMethod(returnType, "__gcaSerializeResult");
  return methods.join("\n\n");
}

function javaScalarSerialization(expression: string, typeSpec: TypeSpec): string {
  switch (typeSpec.kind) {
    case "int":
    case "long":
      return `String.valueOf(${expression})`;
    case "boolean":
      return `(${expression} ? "true" : "false")`;
    case "string":
      return `__gcaQuoteJson(${expression})`;
    case "array":
      throw new TypeError("Array serialization requires a generated method.");
  }
}

const JAVA_JSON_QUOTE_HELPER = String.raw`    private static String __gcaQuoteJson(String value) {
        StringBuilder output = new StringBuilder("\"");
        for (int index = 0; index < value.length(); index += 1) {
            char character = value.charAt(index);
            switch (character) {
                case '"' -> output.append("\\\"");
                case '\\' -> output.append("\\\\");
                case '\b' -> output.append("\\b");
                case '\f' -> output.append("\\f");
                case '\n' -> output.append("\\n");
                case '\r' -> output.append("\\r");
                case '\t' -> output.append("\\t");
                default -> {
                    if (character < 0x20) {
                        output.append(String.format("\\u%04x", (int) character));
                    } else {
                        output.append(character);
                    }
                }
            }
        }
        return output.append('"').toString();
    }`;

