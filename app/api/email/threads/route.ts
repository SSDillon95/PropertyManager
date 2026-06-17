import { jsonError, jsonOk } from "@/lib/api-helpers";
import { archiveEmailThread, restoreEmailThread } from "@/lib/db";
import type { SmsContactType } from "@/lib/types";

export const dynamic = "force-dynamic";

function parseContactType(value: unknown): SmsContactType | null {
  if (value === "tenant" || value === "investor") return value;
  return null;
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email ?? "").trim();
    const contactType = parseContactType(body.contact_type ?? body.contactType);
    if (!email) return jsonError("Email address is required.", 400);
    if (!contactType) return jsonError("contact_type must be tenant or investor.", 400);

    if (body.archived === true) {
      await archiveEmailThread(email, contactType);
      return jsonOk({ email, contact_type: contactType, archived: true });
    }

    if (body.archived === false) {
      await restoreEmailThread(email, contactType);
      return jsonOk({ email, contact_type: contactType, archived: false });
    }

    return jsonError("archived must be true or false.", 400);
  } catch (error) {
    return jsonError((error as Error).message, 400);
  }
}