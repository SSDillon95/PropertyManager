import type { SmsConfigSource, SmsSettings } from "./types";

const AUTH_TOKEN_MASK = "••••••••••••••••";

export function maskAuthToken(token: string | null | undefined): string {
  return token?.trim() ? AUTH_TOKEN_MASK : "";
}

export function shouldUpdateAuthToken(value: string): boolean {
  const trimmed = value.trim();
  return Boolean(trimmed && trimmed !== AUTH_TOKEN_MASK);
}

export function buildSmsWebhookUrl(origin?: string | null): string {
  const trimmed = origin?.trim().replace(/\/$/, "");
  if (trimmed) return `${trimmed}/api/sms/webhook`;

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) return `https://${vercelUrl.replace(/\/$/, "")}/api/sms/webhook`;

  return "http://localhost:3000/api/sms/webhook";
}

export function resolveConfigSource(
  settings: SmsSettings | null
): SmsConfigSource {
  if (
    settings?.account_sid?.trim() &&
    settings.auth_token?.trim() &&
    settings.phone_number?.trim()
  ) {
    return "database";
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER?.trim();
  if (accountSid && authToken && phoneNumber) return "environment";

  return "none";
}

export function credentialsFromSettings(
  settings: SmsSettings | null
): {
  accountSid: string | null;
  authToken: string | null;
  fromNumber: string | null;
  source: SmsConfigSource;
} {
  if (
    settings?.account_sid?.trim() &&
    settings.auth_token?.trim() &&
    settings.phone_number?.trim()
  ) {
    return {
      accountSid: settings.account_sid.trim(),
      authToken: settings.auth_token.trim(),
      fromNumber: settings.phone_number.trim(),
      source: "database",
    };
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim() ?? null;
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim() ?? null;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER?.trim() ?? null;
  if (accountSid && authToken && fromNumber) {
    return { accountSid, authToken, fromNumber, source: "environment" };
  }

  return {
    accountSid: null,
    authToken: null,
    fromNumber: null,
    source: "none",
  };
}