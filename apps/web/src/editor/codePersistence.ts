import type { Language } from "@gca-practice/contracts";
import type {
  ImportWorkflowClient,
  SessionCodeView,
} from "../api/importClient.js";

export interface CodeLocation {
  sessionId: string;
  problemId: string;
  language: Language;
}

export interface CodePersistence {
  load(location: CodeLocation): string | undefined;
  save(location: CodeLocation, source: string): void;
}

export function codeStorageKey(location: CodeLocation): string {
  return [
    "gca-practice",
    "code",
    location.sessionId,
    location.problemId,
    location.language,
  ].join(":");
}

export class BrowserCodePersistence implements CodePersistence {
  load(location: CodeLocation): string | undefined {
    try {
      return window.localStorage.getItem(codeStorageKey(location)) ?? undefined;
    } catch {
      return undefined;
    }
  }

  save(location: CodeLocation, source: string): void {
    try {
      window.localStorage.setItem(codeStorageKey(location), source);
    } catch {
      // The in-memory workspace remains usable when browser storage is blocked.
    }
  }
}

export class MemoryCodePersistence implements CodePersistence {
  private readonly values = new Map<string, string>();

  load(location: CodeLocation): string | undefined {
    return this.values.get(codeStorageKey(location));
  }

  save(location: CodeLocation, source: string): void {
    this.values.set(codeStorageKey(location), source);
  }
}

/** Uses local storage immediately and mirrors debounced saves to the session API. */
export class ApiBackedCodePersistence implements CodePersistence {
  private readonly restored = new Map<string, string>();
  private readonly pending = new Set<Promise<void>>();

  constructor(
    private readonly client: ImportWorkflowClient,
    initialCode: SessionCodeView[],
    private readonly local: CodePersistence = new BrowserCodePersistence(),
  ) {
    for (const code of initialCode) {
      this.restored.set(codeStorageKey(code), code.source);
    }
  }

  load(location: CodeLocation): string | undefined {
    return this.restored.get(codeStorageKey(location)) ?? this.local.load(location);
  }

  save(location: CodeLocation, source: string): void {
    this.restored.set(codeStorageKey(location), source);
    this.local.save(location, source);
    const request = this.client.saveCode({ ...location, source });
    this.pending.add(request);
    void request
      .catch(() => {
        // Local persistence remains the fallback while the API is unavailable.
      })
      .finally(() => this.pending.delete(request));
  }

  async flush(): Promise<void> {
    await Promise.allSettled([...this.pending]);
  }
}
