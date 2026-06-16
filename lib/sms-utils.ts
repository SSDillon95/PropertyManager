import { formatCurrency } from "./format";
import type { MaintenanceRecord, RentPayment, SmsMessage, Tenant } from "./types";

export function normalizePhoneNumber(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (phone.trim().startsWith("+") && digits.length >= 10) return `+${digits}`;
  return null;
}

export function formatPhoneDisplay(phone: string): string {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) return phone;
  const digits = normalized.replace(/\D/g, "");
  if (digits.length === 11) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return phone;
}

export function tenantSmsName(tenant: Pick<Tenant, "first_name" | "last_name">): string {
  return `${tenant.first_name} ${tenant.last_name}`.trim();
}

export function findTenantByPhone(tenants: Tenant[], phone: string): Tenant | null {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) return null;
  const targetDigits = normalized.replace(/\D/g, "");
  return (
    tenants.find((tenant) => {
      if (!tenant.phone) return false;
      const tenantDigits = normalizePhoneNumber(tenant.phone)?.replace(/\D/g, "");
      return tenantDigits === targetDigits;
    }) ?? null
  );
}

export function findTenantByName(tenants: Tenant[], tenantName: string): Tenant | null {
  const normalized = tenantName.trim().toLowerCase();
  return (
    tenants.find(
      (tenant) =>
        tenant.status === "Active" &&
        tenantSmsName(tenant).toLowerCase() === normalized
    ) ?? null
  );
}

export function findTenantForProperty(
  tenants: Tenant[],
  propertyName: string,
  unit?: string | null
): Tenant | null {
  const matches = tenants.filter(
    (tenant) =>
      tenant.status === "Active" &&
      tenant.property_name === propertyName &&
      (unit ? tenant.unit === unit : true)
  );
  return matches[0] ?? null;
}

export function buildRentReminderMessage(
  tenant: Pick<Tenant, "first_name">,
  payment: Pick<RentPayment, "property_name" | "rent_due" | "date" | "status">
): string {
  const amount = formatCurrency(payment.rent_due);
  return `Hi ${tenant.first_name}, this is HOP2IT Property Management. Your rent of ${amount} for ${payment.property_name} was due ${payment.date} (status: ${payment.status}). Please submit payment at your earliest convenience. Reply to this message with any questions.`;
}

export function buildMaintenanceMessage(
  tenant: Pick<Tenant, "first_name">,
  record: Pick<MaintenanceRecord, "property_name" | "description" | "status" | "category">
): string {
  return `Hi ${tenant.first_name}, this is HOP2IT Property Management regarding your ${record.category.toLowerCase()} maintenance request at ${record.property_name}: "${record.description}". Current status: ${record.status}. Reply to this message with updates or questions.`;
}

export function groupMessagesByPhone(messages: SmsMessage[]): Map<string, SmsMessage[]> {
  const groups = new Map<string, SmsMessage[]>();
  for (const message of messages) {
    const key = message.phone_number;
    const current = groups.get(key) ?? [];
    current.push(message);
    groups.set(key, current);
  }
  for (const [key, thread] of groups) {
    thread.sort((a, b) => a.created_at.localeCompare(b.created_at));
    groups.set(key, thread);
  }
  return groups;
}