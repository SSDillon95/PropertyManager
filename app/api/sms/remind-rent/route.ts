import { jsonError, jsonOk } from "@/lib/api-helpers";
import { listRentPayments, listTenants } from "@/lib/db";
import { tenantDisplayName } from "@/lib/rent-ledger";
import { buildRentReminderMessage, findTenantByName, sendSmsMessage } from "@/lib/sms";

export async function POST(request: Request) {
  let body: { rentPaymentId?: number; tenantId?: number } = {};
  try {
    body = await request.json();
  } catch {
    // empty body is ok for bulk reminders
  }

  const [rentPayments, tenants] = await Promise.all([listRentPayments(), listTenants()]);

  const targets = rentPayments.filter((payment) => {
    if (body.rentPaymentId != null && payment.id !== body.rentPaymentId) return false;
    if (body.tenantId != null) {
      const tenant = tenants.find((t) => t.id === body.tenantId);
      if (!tenant || payment.tenant_name !== tenantDisplayName(tenant)) return false;
    }
    const status = payment.status.toLowerCase();
    return status !== "paid" && status !== "received";
  });

  if (targets.length === 0) {
    return jsonError("No outstanding rent payments found to remind", 404);
  }

  const results: { tenantName: string; ok: boolean; error?: string }[] = [];

  for (const payment of targets) {
    const tenant = findTenantByName(tenants, payment.tenant_name);
    if (!tenant?.phone?.trim()) {
      results.push({
        tenantName: payment.tenant_name,
        ok: false,
        error: "No phone number on file",
      });
      continue;
    }

    const smsBody = buildRentReminderMessage(tenant, payment);

    const result = await sendSmsMessage({
      phone: tenant.phone,
      body: smsBody,
      contact_type: "tenant",
      tenant_id: tenant.id,
      tenant_name: tenantDisplayName(tenant),
      property_name: payment.property_name,
      message_type: "rent_reminder",
      related_id: payment.id,
      related_type: "rent_payment",
    });

    results.push({
      tenantName: payment.tenant_name,
      ok: result.status !== "failed",
      error: result.error_message ?? undefined,
    });
  }

  const sent = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;

  return jsonOk({ sent, failed, results });
}