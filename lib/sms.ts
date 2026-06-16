import { createSmsMessage } from "./db";
import { normalizePhoneNumber } from "./sms-utils";
import type { SmsMessage, SmsMessageType } from "./types";

export {
  buildMaintenanceMessage,
  buildRentReminderMessage,
  findTenantByName,
  findTenantForProperty,
  findTenantByPhone,
  formatPhoneDisplay,
  groupMessagesByPhone,
  normalizePhoneNumber,
  tenantSmsName as tenantDisplayName,
} from "./sms-utils";

export interface SmsConfig {
  configured: boolean;
  fromNumber: string | null;
}

export function getSmsConfig(): SmsConfig {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const fromNumber = process.env.TWILIO_PHONE_NUMBER?.trim() ?? null;
  return {
    configured: Boolean(accountSid && authToken && fromNumber),
    fromNumber,
  };
}

async function sendViaTwilio(to: string, body: string): Promise<{ sid: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_PHONE_NUMBER?.trim();
  if (!accountSid || !authToken || !from) {
    throw new Error(
      "SMS is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER."
    );
  }

  const params = new URLSearchParams({ To: to, From: from, Body: body });
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    }
  );

  const json = (await response.json()) as { sid?: string; message?: string };
  if (!response.ok) {
    throw new Error(json.message || "Failed to send SMS via Twilio.");
  }
  if (!json.sid) throw new Error("Twilio did not return a message SID.");
  return { sid: json.sid };
}

export interface SendSmsInput {
  phone: string;
  body: string;
  message_type?: SmsMessageType;
  tenant_id?: number | null;
  tenant_name?: string | null;
  property_name?: string | null;
  related_id?: number | null;
  related_type?: "rent_payment" | "maintenance" | null;
}

export async function sendSmsMessage(input: SendSmsInput): Promise<SmsMessage> {
  const phone = normalizePhoneNumber(input.phone);
  if (!phone) throw new Error("A valid phone number is required.");

  const config = getSmsConfig();
  if (!config.configured) {
    return createSmsMessage({
      direction: "outbound",
      tenant_id: input.tenant_id ?? null,
      tenant_name: input.tenant_name ?? null,
      property_name: input.property_name ?? null,
      phone_number: phone,
      body: input.body.trim(),
      message_type: input.message_type ?? "general",
      status: "failed",
      external_id: null,
      related_id: input.related_id ?? null,
      related_type: input.related_type ?? null,
      error_message:
        "SMS is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER.",
    });
  }

  try {
    const result = await sendViaTwilio(phone, input.body.trim());
    return createSmsMessage({
      direction: "outbound",
      tenant_id: input.tenant_id ?? null,
      tenant_name: input.tenant_name ?? null,
      property_name: input.property_name ?? null,
      phone_number: phone,
      body: input.body.trim(),
      message_type: input.message_type ?? "general",
      status: "sent",
      external_id: result.sid,
      related_id: input.related_id ?? null,
      related_type: input.related_type ?? null,
      error_message: null,
    });
  } catch (error) {
    return createSmsMessage({
      direction: "outbound",
      tenant_id: input.tenant_id ?? null,
      tenant_name: input.tenant_name ?? null,
      property_name: input.property_name ?? null,
      phone_number: phone,
      body: input.body.trim(),
      message_type: input.message_type ?? "general",
      status: "failed",
      external_id: null,
      related_id: input.related_id ?? null,
      related_type: input.related_type ?? null,
      error_message: (error as Error).message,
    });
  }
}

export async function recordInboundSms(input: {
  phone: string;
  body: string;
  external_id?: string | null;
  tenant_id?: number | null;
  tenant_name?: string | null;
  property_name?: string | null;
  message_type?: SmsMessageType;
}): Promise<SmsMessage> {
  const phone = normalizePhoneNumber(input.phone) ?? input.phone;
  return createSmsMessage({
    direction: "inbound",
    tenant_id: input.tenant_id ?? null,
    tenant_name: input.tenant_name ?? null,
    property_name: input.property_name ?? null,
    phone_number: phone,
    body: input.body.trim(),
    message_type: input.message_type ?? "general",
    status: "received",
    external_id: input.external_id ?? null,
    related_id: null,
    related_type: null,
    error_message: null,
  });
}