#!/usr/bin/env node
/**
 * Full deployment script:
 *   1. Supabase edge functions (all 5)
 *   2. Mastra backend (build + vercel --prod)
 *   3. Web frontend (vercel --prod)
 */

import { execSync, spawn } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SUPABASE_PROJECT_REF = "wgujqteirximgettseux";
const EDGE_FUNCTIONS = ["api", "mcp-server", "rebuild-bundle", "buu-mcp", "warroom-orchestrator"];

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

function log(label, msg, color = "") {
  const time = new Date().toLocaleTimeString("en-US", { hour12: false });
  console.log(`${color}${BOLD}[${time}] [${label}]${RESET}${color} ${msg}${RESET}`);
}

function run(cmd, opts = {}) {
  log(opts.label ?? "run", `$ ${cmd}`, YELLOW);
  execSync(cmd, { stdio: "inherit", cwd: opts.cwd ?? ROOT, ...opts });
}

async function runParallel(tasks) {
  await Promise.all(
    tasks.map(
      ({ label, cmd, cwd }) =>
        new Promise((resolve, reject) => {
          log(label, `$ ${cmd}`, YELLOW);
          const [bin, ...args] = cmd.split(" ");
          const proc = spawn(bin, args, {
            cwd: cwd ?? ROOT,
            stdio: "inherit",
            shell: true,
          });
          proc.on("close", (code) => {
            if (code === 0) resolve();
            else reject(new Error(`${label} exited with code ${code}`));
          });
        })
    )
  );
}

async function main() {
  console.log(`\n${BOLD}========================================${RESET}`);
  console.log(`${BOLD}  Atomic Coding — Full Deployment${RESET}`);
  console.log(`${BOLD}========================================${RESET}\n`);

  // ── 1. Supabase edge functions ──────────────────────────────────────────
  log("supabase", "Deploying edge functions…", GREEN);
  run(
    `supabase functions deploy ${EDGE_FUNCTIONS.join(" ")} --project-ref ${SUPABASE_PROJECT_REF}`,
    { label: "supabase" }
  );
  log("supabase", "✓ Edge functions deployed", GREEN);

  // ── 2. Mastra build ─────────────────────────────────────────────────────
  log("mastra", "Building…", GREEN);
  run("npm run build", { label: "mastra", cwd: resolve(ROOT, "mastra") });
  log("mastra", "✓ Build complete", GREEN);

  // ── 3. Deploy Mastra + Web in parallel ──────────────────────────────────
  log("deploy", "Deploying Mastra backend and Web frontend in parallel…", GREEN);
  await runParallel([
    {
      label: "mastra",
      cmd: "vercel --prod --yes",
      cwd: resolve(ROOT, "mastra"),
    },
    {
      label: "web",
      cmd: "vercel --prod --yes",
      cwd: ROOT,
    },
  ]);

  console.log(`\n${GREEN}${BOLD}========================================${RESET}`);
  console.log(`${GREEN}${BOLD}  All deployments complete!${RESET}`);
  console.log(`${GREEN}${BOLD}  Frontend : https://www.atomic.fun${RESET}`);
  console.log(`${GREEN}${BOLD}  Backend  : https://mastra-swart.vercel.app${RESET}`);
  console.log(`${GREEN}${BOLD}  Supabase : https://supabase.com/dashboard/project/${SUPABASE_PROJECT_REF}/functions${RESET}`);
  console.log(`${GREEN}${BOLD}========================================${RESET}\n`);
}

main().catch((err) => {
  console.error(`\n${RED}${BOLD}Deployment failed:${RESET}${RED} ${err.message}${RESET}\n`);
  process.exit(1);
});
