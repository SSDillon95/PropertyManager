import { jsonError, jsonOk } from "@/lib/api-helpers";
import { getSmsSettings, upsertSmsSettings } from "@/lib/db";
import {
  buildSmsWebhookUrl,
  credentialsFromSettings,
  maskAuthToken,
  shouldUpdateAuthToken,
} from "@/lib/sms-setup";
import { requireAdminOrForbidden } from "@/lib/session";
import type { SmsSetupStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

function setupStatusFromRequest(
  request: Request,
  settings: Awaited<ReturnType<typeof getSmsSettings>>
): SmsSetupStatus {
  const credentials = credentialsFromSettings(settings);
  const origin = request.headers.get("origin");
  const databaseValues = settings ?? {
    account_sid: null,
    auth_token: null,
    phone_number: null,
    updated_at: "",
  };

  return {
    accountSid:
      databaseValues.account_sid?.trim() ||
      (credentials.source === "environment" ? process.env.TWILIO_ACCOUNT_SID?.trim() ?? "" : ""),
    phoneNumber:
      databaseValues.phone_number?.trim() ||
      (credentials.source === "environment" ? process.env.TWILIO_PHONE_NUMBER?.trim() ?? "" : ""),
    hasAuthToken: Boolean(
      databaseValues.auth_token?.trim() ||
        (credentials.source === "environment" && process.env.TWILIO_AUTH_TOKEN?.trim())
    ),
    configured: credentials.source !== "none",
    webhookUrl: buildSmsWebhookUrl(origin),
    configSource: credentials.source,
    updatedAt: settings?.updated_at ?? null,
  };
}

export async function GET(request: Request) {
  const forbidden = await requireAdminOrForbidden();
  if (forbidden) return forbidden;

  const settings = await getSmsSettings();
  return jsonOk(setupStatusFromRequest(request, settings));
}

export async function PUT(request: Request) {
  const forbidden = await requireAdminOrForbidden();
  if (forbidden) return forbidden;

  try {
    const body = await request.json();
    const accountSid = String(body.account_sid ?? body.accountSid ?? "").trim();
    const phoneNumber = String(body.phone_number ?? body.phoneNumber ?? "").trim();
    const authTokenInput = String(body.auth_token ?? body.authToken ?? "");

    const settings = await upsertSmsSettings({
      account_sid: accountSid,
      phone_number: phoneNumber,
      auth_token: shouldUpdateAuthToken(authTokenInput) ? authTokenInput : undefined,
    });

    const status = setupStatusFromRequest(request, settings);
    return jsonOk({
      ...status,
      authToken: maskAuthToken(settings.auth_token),
    });
  } catch (error) {
    return jsonError((error as Error).message, 400);
  }
}