import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import {
  createEmailMessage,
  getGmailSettings,
  getLastEmailMessageForAddress,
  listEmailExternalIds,
  listInvestors,
  listTenants,
} from "./db";
import { findInvestorByEmail, findTenantByEmail, normalizeEmailAddress } from "./email-utils";
import { buildGmailProfile, credentialsFromGmailSettings } from "./gmail-setup";
import { tenantDisplayName } from "./rent-ledger";
import { investorSmsName } from "./sms-utils";
import type { EmailMessage, GmailSettings, SmsContactType } from "./types";

export interface GmailConfig {
  configured: boolean;
  fromAddress: string | null;
  source: "database" | "environment" | "none";
}

export async function resolveGmailCredentials() {
  const settings = await getGmailSettings();
  return credentialsFromGmailSettings(settings);
}

export async function getGmailConfig(): Promise<GmailConfig> {
  const credentials = await resolveGmailCredentials();
  return {
    configured: Boolean(credentials.username && credentials.password),
    fromAddress: credentials.fromAddress,
    source: credentials.source,
  };
}

export async function testGmailCredentials(input: {
  username: string;
  password: string;
}): Promise<GmailSettings> {
  const username = input.username.trim().toLowerCase();
  const password = input.password.trim();
  if (!username || !password) {
    throw new Error("Gmail username and password are required.");
  }

  const profile = buildGmailProfile(username);
  const transporter = nodemailer.createTransport({
    host: profile.smtpHost,
    port: profile.smtpPort,
    secure: false,
    auth: { user: username, pass: password },
  });

  try {
    await transporter.verify();
  } catch (error) {
    throw new Error(
      `Gmail SMTP connection failed. Use a Google App Password if 2-Step Verification is enabled. ${
        (error as Error).message
      }`
    );
  }

  const client = new ImapFlow({
    host: profile.imapHost,
    port: profile.imapPort,
    secure: true,
    auth: { user: username, pass: password },
    logger: false,
  });

  try {
    await client.connect();
    await client.mailboxOpen("INBOX");
  } catch (error) {
    throw new Error(
      `Gmail IMAP connection failed. Use a Google App Password if 2-Step Verification is enabled. ${
        (error as Error).message
      }`
    );
  } finally {
    await client.logout().catch(() => undefined);
  }

  return {
    username,
    password,
    smtp_host: profile.smtpHost,
    smtp_port: profile.smtpPort,
    imap_host: profile.imapHost,
    imap_port: profile.imapPort,
    from_address: profile.fromAddress,
    updated_at: new Date().toISOString(),
  };
}

export interface SendEmailInput {
  to: string;
  subject: string;
  body: string;
  contact_type: SmsContactType;
  tenant_id?: number | null;
  tenant_name?: string | null;
  investor_id?: number | null;
  investor_name?: string | null;
  property_name?: string | null;
  message_type?: string;
}

function buildEmailRecord(
  input: SendEmailInput,
  emailAddress: string,
  status: EmailMessage["status"],
  external_id: string | null,
  error_message: string | null
): Omit<EmailMessage, "id" | "created_at"> {
  const contactType = input.contact_type;
  return {
    contact_type: contactType,
    direction: "outbound",
    tenant_id: contactType === "tenant" ? (input.tenant_id ?? null) : null,
    tenant_name: contactType === "tenant" ? (input.tenant_name ?? null) : null,
    investor_id: contactType === "investor" ? (input.investor_id ?? null) : null,
    investor_name: contactType === "investor" ? (input.investor_name ?? null) : null,
    property_name: input.property_name ?? null,
    email_address: emailAddress,
    subject: input.subject.trim() || null,
    body: input.body.trim(),
    message_type: input.message_type ?? "general",
    status,
    external_id,
    error_message,
  };
}

export async function sendGmailMessage(input: SendEmailInput): Promise<EmailMessage> {
  const emailAddress = normalizeEmailAddress(input.to);
  if (!emailAddress) throw new Error("A valid email address is required.");

  const credentials = await resolveGmailCredentials();
  if (!credentials.username || !credentials.password) {
    return createEmailMessage(
      buildEmailRecord(
        input,
        emailAddress,
        "failed",
        null,
        "Gmail is not configured. Open Gmail Setup from the gear menu and add your credentials."
      )
    );
  }

  try {
    const transporter = nodemailer.createTransport({
      host: credentials.smtpHost,
      port: credentials.smtpPort,
      secure: false,
      auth: { user: credentials.username, pass: credentials.password },
    });

    const info = await transporter.sendMail({
      from: credentials.fromAddress ?? credentials.username,
      to: emailAddress,
      subject: input.subject.trim() || "Message from HOP2IT Property Management",
      text: input.body.trim(),
    });

    return createEmailMessage(
      buildEmailRecord(input, emailAddress, "sent", info.messageId ?? null, null)
    );
  } catch (error) {
    return createEmailMessage(
      buildEmailRecord(input, emailAddress, "failed", null, (error as Error).message)
    );
  }
}

function extractPlainBody(source: string): string {
  const parts = source.split(/\r?\n\r?\n/);
  if (parts.length < 2) return source.trim();
  return parts.slice(1).join("\n\n").trim();
}

function resolveInboundContactType(
  fromAddress: string,
  tenants: Awaited<ReturnType<typeof listTenants>>,
  investors: Awaited<ReturnType<typeof listInvestors>>,
  lastMessage: EmailMessage | null
): {
  contactType: SmsContactType;
  tenant_id: number | null;
  tenant_name: string | null;
  investor_id: number | null;
  investor_name: string | null;
  property_name: string | null;
} {
  const tenant = findTenantByEmail(tenants, fromAddress);
  const investor = findInvestorByEmail(investors, fromAddress);
  let contactType: SmsContactType = lastMessage?.contact_type ?? "tenant";

  if (!lastMessage) {
    if (tenant && !investor) contactType = "tenant";
    else if (investor && !tenant) contactType = "investor";
    else if (investor) contactType = "investor";
  }

  if (contactType === "investor") {
    return {
      contactType,
      tenant_id: null,
      tenant_name: null,
      investor_id: investor?.id ?? null,
      investor_name: investor ? investorSmsName(investor) : null,
      property_name: investor?.property_name ?? null,
    };
  }

  return {
    contactType: "tenant",
    tenant_id: tenant?.id ?? null,
    tenant_name: tenant ? tenantDisplayName(tenant) : null,
    investor_id: null,
    investor_name: null,
    property_name: tenant?.property_name ?? null,
  };
}

export async function syncInboundGmailMessages(): Promise<number> {
  const credentials = await resolveGmailCredentials();
  if (!credentials.username || !credentials.password) return 0;

  const [tenants, investors, existingIds] = await Promise.all([
    listTenants(),
    listInvestors(),
    listEmailExternalIds(),
  ]);
  const knownIds = new Set(existingIds);
  let imported = 0;

  const client = new ImapFlow({
    host: credentials.imapHost,
    port: credentials.imapPort,
    secure: true,
    auth: { user: credentials.username, pass: credentials.password },
    logger: false,
  });

  await client.connect();
  await client.mailboxOpen("INBOX");

  try {
    const uids = await client.search({ seen: false }, { uid: true });
    const uidList = Array.isArray(uids) ? uids : [];
    if (uidList.length === 0) return 0;

    for await (const message of client.fetch(uidList, {
      envelope: true,
      source: true,
      uid: true,
    })) {
      const from = message.envelope?.from?.[0];
      const rawFrom =
        from?.address ??
        (from && "mailbox" in from && "host" in from
          ? `${String((from as { mailbox?: string }).mailbox ?? "")}@${String((from as { host?: string }).host ?? "")}`
          : "");
      const fromAddress = rawFrom ? normalizeEmailAddress(rawFrom) : null;
      if (!fromAddress) continue;

      const externalId =
        message.envelope?.messageId?.trim() ||
        `uid:${message.uid ?? imported}`;
      if (knownIds.has(externalId)) continue;

      const lastMessage = await getLastEmailMessageForAddress(fromAddress);
      const contact = resolveInboundContactType(fromAddress, tenants, investors, lastMessage);
      const rawSource = message.source?.toString("utf8") ?? "";
      const body = extractPlainBody(rawSource) || message.envelope?.subject || "(No message body)";

      await createEmailMessage({
        contact_type: contact.contactType,
        direction: "inbound",
        tenant_id: contact.tenant_id,
        tenant_name: contact.tenant_name,
        investor_id: contact.investor_id,
        investor_name: contact.investor_name,
        property_name: contact.property_name,
        email_address: fromAddress,
        subject: message.envelope?.subject ?? null,
        body,
        message_type: "general",
        status: "received",
        external_id: externalId,
        error_message: null,
      });

      knownIds.add(externalId);
      imported += 1;
    }
  } finally {
    await client.logout().catch(() => undefined);
  }

  return imported;
}