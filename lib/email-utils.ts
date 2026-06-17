import type { EmailMessage, Investor, Tenant } from "./types";

export function normalizeEmailAddress(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;
  return trimmed;
}

export function findTenantByEmail(tenants: Tenant[], email: string): Tenant | null {
  const normalized = normalizeEmailAddress(email);
  if (!normalized) return null;
  return tenants.find((tenant) => normalizeEmailAddress(tenant.email ?? "") === normalized) ?? null;
}

export function findInvestorByEmail(investors: Investor[], email: string): Investor | null {
  const normalized = normalizeEmailAddress(email);
  if (!normalized) return null;
  return (
    investors.find((investor) => normalizeEmailAddress(investor.email ?? "") === normalized) ??
    null
  );
}

export function groupMessagesByEmail(messages: EmailMessage[]): Map<string, EmailMessage[]> {
  const groups = new Map<string, EmailMessage[]>();
  for (const message of messages) {
    const key = normalizeEmailAddress(message.email_address) ?? message.email_address;
    const current = groups.get(key) ?? [];
    current.push(message);
    groups.set(key, current);
  }
  for (const [key, thread] of groups) {
    thread.sort((left, right) => left.created_at.localeCompare(right.created_at));
    groups.set(key, thread);
  }
  return groups;
}