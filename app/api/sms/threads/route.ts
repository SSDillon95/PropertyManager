import { jsonError, jsonOk } from "@/lib/api-helpers";
import { archiveSmsThread, restoreSmsThread } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const phone = String(body.phone ?? "").trim();
    if (!phone) return jsonError("Phone number is required.", 400);

    if (body.archived === true) {
      await archiveSmsThread(phone);
      return jsonOk({ phone, archived: true });
    }

    if (body.archived === false) {
      await restoreSmsThread(phone);
      return jsonOk({ phone, archived: false });
    }

    return jsonError("archived must be true or false.", 400);
  } catch (error) {
    return jsonError((error as Error).message, 400);
  }
}