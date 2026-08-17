import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor/editor/editor.api.js";
import "monaco-editor/languages/definitions/cpp/register.js";
import "monaco-editor/languages/definitions/java/register.js";
import "monaco-editor/languages/definitions/python/register.js";

interface MonacoWorkerEnvironment {
  getWorker(): Worker;
}

export function configureLocalMonaco(): void {
  loader.config({ monaco });
  (
    globalThis as typeof globalThis & {
      MonacoEnvironment?: MonacoWorkerEnvironment;
    }
  ).MonacoEnvironment = {
    getWorker: () =>
      new Worker(
        new URL(
          "monaco-editor/editor/editor.worker.js",
          import.meta.url,
        ),
        { type: "module" },
      ),
  };
}
