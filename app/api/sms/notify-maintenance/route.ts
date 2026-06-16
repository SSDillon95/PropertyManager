import { jsonError, jsonOk } from "@/lib/api-helpers";
import { listMaintenance, listTenants } from "@/lib/db";
import { tenantDisplayName } from "@/lib/rent-ledger";
import {
  buildMaintenanceMessage,
  findTenantForProperty,
  sendSmsMessage,
} from "@/lib/sms";

export async function POST(request: Request) {
  let body: { maintenanceId?: number; customMessage?: string } = {};
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  if (body.maintenanceId == null) {
    return jsonError("maintenanceId is required", 400);
  }

  const [maintenanceItems, tenants] = await Promise.all([listMaintenance(), listTenants()]);
  const item = maintenanceItems.find((m) => m.id === body.maintenanceId);

  if (!item) {
    return jsonError("Maintenance request not found", 404);
  }

  const tenant = findTenantForProperty(tenants, item.property_name, item.unit);

  if (!tenant?.phone?.trim()) {
    return jsonError("No tenant with a phone number found for this property/unit", 404);
  }

  const smsBody =
    body.customMessage?.trim() || buildMaintenanceMessage(tenant, item);

  const result = await sendSmsMessage({
    phone: tenant.phone,
    body: smsBody,
    tenant_id: tenant.id,
    tenant_name: tenantDisplayName(tenant),
    property_name: item.property_name,
    message_type: "maintenance",
    related_id: item.id,
    related_type: "maintenance",
  });

  if (result.status === "failed") {
    return jsonError(result.error_message ?? "Failed to send message", 500);
  }

  return jsonOk({ message: result });
}