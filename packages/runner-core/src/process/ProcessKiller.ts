import { spawn, type ChildProcess } from "node:child_process";

export class ProcessKiller {
  constructor(
    private readonly child: ChildProcess,
    private readonly platform: NodeJS.Platform = process.platform,
  ) {}

  terminate(): boolean {
    return this.kill("SIGTERM");
  }

  forceKill(): boolean {
    if (this.platform === "win32") {
      return this.forceKillWindowsTree();
    }
    return this.kill("SIGKILL");
  }

  private kill(signal: NodeJS.Signals): boolean {
    if (!this.isRunning() || this.child.pid === undefined) {
      return false;
    }

    if (this.platform !== "win32") {
      try {
        process.kill(-this.child.pid, signal);
        return true;
      } catch {
        try {
          return this.child.kill(signal);
        } catch {
          return false;
        }
      }
    }

    try {
      return this.child.kill(signal);
    } catch {
      return false;
    }
  }

  private forceKillWindowsTree(): boolean {
    if (!this.isRunning() || this.child.pid === undefined) {
      return false;
    }

    try {
      const taskkill = spawn(
        "taskkill",
        ["/pid", String(this.child.pid), "/t", "/f"],
        {
          shell: false,
          stdio: "ignore",
          windowsHide: true,
        },
      );
      taskkill.once("error", () => {
        try {
          this.child.kill("SIGKILL");
        } catch {
          // The target may already have exited.
        }
      });
      taskkill.unref();
      return true;
    } catch {
      return this.child.kill("SIGKILL");
    }
  }

  private isRunning(): boolean {
    return this.child.exitCode === null && this.child.signalCode === null;
  }
}
