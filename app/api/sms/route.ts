import { jsonOk } from "@/lib/api-helpers";
import { listSmsMessages } from "@/lib/db";
import { getSmsConfig } from "@/lib/sms";

export async function GET() {
  const messages = await listSmsMessages();
  const config = getSmsConfig();
  return jsonOk({
    messages,
    config: {
      configured: config.configured,
      fromNumber: config.fromNumber,
    },
  });
}