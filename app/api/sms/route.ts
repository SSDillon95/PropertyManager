import { jsonOk, parseArchivedParam } from "@/lib/api-helpers";
import { listSmsMessages } from "@/lib/db";
import { getSmsConfig } from "@/lib/sms";

export async function GET(request: Request) {
  const archived = parseArchivedParam(request);
  const messages = await listSmsMessages({ archived });
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