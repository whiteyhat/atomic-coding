import { verifyAuthToken } from "@/lib/auth";
import { MASTRA_SERVER_URL } from "@/lib/constants";
import {
  buildWarRoomPreflightInstructions,
  buildWarRoomPreflightMessage,
  getFallbackWarRoomPreflightResult,
  hasWarRoomStyleSignals,
  parseWarRoomPreflightResult,
} from "@/lib/war-room-preflight";
import type { AssetModel } from "@/lib/types";

export async function POST(req: Request) {
  if (!(await verifyAuthToken(req))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await req.json().catch(() => ({}));
  const idea =
    typeof body.idea === "string" ? body.idea.trim() : "";
  const gameName =
    typeof body.gameName === "string" ? body.gameName.trim() : "";
  const gameFormat =
    body.gameFormat === "2d" || body.gameFormat === "3d" ? body.gameFormat : null;
  const genre =
    typeof body.genre === "string" ? body.genre : body.genre === null ? null : null;
  const assets = Array.isArray(body.assets)
    ? (body.assets as AssetModel[])
    : [];

  if (!idea) {
    return new Response(JSON.stringify({ error: "idea is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!MASTRA_SERVER_URL) {
    return Response.json(getFallbackWarRoomPreflightResult({ assets, gameFormat, idea }));
  }

  try {
    const forceArtDirectionQuestion = !hasWarRoomStyleSignals({ assets, idea });
    const response = await fetch(`${MASTRA_SERVER_URL}/chat/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        agent: "jarvis",
        instructions: buildWarRoomPreflightInstructions({
          forceArtDirectionQuestion,
          gameFormat,
          genre,
        }),
        messages: [
          {
            role: "user",
            content: buildWarRoomPreflightMessage({
              idea,
              gameName,
              gameFormat,
              genre,
              assets,
            }),
          },
        ],
      }),
    });

    if (!response.ok) {
      console.warn("[warroom-preflight] Mastra preflight failed", {
        status: response.status,
      });
      return Response.json(getFallbackWarRoomPreflightResult({ assets, gameFormat, idea }));
    }

    const payload = (await response.json().catch(() => ({}))) as { text?: string };
    const result = parseWarRoomPreflightResult(payload.text ?? "", {
      assets,
      gameFormat,
      idea,
    });
    return Response.json(result);
  } catch (error) {
    console.warn("[warroom-preflight] Falling back after fetch error", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return Response.json(getFallbackWarRoomPreflightResult({ assets, gameFormat, idea }));
  }
}
