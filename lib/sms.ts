import { createSmsMessage, getSmsSettings } from "./db";
import { credentialsFromSettings } from "./sms-setup";
import { normalizePhoneNumber } from "./sms-utils";
import type { SmsConfigSource, SmsMessage, SmsMessageType } from "./types";

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
  source: SmsConfigSource;
}

export async function resolveSmsCredentials(): Promise<{
  accountSid: string | null;
  authToken: string | null;
  fromNumber: string | null;
  source: SmsConfigSource;
}> {
  const settings = await getSmsSettings();
  return credentialsFromSettings(settings);
}

export async function getSmsConfig(): Promise<SmsConfig> {
  const credentials = await resolveSmsCredentials();
  return {
    configured: Boolean(
      credentials.accountSid && credentials.authToken && credentials.fromNumber
    ),
    fromNumber: credentials.fromNumber,
    source: credentials.source,
  };
}

async function sendViaTwilio(to: string, body: string): Promise<{ sid: string }> {
  const { accountSid, authToken, fromNumber: from } = await resolveSmsCredentials();
  if (!accountSid || !authToken || !from) {
    throw new Error(
      "SMS is not configured. Open SMS Setup from the gear menu and add your Twilio credentials."
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

  const config = await getSmsConfig();
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
        "SMS is not configured. Open SMS Setup from the gear menu and add your Twilio credentials.",
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