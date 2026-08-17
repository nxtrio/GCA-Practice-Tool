import type { RunRequest, RunResult } from "@gca-practice/contracts";

export interface JudgeClient {
  execute(request: RunRequest): Promise<RunResult>;
}

export class JudgeRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "JudgeRequestError";
  }
}

export class ApiJudgeClient implements JudgeClient {
  constructor(private readonly baseUrl = "") {}

  async execute(request: RunRequest): Promise<RunResult> {
    const response = await fetch(
      `${this.baseUrl}/api/execution/${request.mode}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: request.sessionId,
          problemId: request.problemId,
          language: request.language,
          source: request.source,
        }),
      },
    );
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as {
        error?: unknown;
      };
      throw new JudgeRequestError(
        typeof body.error === "string"
          ? body.error
          : `Execution request failed with status ${response.status}.`,
        response.status,
      );
    }
    return (await response.json()) as RunResult;
  }
}
