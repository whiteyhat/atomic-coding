import { Mastra } from "@mastra/core";
import { jarvis, forge, pixel, checker } from "./agents/index.js";
import { supabaseTools } from "./tools/supabase.js";

export const mastra = new Mastra({
  agents: { jarvis, forge, pixel, checker },
  tools: supabaseTools,
  server: {
    port: parseInt(process.env.PORT || "4500"),
    host: "0.0.0.0",
    cors: {
      origin: "*",
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
    },
  },
});
