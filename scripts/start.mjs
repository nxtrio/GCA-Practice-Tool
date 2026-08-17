import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { spawn, spawnSync } from "node:child_process";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const webPort = readPort("GCA_WEB_PORT", 5173);
const apiPort = readPort("GCA_API_PORT", 3001);
const appUrl = `http://localhost:${webPort}`;
const apiUrl = `http://127.0.0.1:${apiPort}/api/environment`;
const noOpen = process.argv.includes("--no-open") || process.env.CI === "true";
const childEnvironment = {
  ...process.env,
  GCA_WEB_PORT: String(webPort),
  GCA_API_PORT: String(apiPort),
};
const children = new Set();
let stopping = false;

if (!existsSync(join(root, "node_modules"))) {
  console.log("First run: installing dependencies…");
  const install = spawnSync(npm, ["install"], { cwd: root, stdio: "inherit" });
  if (install.status !== 0) process.exit(install.status ?? 1);
}

function run(script) {
  const child = spawn(npm, ["run", script], {
    cwd: root,
    env: childEnvironment,
    stdio: "inherit",
  });
  children.add(child);
  child.once("exit", (code) => {
    children.delete(child);
    if (!stopping) {
      console.error(`${script} stopped unexpectedly.`);
      stop(code ?? 1);
    }
  });
}

function terminate(child, signal = "SIGTERM") {
  if (!child.pid) return;
  try {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
      });
    } else {
      child.kill(signal);
    }
  } catch {
    // The child already exited.
  }
}

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  const running = [...children];
  for (const child of running) terminate(child);
  setTimeout(() => {
    if (process.platform !== "win32") {
      for (const child of running) terminate(child, "SIGKILL");
    }
    process.exit(code);
  }, 750);
}

function openBrowser() {
  if (noOpen) return;
  const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", appUrl] : [appUrl];
  const opener = spawn(command, args, { detached: true, stdio: "ignore" });
  opener.once("error", () => {
    console.log(`Open ${appUrl} in your browser.`);
  });
  opener.unref();
}

async function announceWhenReady() {
  for (let attempt = 0; attempt < 60 && !stopping; attempt += 1) {
    try {
      const [web, api] = await Promise.all([
        fetch(appUrl),
        fetch(apiUrl),
      ]);
      if (web.ok && api.ok) {
        console.log(`\nGCA Practice is ready at ${appUrl}`);
        console.log("Press Ctrl+C to stop.\n");
        openBrowser();
        return;
      }
    } catch {
      // Vite is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!stopping) {
    console.error(`GCA Practice did not become ready at ${appUrl}.`);
    stop(1);
  }
}

function readPort(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1 || value > 65_535) {
    console.error(`${name} must be an integer between 1 and 65535.`);
    process.exit(1);
  }
  return value;
}

process.once("SIGINT", () => stop(0));
process.once("SIGTERM", () => stop(0));
process.once("uncaughtException", (error) => {
  console.error(error);
  stop(1);
});

run("serve:server");
run("dev:web");
void announceWhenReady();
