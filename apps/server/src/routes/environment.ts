import type { Express } from "express";
import type { DetectedToolchains } from "@gca-practice/runner-core";

export interface EnvironmentRouteDependencies {
  toolchains?: DetectedToolchains;
}

export function registerEnvironmentRoute(
  app: Express,
  dependencies: EnvironmentRouteDependencies,
): void {
  app.get("/api/environment", (_request, response) => {
    if (!dependencies.toolchains) {
      response.status(503).json({ error: "Toolchain diagnostics are unavailable." });
      return;
    }
    response.json(dependencies.toolchains);
  });
}
