import { Client } from "npm:@upstash/qstash@^2.7.17";
import { log } from "./logger.ts";

let qstashClient: Client | null = null;

function getQStash(): Client | null {
  if (qstashClient) return qstashClient;

  const token = Deno.env.get("QSTASH_TOKEN");
  if (!token) return null;

  qstashClient = new Client({ token });
  return qstashClient;
}

/** Check if a URL points to a local/private address that QStash can't reach. */
function isLocalUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return ["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(hostname);
  } catch {
    return false;
  }
}

/**
 * Publish a JSON message to a URL via QStash with automatic retries.
 * Falls back to direct fetch if QStash is not configured or the URL is local.
 */
export async function publishWithRetry(
  url: string,
  body: Record<string, unknown>,
  options?: { retries?: number; headers?: Record<string, string> },
): Promise<void> {
  const client = getQStash();
  const extraHeaders = options?.headers || {};

  // QStash is a cloud service — it can't deliver to localhost/private IPs.
  // Skip QStash for local URLs and use direct fetch instead.
  if (client && !isLocalUrl(url)) {
    try {
      await client.publishJSON({
        url,
        body,
        retries: options?.retries ?? 3,
        headers: extraHeaders,
      });
      log("info", "qstash:published", { url, body });
      return;
    } catch (err) {
      log("error", "qstash:publish:failed", {
        url,
        error: (err as Error).message,
      });
      // Fall through to direct fetch
    }
  } else if (isLocalUrl(url)) {
    log("info", "qstash:skipped:local-url", { url });
  }

  // Direct fetch (awaited so caller knows if it fails)
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...extraHeaders },
    body: JSON.stringify(body),
  });
  log("info", "direct:fetch:response", { url, status: res.status });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Direct fetch to ${url} failed with status ${res.status}: ${text}`);
  }
}
