import { jsonError, jsonOk } from "@/lib/api-helpers";
import { sendSmsMessage } from "@/lib/sms";

export async function POST(request: Request) {
  let body: {
    phone?: string;
    message?: string;
    tenantId?: number;
    tenantName?: string;
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

  if (!phone) return jsonError("phone is required", 400);
  if (!message) return jsonError("message is required", 400);

  try {
    const result = await sendSmsMessage({
      phone,
      body: message,
      tenant_id: body.tenantId ?? null,
      tenant_name: body.tenantName ?? null,
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