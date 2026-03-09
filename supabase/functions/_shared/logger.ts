export type LogLevel = "info" | "warn" | "error" | "debug";

const AXIOM_INGEST_URL = Deno.env.get("AXIOM_INGEST_URL");
const AXIOM_TOKEN = Deno.env.get("AXIOM_TOKEN");

/** Fire-and-forget log shipping to Axiom (if configured) */
function shipToAxiom(entry: Record<string, unknown>): void {
  if (!AXIOM_INGEST_URL || !AXIOM_TOKEN) return;
  fetch(AXIOM_INGEST_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AXIOM_TOKEN}`,
    },
    body: JSON.stringify([entry]),
  }).catch(() => {
    // Best-effort — do not block on log shipping failures
  });
}

export function log(
  level: LogLevel,
  message: string,
  data?: Record<string, unknown>,
) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(data && Object.keys(data).length > 0 ? { data } : {}),
  };
  const line = JSON.stringify(entry);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
  shipToAxiom(entry);
}

/** Wrap an async function with timing and error logging */
export function withLog<T>(
  label: string,
  params: Record<string, unknown>,
  fn: () => Promise<T>,
): Promise<T> {
  const start = performance.now();
  log("info", `${label} started`, params);
  return fn()
    .then((result) => {
      const durationMs = Math.round(performance.now() - start);
      log("info", `${label} completed`, { durationMs });
      return result;
    })
    .catch((err) => {
      const durationMs = Math.round(performance.now() - start);
      log("error", `${label} threw`, {
        durationMs,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      throw err;
    });
}
