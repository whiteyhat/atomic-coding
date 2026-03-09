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

/**
 * Publish a JSON message to a URL via QStash with automatic retries.
 * Falls back to direct fetch if QStash is not configured.
 */
export async function publishWithRetry(
  url: string,
  body: Record<string, unknown>,
  options?: { retries?: number },
): Promise<void> {
  const client = getQStash();

  if (client) {
    try {
      await client.publishJSON({
        url,
        body,
        retries: options?.retries ?? 3,
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
  }

  // Fallback: fire-and-forget direct fetch
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
    .then((res) => log("info", "direct:fetch:response", { url, status: res.status }))
    .catch((err) => log("error", "direct:fetch:failed", { url, error: (err as Error).message }));
}
