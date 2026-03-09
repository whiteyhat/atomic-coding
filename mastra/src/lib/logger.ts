import * as Sentry from "@sentry/node";

export type LogLevel = "info" | "warn" | "error" | "debug";

const AXIOM_INGEST_URL = process.env.AXIOM_INGEST_URL;
const AXIOM_TOKEN = process.env.AXIOM_TOKEN;

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
    // Best-effort
  });
}

export function log(
  level: LogLevel,
  message: string,
  data?: Record<string, unknown>,
): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    service: "mastra",
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

export function captureException(err: unknown, context?: Record<string, unknown>): void {
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(err, { extra: context });
  }
  log("error", err instanceof Error ? err.message : String(err), {
    stack: err instanceof Error ? err.stack : undefined,
    ...context,
  });
}
