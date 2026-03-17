#!/usr/bin/env node

/**
 * Deploy backend: Railway (mastra) + Supabase Edge Functions
 *
 * Usage:
 *   npm run deploy:backend          # deploy both
 *   npm run deploy:backend railway   # railway only
 *   npm run deploy:backend supabase  # supabase only
 */

import { execSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const target = process.argv[2]; // "railway", "supabase", or undefined (both)

function run(cmd, opts = {}) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd: ROOT, ...opts });
}

function deployRailway() {
  console.log("\n=== Deploying Mastra to Railway ===\n");
  run("railway up", { cwd: join(ROOT, "mastra") });
  console.log("\nRailway deploy triggered.");
}

function deploySupabase() {
  console.log("\n=== Deploying Supabase Edge Functions ===\n");

  // Push any pending migrations first
  run("supabase db push --workdir supabase");

  // Discover and deploy each edge function (skip _shared)
  const functionsDir = join(ROOT, "supabase", "functions");
  const functions = readdirSync(functionsDir).filter((name) => {
    if (name.startsWith("_") || name.startsWith(".")) return false;
    if (name === "deno.json") return false;
    return statSync(join(functionsDir, name)).isDirectory();
  });

  for (const fn of functions) {
    console.log(`\nDeploying function: ${fn}`);
    run(`supabase functions deploy ${fn} --no-verify-jwt`);
  }

  console.log(`\nDeployed ${functions.length} edge functions: ${functions.join(", ")}`);
}

// ---- main ----
try {
  if (!target || target === "railway") deployRailway();
  if (!target || target === "supabase") deploySupabase();
  console.log("\nBackend deploy complete.");
} catch (err) {
  console.error("\nDeploy failed:", err.message);
  process.exit(1);
}
