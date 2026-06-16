import { listTenants } from "@/lib/db";
import { findTenantByPhone, recordInboundSms, tenantDisplayName } from "@/lib/sms";

export async function POST(request: Request) {
  const formData = await request.formData();
  const from = String(formData.get("From") ?? "");
  const body = String(formData.get("Body") ?? "");
  const messageSid = String(formData.get("MessageSid") ?? "");

  if (from && body) {
    const tenants = await listTenants();
    const tenant = findTenantByPhone(tenants, from);

    await recordInboundSms({
      phone: from,
      body,
      external_id: messageSid || null,
      tenant_id: tenant?.id ?? null,
      tenant_name: tenant ? tenantDisplayName(tenant) : null,
      property_name: tenant?.property_name ?? null,
    });
  }

  return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}