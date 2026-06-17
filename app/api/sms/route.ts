import { jsonError, jsonOk, parseArchivedParam, parseContactTypeParam } from "@/lib/api-helpers";
import { listSmsMessages } from "@/lib/db";
import { getSmsConfig } from "@/lib/sms";

export async function GET(request: Request) {
  const contactType = parseContactTypeParam(request);
  if (!contactType) {
    return jsonError("contact_type query parameter is required.", 400);
  }

  const archived = parseArchivedParam(request);
  const messages = await listSmsMessages({ contact_type: contactType, archived });
  const config = await getSmsConfig();
  return jsonOk({
    messages,
    config: {
      configured: config.configured,
      fromNumber: config.fromNumber,
      source: config.source,
    },
  });
}