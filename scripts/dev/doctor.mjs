import process from "node:process";
import {
  commandExists,
  loadRootDevConfig,
  portStatus,
  printSection,
  requireValues,
} from "./shared.mjs";

if (process.argv.includes("--help")) {
  console.log(`Usage: npm run dev:doctor

Checks local prerequisites for the hybrid and parity development loops.
`);
  process.exit(0);
}

let hasFailure = false;

function fail(message) {
  hasFailure = true;
  console.error(`FAIL ${message}`);
}

function ok(message) {
  console.log(`OK   ${message}`);
}

function warn(message) {
  console.log(`WARN ${message}`);
}

printSection("Tools");

ok(`Node ${process.version}`);

for (const command of [
  ["npm", ["--version"]],
  ["supabase", ["--version"]],
  ["railway", ["--version"]],
]) {
  if (commandExists(command[0], command[1])) {
    ok(`${command[0]} is available`);
  } else {
    fail(`${command[0]} is not installed or not on PATH`);
  }
}

if (commandExists("docker", ["--version"])) {
  ok("Docker is available for parity mode");
} else {
  warn("Docker is not available; hybrid mode still works, parity mode will not");
}

printSection("Environment");

try {
  const config = loadRootDevConfig();
  ok(`Loaded ${config.path}`);
  requireValues(config.values, [
    "DEV_SUPABASE_URL",
    "DEV_SUPABASE_ANON_KEY",
    "DEV_SUPABASE_SERVICE_ROLE_KEY",
    "OPENROUTER_API_KEY",
  ]);
  ok("Hybrid-mode required values are present");

  if (config.values.BUU_API_KEY) {
    ok("BUU_API_KEY is configured");
  } else {
    warn("BUU_API_KEY is missing; local MCP fallback will have limited asset-generation coverage");
  }

  if (config.values.NEXT_PUBLIC_PRIVY_APP_ID && config.values.PRIVY_APP_SECRET) {
    ok("Privy dev credentials are configured");
  } else {
    warn("Privy dev credentials are not configured; local auth bypass will be required");
  }
} catch (error) {
  fail(error.message);
}

printSection("Ports");

for (const port of [3002, 4500, 54321, 54322, 54323]) {
  const status = await portStatus(port);
  if (status === "free") {
    ok(`Port ${port} is free`);
  } else if (status === "busy") {
    warn(`Port ${port} is already in use`);
  } else {
    warn(`Port ${port} could not be probed cleanly`);
  }
}

printSection("Next Steps");
console.log("Hybrid loop: npm run dev:env:hybrid && npm run dev:hybrid");
console.log(
  "Parity loop: npm run dev:supabase:start && npm run dev:supabase:reset && npm run dev:env:local && npm run dev:local"
);

process.exit(hasFailure ? 1 : 0);
