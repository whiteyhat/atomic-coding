import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import * as Sentry from "@sentry/node";

for (const envFile of [".env.local", ".env"]) {
  const envPath = path.join(process.cwd(), envFile);
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false });
  }
}

// Initialize Sentry before anything else
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0.1,
  });
}

import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { MastraServer } from "@mastra/hono";
import type { HonoBindings, HonoVariables } from "@mastra/hono";
import { mastra } from "./mastra.js";
import { pipelineRoutes } from "./routes/pipeline.js";
import { chatRoutes } from "./routes/chat.js";

const app = new Hono<{ Bindings: HonoBindings; Variables: HonoVariables }>();

const server = new MastraServer({ app, mastra,  });

await server.init();

// Custom routes (added after init so they have Mastra context)
app.route("/pipeline", pipelineRoutes);
app.route("/chat", chatRoutes);

// Health check
app.get("/health", (c) => c.json({ status: "ok", agents: ["jarvis", "forge", "pixel", "checker"] }));

const port = parseInt(process.env.PORT || "4500");

serve({ fetch: app.fetch, port }, () => {
  console.log(`Mastra server running on http://0.0.0.0:${port}`);
  console.log(`Agents: jarvis, forge, pixel, checker`);
  console.log(`Routes: /pipeline/run, /chat/stream, /health`);
});
