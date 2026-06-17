import { jsonError, jsonOk, parseArchivedParam, parseContactTypeParam } from "@/lib/api-helpers";
import { listEmailMessages } from "@/lib/db";
import { getGmailConfig, syncInboundGmailMessages } from "@/lib/gmail";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const contactType = parseContactTypeParam(request);
  if (!contactType) {
    return jsonError("contact_type query parameter is required.", 400);
  }

  const archived = parseArchivedParam(request);
  const sync = new URL(request.url).searchParams.get("sync") !== "0";

  if (sync) {
    try {
      await syncInboundGmailMessages();
    } catch {
      // Inbound sync is best-effort; still return stored messages.
    }
  }

  const messages = await listEmailMessages({ contact_type: contactType, archived });
  const config = await getGmailConfig();
  return jsonOk({
    messages,
    config: {
      configured: config.configured,
      fromAddress: config.fromAddress,
      source: config.source,
    },
  });
}