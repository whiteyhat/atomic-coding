import process from "node:process";
import {
  LOCAL_BYPASS_TOKEN,
  LOCAL_BYPASS_USER_ID,
  loadRootDevConfig,
  parseSupabaseEnvOutput,
  pickFirst,
  requireValues,
  runCommand,
  writeEnvFile,
} from "./shared.mjs";

const mode = process.argv[2];

if (process.argv.includes("--help") || !mode) {
  console.log(`Usage: node scripts/dev/generate-env.mjs <hybrid|local>

Generates:
- web/.env.local
- mastra/.env.local
- supabase/.env.local
`);
  process.exit(mode ? 0 : 1);
}

if (!["hybrid", "local"].includes(mode)) {
  console.error(`Unsupported mode "${mode}". Use "hybrid" or "local".`);
  process.exit(1);
}

const config = loadRootDevConfig();
const base = config.values;
const defaults = {
  MASTRA_SERVER_URL: base.MASTRA_SERVER_URL || "http://127.0.0.1:4500",
  DEV_AUTH_BYPASS: base.DEV_AUTH_BYPASS || "true",
  DEV_AUTH_BYPASS_USER_ID: base.DEV_AUTH_BYPASS_USER_ID || LOCAL_BYPASS_USER_ID,
  DEV_AUTH_BYPASS_TOKEN: base.DEV_AUTH_BYPASS_TOKEN || LOCAL_BYPASS_TOKEN,
  PORT: base.PORT || "4500",
};

requireValues(base, ["OPENROUTER_API_KEY"]);

const supabaseValues =
  mode === "hybrid" ? getHybridSupabaseValues(base) : getLocalSupabaseValues();

writeEnvFile(
  "web/.env.local",
  buildWebEnv(base, defaults, supabaseValues)
);
writeEnvFile(
  "mastra/.env.local",
  buildMastraEnv(base, defaults, supabaseValues)
);
writeEnvFile(
  "supabase/.env.local",
  buildSupabaseEnv(base, defaults, supabaseValues)
);

console.log(`Generated local env files for ${mode} mode using ${config.path}`);

/** Replace localhost/127.0.0.1 with host.docker.internal for Docker networking. */
function dockerizeUrl(url) {
  return url.replace(/127\.0\.0\.1|localhost/, "host.docker.internal");
}

function getHybridSupabaseValues(values) {
  requireValues(values, [
    "DEV_SUPABASE_URL",
    "DEV_SUPABASE_ANON_KEY",
    "DEV_SUPABASE_SERVICE_ROLE_KEY",
  ]);

  return {
    url: values.DEV_SUPABASE_URL,
    anonKey: values.DEV_SUPABASE_ANON_KEY,
    serviceRoleKey: values.DEV_SUPABASE_SERVICE_ROLE_KEY,
  };
}

function getLocalSupabaseValues() {
  const result = runCommand("supabase", ["status", "-o", "env", "--workdir", "supabase"]);
  if (result.status !== 0) {
    throw new Error(
      `Failed to read local Supabase status. Start the stack first with "npm run dev:supabase:start".\n${result.stderr || result.stdout}`
    );
  }

  const env = parseSupabaseEnvOutput(result.stdout);
  const url = pickFirst(env, ["API_URL", "SUPABASE_URL"]);
  const anonKey = pickFirst(env, ["ANON_KEY", "SUPABASE_ANON_KEY"]);
  const serviceRoleKey = pickFirst(env, ["SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY"]);

  if (!url || !anonKey || !serviceRoleKey) {
    const available = Object.keys(env).sort().join(", ");
    throw new Error(
      `Could not resolve local Supabase URL/keys from "supabase status -o env". Available keys: ${available}`
    );
  }

  return { url, anonKey, serviceRoleKey };
}

function buildWebEnv(base, defaults, supabase) {
  return {
    NEXT_PUBLIC_SUPABASE_URL: supabase.url,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: supabase.anonKey,
    SUPABASE_URL: supabase.url,
    SUPABASE_SERVICE_ROLE_KEY: supabase.serviceRoleKey,
    OPENROUTER_API_KEY: base.OPENROUTER_API_KEY,
    BUU_API_KEY: base.BUU_API_KEY,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: base.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    CLERK_SECRET_KEY: base.CLERK_SECRET_KEY,
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: base.NEXT_PUBLIC_CLERK_SIGN_IN_URL,
    NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: base.NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL,
    CLERK_JWKS_URL: base.CLERK_JWKS_URL,
    MASTRA_SERVER_URL: defaults.MASTRA_SERVER_URL,
    DEV_AUTH_BYPASS: defaults.DEV_AUTH_BYPASS,
    NEXT_PUBLIC_DEV_AUTH_BYPASS: defaults.DEV_AUTH_BYPASS,
    DEV_AUTH_BYPASS_USER_ID: defaults.DEV_AUTH_BYPASS_USER_ID,
    NEXT_PUBLIC_DEV_AUTH_BYPASS_USER_ID: defaults.DEV_AUTH_BYPASS_USER_ID,
    DEV_AUTH_BYPASS_TOKEN: defaults.DEV_AUTH_BYPASS_TOKEN,
    NEXT_PUBLIC_DEV_AUTH_BYPASS_TOKEN: defaults.DEV_AUTH_BYPASS_TOKEN,
  };
}

function buildMastraEnv(base, defaults, supabase) {
  return {
    SUPABASE_URL: supabase.url,
    SUPABASE_ANON_KEY: supabase.anonKey,
    SUPABASE_SERVICE_ROLE_KEY: supabase.serviceRoleKey,
    OPENROUTER_API_KEY: base.OPENROUTER_API_KEY,
    FAL_API_KEY: base.FAL_API_KEY,
    PORT: defaults.PORT,
  };
}

function buildSupabaseEnv(base, defaults, supabase) {
  return {
    SUPABASE_URL: supabase.url,
    SUPABASE_ANON_KEY: supabase.anonKey,
    SUPABASE_SERVICE_ROLE_KEY: supabase.serviceRoleKey,
    OPENROUTER_API_KEY: base.OPENROUTER_API_KEY,
    SUPABASE_ACCESS_TOKEN: base.SUPABASE_ACCESS_TOKEN,
    CLERK_JWKS_URL: base.CLERK_JWKS_URL,
    MASTRA_SERVER_URL: mode === "local" ? dockerizeUrl(defaults.MASTRA_SERVER_URL) : defaults.MASTRA_SERVER_URL,
    DEV_AUTH_BYPASS: defaults.DEV_AUTH_BYPASS,
    DEV_AUTH_BYPASS_USER_ID: defaults.DEV_AUTH_BYPASS_USER_ID,
    DEV_AUTH_BYPASS_TOKEN: defaults.DEV_AUTH_BYPASS_TOKEN,
  };
}
