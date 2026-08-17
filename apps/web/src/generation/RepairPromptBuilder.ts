export interface RepairIssue {
  path: string;
  message: string;
}

export class RepairPromptBuilder {
  build(errors: RepairIssue[]): string {
    const numbered = errors
      .map((error, index) => `${index + 1}. ${error.path}: ${error.message}`)
      .join("\n");
    return `The assessment JSON you generated failed validation.

Please return the ENTIRE corrected JSON document.

Do not wrap the JSON in Markdown.

Validation errors:

${numbered || "1. The document could not be validated."}

Do not change problem concepts unless required to correct the errors.`;
  }
}
