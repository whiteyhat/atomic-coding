import "server-only";

export const DEV_AUTH_BYPASS_USER_ID =
  process.env.DEV_AUTH_BYPASS_USER_ID ?? "did:dev:local-user";
export const DEV_AUTH_BYPASS_TOKEN =
  process.env.DEV_AUTH_BYPASS_TOKEN ?? "dev-bypass";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function isLocalDevHost(hostname?: string | null): boolean {
  if (!hostname) return false;
  const normalized = hostname.replace(/^\[(.*)\]$/, "$1").split(":")[0];
  return LOCAL_HOSTS.has(normalized);
}

export function isDevAuthBypassEnabled(hostname?: string | null): boolean {
  return (
    process.env.DEV_AUTH_BYPASS === "true" &&
    process.env.NODE_ENV !== "production" &&
    isLocalDevHost(hostname)
  );
}

export function getDevAuthUser() {
  return {
    userId: DEV_AUTH_BYPASS_USER_ID,
    email: "dev@local.test",
  };
}
