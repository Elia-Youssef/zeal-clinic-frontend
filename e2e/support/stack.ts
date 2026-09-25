import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/** The server started by the backend's scripts/stack.ps1 (its JSON line plus the folders it was given). */
export type StackState = {
  url: string;
  pid: number;
  port: number;
  version: string;
  demo: boolean;
  dataRoot: string;
  binary: string;
  /** The server's own log file. */
  log: string;
  /** The server's console output. */
  console: string;
  backendDir: string;
  workDir: string;
  binDir: string;
};

export type StopResult = { stopped: boolean; graceful: boolean; method: string; note: string };

type ScriptResult = { code: number; lines: string[] };

// Runs stack.ps1 with PowerShell 7. The child shares this process's console, so the server it starts
// can later be stopped with Ctrl+Break.
function runStackScript(backendDir: string, args: string[], logFile: string, timeoutMs: number): Promise<ScriptResult> {
  const script = path.join(backendDir, "scripts", "stack.ps1");
  const pwsh = process.env.E2E_PWSH || "pwsh";
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  const log = fs.openSync(logFile, "a");
  fs.writeSync(log, `> ${pwsh} -File ${script} ${args.join(" ")}\n`);
  return new Promise((resolve, reject) => {
    const child = spawn(pwsh, ["-NoProfile", "-NonInteractive", "-File", script, ...args], {
      cwd: backendDir,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const lines: string[] = [];
    const partial = { stdout: "", stderr: "" };
    const onData = (stream: "stdout" | "stderr") => (chunk: Buffer) => {
      const text = partial[stream] + chunk.toString("utf8");
      const parts = text.split(/\r?\n/);
      partial[stream] = parts.pop() ?? "";
      for (const line of parts) addLine(line);
    };
    const addLine = (line: string) => {
      lines.push(line);
      fs.writeSync(log, line + "\n");
      console.log(`[stack] ${line}`);
    };
    child.stdout.on("data", onData("stdout"));
    child.stderr.on("data", onData("stderr"));
    const timer = setTimeout(() => {
      addLine(`[e2e] stack.ps1 timed out after ${Math.round(timeoutMs / 1000)} s`);
      child.kill();
    }, timeoutMs);
    child.on("error", (err) => {
      clearTimeout(timer);
      fs.closeSync(log);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      for (const rest of [partial.stdout, partial.stderr]) if (rest) addLine(rest);
      fs.closeSync(log);
      resolve({ code: code ?? 1, lines });
    });
  });
}

function lastJsonLine<T>(lines: string[]): T | null {
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line.startsWith("{")) continue;
    try {
      return JSON.parse(line) as T;
    } catch {
      return null;
    }
  }
  return null;
}

export type StartOptions = {
  backendDir: string;
  port: number;
  demo: boolean;
  distDir: string;
  workDir: string;
  binDir: string;
  dataRoot: string;
  logFile: string;
};

/** Copies the dashboard build in, builds the server, seeds it, starts it and waits for /health. */
export async function startStack(options: StartOptions): Promise<StackState> {
  const args = ["-Start", "-Tags", "default", "-Port", String(options.port), "-DistDir", options.distDir,
    "-WorkDir", options.workDir, "-BinDir", options.binDir, "-DataRoot", options.dataRoot];
  if (options.demo) args.push("-Demo");
  const result = await runStackScript(options.backendDir, args, options.logFile, 15 * 60_000);
  const state = lastJsonLine<Omit<StackState, "backendDir" | "workDir" | "binDir">>(result.lines);
  if (result.code !== 0 || !state || typeof state.pid !== "number") {
    throw new Error(`stack.ps1 -Start failed (exit ${result.code}); log: ${options.logFile}`);
  }
  return { ...state, backendDir: options.backendDir, workDir: options.workDir, binDir: options.binDir };
}

/** Stops the server with Ctrl+Break (a graceful shutdown); stack.ps1 falls back to a hard stop and says so. */
export async function stopStack(state: StackState, logFile: string): Promise<StopResult> {
  const args = ["-Stop", "-Pid", String(state.pid), "-BinDir", state.binDir];
  const result = await runStackScript(state.backendDir, args, logFile, 3 * 60_000);
  const info = lastJsonLine<{ stopped?: boolean; graceful?: boolean | null; method?: string; note?: string }>(result.lines);
  if (!info) return { stopped: false, graceful: false, method: "unknown", note: `stack.ps1 -Stop exit ${result.code}, no result line` };
  return {
    stopped: info.stopped === true,
    graceful: info.graceful === true,
    method: info.method ?? "unknown",
    note: info.note ?? "",
  };
}
