import { jsonError, jsonOk } from "@/lib/api-helpers";
import { sendSmsMessage } from "@/lib/sms";
import type { SmsContactType } from "@/lib/types";

function parseContactType(value: unknown): SmsContactType | null {
  if (value === "tenant" || value === "investor") return value;
  return null;
}

export async function POST(request: Request) {
  let body: {
    phone?: string;
    message?: string;
    contactType?: string;
    contact_type?: string;
    tenantId?: number;
    tenantName?: string;
    investorId?: number;
    investorName?: string;
    propertyName?: string;
    messageType?: "general" | "rent_reminder" | "maintenance";
    relatedId?: number;
    relatedType?: "rent_payment" | "maintenance";
  };

  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const phone = body.phone?.trim();
  const message = body.message?.trim();
  const contactType = parseContactType(body.contact_type ?? body.contactType);

  if (!phone) return jsonError("phone is required", 400);
  if (!message) return jsonError("message is required", 400);
  if (!contactType) return jsonError("contact_type must be tenant or investor", 400);

  try {
    const result = await sendSmsMessage({
      phone,
      body: message,
      contact_type: contactType,
      tenant_id: body.tenantId ?? null,
      tenant_name: body.tenantName ?? null,
      investor_id: body.investorId ?? null,
      investor_name: body.investorName ?? null,
      property_name: body.propertyName ?? null,
      message_type: body.messageType ?? "general",
      related_id: body.relatedId ?? null,
      related_type: body.relatedType ?? null,
    });

    if (result.status === "failed") {
      return jsonError(result.error_message ?? "Failed to send message", 500);
    }

    return jsonOk({ message: result });
  } catch (error) {
    return jsonError((error as Error).message, 400);
  }
}