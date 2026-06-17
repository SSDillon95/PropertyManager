import { jsonError, jsonOk } from "@/lib/api-helpers";
import { getGmailSettings, upsertGmailSettings } from "@/lib/db";
import {
  buildGmailProfile,
  credentialsFromGmailSettings,
  maskGmailPassword,
  shouldUpdateGmailPassword,
  validateGmailUsername,
} from "@/lib/gmail-setup";
import { testGmailCredentials } from "@/lib/gmail";
import { requireAdminOrForbidden } from "@/lib/session";
import type { GmailSetupStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

function setupStatusFromSettings(
  settings: Awaited<ReturnType<typeof getGmailSettings>>
): GmailSetupStatus {
  const credentials = credentialsFromGmailSettings(settings);
  const databaseValues = settings ?? {
    username: null,
    password: null,
    smtp_host: "smtp.gmail.com",
    smtp_port: 587,
    imap_host: "imap.gmail.com",
    imap_port: 993,
    from_address: null,
    updated_at: "",
  };
  const profile = databaseValues.username
    ? buildGmailProfile(databaseValues.username)
    : credentials.username
      ? buildGmailProfile(credentials.username)
      : null;

  return {
    username:
      databaseValues.username?.trim() ||
      (credentials.source === "environment" ? process.env.GMAIL_USERNAME?.trim() ?? "" : ""),
    hasPassword: Boolean(
      databaseValues.password?.trim() ||
        (credentials.source === "environment" && process.env.GMAIL_PASSWORD?.trim())
    ),
    configured: credentials.source !== "none",
    configSource: credentials.source,
    smtpHost: profile?.smtpHost ?? "smtp.gmail.com",
    smtpPort: profile?.smtpPort ?? 587,
    imapHost: profile?.imapHost ?? "imap.gmail.com",
    imapPort: profile?.imapPort ?? 993,
    fromAddress: profile?.fromAddress ?? databaseValues.from_address?.trim() ?? "",
    updatedAt: settings?.updated_at ?? null,
  };
}

export async function GET() {
  const forbidden = await requireAdminOrForbidden();
  if (forbidden) return forbidden;

  const settings = await getGmailSettings();
  return jsonOk(setupStatusFromSettings(settings));
}

export async function PUT(request: Request) {
  const forbidden = await requireAdminOrForbidden();
  if (forbidden) return forbidden;

  try {
    const body = await request.json();
    const username = validateGmailUsername(String(body.username ?? ""));
    const passwordInput = String(body.password ?? "");
    const existing = await getGmailSettings();
    const password = shouldUpdateGmailPassword(passwordInput)
      ? passwordInput.trim()
      : existing?.password?.trim();

    if (!password) throw new Error("Gmail password is required.");

    const verified = await testGmailCredentials({ username, password });
    const settings = await upsertGmailSettings({
      username: verified.username ?? username,
      password: verified.password ?? password,
      smtp_host: verified.smtp_host,
      smtp_port: verified.smtp_port,
      imap_host: verified.imap_host,
      imap_port: verified.imap_port,
      from_address: verified.from_address ?? username,
    });

    const status = setupStatusFromSettings(settings);
    return jsonOk({
      ...status,
      password: maskGmailPassword(settings.password),
    });
  } catch (error) {
    return jsonError((error as Error).message, 400);
  }
}