import { getLastSmsMessageForPhone, listInvestors, listTenants } from "@/lib/db";
import {
  findInvestorByPhone,
  findTenantByPhone,
  investorSmsName,
  recordInboundSms,
  tenantDisplayName,
} from "@/lib/sms";
import type { SmsContactType } from "@/lib/types";

export async function POST(request: Request) {
  const formData = await request.formData();
  const from = String(formData.get("From") ?? "");
  const body = String(formData.get("Body") ?? "");
  const messageSid = String(formData.get("MessageSid") ?? "");

  if (from && body) {
    const [tenants, investors, lastMessage] = await Promise.all([
      listTenants(),
      listInvestors(),
      getLastSmsMessageForPhone(from),
    ]);
    const tenant = findTenantByPhone(tenants, from);
    const investor = findInvestorByPhone(investors, from);

    let contactType: SmsContactType = lastMessage?.contact_type ?? "tenant";
    if (!lastMessage) {
      if (tenant && !investor) contactType = "tenant";
      else if (investor && !tenant) contactType = "investor";
      else if (investor) contactType = "investor";
    }

    if (contactType === "investor") {
      const matchedInvestor = investor ?? null;
      await recordInboundSms({
        phone: from,
        body,
        contact_type: "investor",
        external_id: messageSid || null,
        investor_id: matchedInvestor?.id ?? null,
        investor_name: matchedInvestor ? investorSmsName(matchedInvestor) : null,
        property_name: matchedInvestor?.property_name ?? null,
      });
    } else {
      const matchedTenant = tenant ?? null;
      await recordInboundSms({
        phone: from,
        body,
        contact_type: "tenant",
        external_id: messageSid || null,
        tenant_id: matchedTenant?.id ?? null,
        tenant_name: matchedTenant ? tenantDisplayName(matchedTenant) : null,
        property_name: matchedTenant?.property_name ?? null,
      });
    }
  }

  return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}