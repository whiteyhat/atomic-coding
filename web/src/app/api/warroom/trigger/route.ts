import { triggerPipeline, isMastraConfigured } from "@/lib/mastra-client";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const warRoomId: string | undefined = body.war_room_id;

  if (!warRoomId) {
    return new Response(
      JSON.stringify({ error: "war_room_id is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!isMastraConfigured()) {
    return new Response(
      JSON.stringify({ error: "Mastra server not configured" }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  await triggerPipeline(warRoomId);

  return new Response(
    JSON.stringify({ status: "triggered", war_room_id: warRoomId }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
