export const DEV_AUTH_BYPASS_USER_ID =
  Deno.env.get("DEV_AUTH_BYPASS_USER_ID") ?? "did:dev:local-user";
export const DEV_AUTH_BYPASS_TOKEN =
  Deno.env.get("DEV_AUTH_BYPASS_TOKEN") ?? "dev-bypass";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export function isLocalDevHost(hostname?: string | null): boolean {
  if (!hostname) return false;
  const normalized = hostname.replace(/^\[(.*)\]$/, "$1").split(":")[0];
  return LOCAL_HOSTS.has(normalized);
}

function getHostname(value?: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}

export function isDevAuthBypassEnabled(req: Request): boolean {
  const requestHostname = new URL(req.url).hostname;
  const originHostname = getHostname(req.headers.get("origin"));
  const refererHostname = getHostname(req.headers.get("referer"));

  return (
    Deno.env.get("DEV_AUTH_BYPASS") === "true" &&
    (
      isLocalDevHost(requestHostname) ||
      isLocalDevHost(originHostname) ||
      isLocalDevHost(refererHostname)
    )
  );
}

export function getDevAuthUser() {
  return {
    userId: DEV_AUTH_BYPASS_USER_ID,
  };
}
