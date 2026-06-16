import { jsonError, jsonOk } from "@/lib/api-helpers";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);
  return jsonOk(session);
}