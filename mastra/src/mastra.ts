import { Mastra } from "@mastra/core";
import { jarvis, forge, pixel, checker } from "./agents/index.js";
import { supabaseTools } from "./tools/supabase.js";
import { buuTools } from "./tools/buu.js";

export const mastra = new Mastra({
  agents: { jarvis, forge, pixel, checker },
  tools: { ...supabaseTools, ...buuTools },
  server: {
    port: parseInt(process.env.PORT || "4500"),
    host: "0.0.0.0",
    cors: {
      origin: (process.env.ALLOWED_ORIGINS || "*").split(",").map((o: string) => o.trim()),
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
    },
  },
});
