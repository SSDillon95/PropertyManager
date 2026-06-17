import type { GmailSettings, SmsConfigSource } from "./types";

export const GMAIL_SMTP_HOST = "smtp.gmail.com";
export const GMAIL_SMTP_PORT = 587;
export const GMAIL_IMAP_HOST = "imap.gmail.com";
export const GMAIL_IMAP_PORT = 993;
const PASSWORD_MASK = "••••••••••••••••";

export function maskGmailPassword(password: string | null | undefined): string {
  return password?.trim() ? PASSWORD_MASK : "";
}

export function shouldUpdateGmailPassword(value: string): boolean {
  const trimmed = value.trim();
  return Boolean(trimmed && trimmed !== PASSWORD_MASK);
}

export function buildGmailProfile(username: string): {
  smtpHost: string;
  smtpPort: number;
  imapHost: string;
  imapPort: number;
  fromAddress: string;
} {
  const email = username.trim().toLowerCase();
  return {
    smtpHost: GMAIL_SMTP_HOST,
    smtpPort: GMAIL_SMTP_PORT,
    imapHost: GMAIL_IMAP_HOST,
    imapPort: GMAIL_IMAP_PORT,
    fromAddress: email,
  };
}

export function credentialsFromGmailSettings(
  settings: GmailSettings | null
): {
  username: string | null;
  password: string | null;
  smtpHost: string;
  smtpPort: number;
  imapHost: string;
  imapPort: number;
  fromAddress: string | null;
  source: SmsConfigSource;
} {
  if (settings?.username?.trim() && settings.password?.trim()) {
    return {
      username: settings.username.trim(),
      password: settings.password.trim(),
      smtpHost: settings.smtp_host || GMAIL_SMTP_HOST,
      smtpPort: settings.smtp_port || GMAIL_SMTP_PORT,
      imapHost: settings.imap_host || GMAIL_IMAP_HOST,
      imapPort: settings.imap_port || GMAIL_IMAP_PORT,
      fromAddress: settings.from_address?.trim() || settings.username.trim(),
      source: "database",
    };
  }

  const username = process.env.GMAIL_USERNAME?.trim() ?? null;
  const password = process.env.GMAIL_PASSWORD?.trim() ?? null;
  if (username && password) {
    const profile = buildGmailProfile(username);
    return {
      username,
      password,
      smtpHost: GMAIL_SMTP_HOST,
      smtpPort: GMAIL_SMTP_PORT,
      imapHost: GMAIL_IMAP_HOST,
      imapPort: GMAIL_IMAP_PORT,
      fromAddress: profile.fromAddress,
      source: "environment",
    };
  }

  return {
    username: null,
    password: null,
    smtpHost: GMAIL_SMTP_HOST,
    smtpPort: GMAIL_SMTP_PORT,
    imapHost: GMAIL_IMAP_HOST,
    imapPort: GMAIL_IMAP_PORT,
    fromAddress: null,
    source: "none",
  };
}

export function validateGmailUsername(username: string): string {
  const email = username.trim().toLowerCase();
  if (!email) throw new Error("Gmail username is required.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid Gmail email address.");
  }
  return email;
}