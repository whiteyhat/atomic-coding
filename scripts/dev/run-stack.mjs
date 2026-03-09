import process from "node:process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { spawn } from "node:child_process";
import { ROOT_DIR } from "./shared.mjs";

const mode = process.argv[2];

if (process.argv.includes("--help") || !mode) {
  console.log(`Usage: node scripts/dev/run-stack.mjs <hybrid|local>

Runs the long-lived local services for the selected development loop.
`);
  process.exit(mode ? 0 : 1);
}

if (!["hybrid", "local"].includes(mode)) {
  console.error(`Unsupported mode "${mode}". Use "hybrid" or "local".`);
  process.exit(1);
}

const commands = [
  {
    name: "mastra",
    cwd: ROOT_DIR,
    command: "npm",
    args: ["run", "dev", "--prefix", "mastra"],
    color: "\x1b[36m",
  },
  {
    name: "web",
    cwd: ROOT_DIR,
    command: "npm",
    args: ["run", "dev", "--prefix", "web", "--", "--port", "3002"],
    color: "\x1b[35m",
  },
];

if (mode === "local") {
  commands.push({
    name: "functions",
    cwd: ROOT_DIR,
    command: "supabase",
    args: [
      "functions",
      "serve",
      "--workdir",
      "supabase",
      "--env-file",
      "supabase/.env.local",
      "--no-verify-jwt",
    ],
    color: "\x1b[33m",
  });
}

for (const relative of [
  "web/.env.local",
  "mastra/.env.local",
  ...(mode === "local" ? ["supabase/.env.local"] : []),
]) {
  const target = path.join(ROOT_DIR, relative);
  if (!exists(target)) {
    console.error(`Missing ${relative}. Run the matching env generation command first.`);
    process.exit(1);
  }
}

const children = [];
let shuttingDown = false;

for (const spec of commands) {
  children.push(spawnWithPrefix(spec));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

function spawnWithPrefix(spec) {
  const child = spawn(spec.command, spec.args, {
    cwd: spec.cwd,
    env: process.env,
    stdio: ["inherit", "pipe", "pipe"],
    shell: false,
  });

  attachPrefixedStream(child.stdout, spec.name, spec.color);
  attachPrefixedStream(child.stderr, spec.name, spec.color);

  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    const reason = signal ? `signal ${signal}` : `code ${code}`;
    console.error(`[${spec.name}] exited with ${reason}`);
    shutdown();
    process.exit(code ?? 1);
  });

  return child;
}

function attachPrefixedStream(stream, name, color) {
  const rl = readline.createInterface({ input: stream });
  rl.on("line", (line) => {
    process.stdout.write(`${color}[${name}]\x1b[0m ${line}\n`);
  });
}

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }
}

function exists(target) {
  return fs.existsSync(target);
}
