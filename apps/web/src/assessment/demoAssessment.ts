import type { AssessmentView } from "./types.js";

export const demoAssessment: AssessmentView = {
  id: "demo-gca",
  preset: "gca",
  title: "GCA Practice · Focus Session",
  durationSeconds: 4_200,
  problems: [
    {
      id: "p1",
      slot: 1,
      title: "Array Total",
      generationMetadata: {
        conceptSummary: "Sum all integers in an array.",
        skills: ["arrays", "iteration"],
        expectedComplexity: "O(n)",
        patternTags: ["array traversal"],
      },
      description: "Return the sum of all values in numbers.",
      constraints: ["1 ≤ numbers.length ≤ 100,000"],
      signature: {
        name: "solution",
        parameters: [
          {
            name: "numbers",
            type: { kind: "array", items: { kind: "int" } },
          },
        ],
        returnType: { kind: "int" },
      },
      examples: [
        {
          arguments: [[1, 2, 3]],
          output: 6,
          explanation: "The three values sum to 6.",
        },
      ],
      visibleTests: [
        {
          id: "p1-v1",
          arguments: [[1, 2, 3]],
          expected: 6,
          category: "example",
        },
      ],
    },
    {
      id: "p2",
      slot: 2,
      title: "Mirror Text",
      generationMetadata: {
        conceptSummary: "Reverse the characters in a string.",
        skills: ["strings", "iteration"],
        expectedComplexity: "O(n)",
        patternTags: ["string traversal"],
      },
      description: "Return text with its characters in reverse order.",
      constraints: ["0 ≤ text.length ≤ 100,000"],
      signature: {
        name: "solution",
        parameters: [{ name: "text", type: { kind: "string" } }],
        returnType: { kind: "string" },
      },
      examples: [
        {
          arguments: ["practice"],
          output: "ecitcarp",
          explanation: "Reading the input backward produces the result.",
        },
      ],
      visibleTests: [
        {
          id: "p2-v1",
          arguments: ["practice"],
          expected: "ecitcarp",
          category: "example",
        },
      ],
    },
    {
      id: "p3",
      slot: 3,
      title: "Matrix Total",
      generationMetadata: {
        conceptSummary: "Aggregate every value in a matrix.",
        skills: ["matrices", "nested iteration"],
        expectedComplexity: "O(rows × columns)",
        patternTags: ["matrix traversal"],
      },
      description: "Return the sum of every integer in matrix.",
      constraints: ["1 ≤ matrix.length ≤ 1,000"],
      signature: {
        name: "solution",
        parameters: [
          {
            name: "matrix",
            type: {
              kind: "array",
              items: { kind: "array", items: { kind: "int" } },
            },
          },
        ],
        returnType: { kind: "long" },
      },
      examples: [
        {
          arguments: [
            [
              [1, 2],
              [3, 4],
            ],
          ],
          output: 10,
          explanation: "The four cells sum to 10.",
        },
      ],
      visibleTests: [
        {
          id: "p3-v1",
          arguments: [
            [
              [1, 2],
              [3, 4],
            ],
          ],
          expected: 10,
          category: "example",
        },
      ],
    },
    {
      id: "p4",
      slot: 4,
      title: "All Flags Set",
      generationMetadata: {
        conceptSummary: "Check whether every boolean flag is enabled.",
        skills: ["arrays", "booleans"],
        expectedComplexity: "O(n)",
        patternTags: ["predicate scan"],
      },
      description: "Return true exactly when every value in flags is true.",
      constraints: ["1 ≤ flags.length ≤ 100,000"],
      signature: {
        name: "solution",
        parameters: [
          {
            name: "flags",
            type: { kind: "array", items: { kind: "boolean" } },
          },
        ],
        returnType: { kind: "boolean" },
      },
      examples: [
        {
          arguments: [[true, true, false]],
          output: false,
          explanation: "One flag is not set.",
        },
      ],
      visibleTests: [
        {
          id: "p4-v1",
          arguments: [[true, true, false]],
          expected: false,
          category: "example",
        },
      ],
    },
  ],
};
