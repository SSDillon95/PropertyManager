import type { Lease, Property, Tenant } from "./types";

export function tenantDisplayName(tenant: Tenant): string {
  return `${tenant.first_name} ${tenant.last_name}`.trim();
}

export function rentDetailsForProperty(
  propertyName: string,
  properties: Property[],
  tenants: Tenant[],
  leases: Lease[]
) {
  const property = properties.find((p) => p.property_name === propertyName);
  const activeLease = leases.find(
    (l) => l.property_name === propertyName && l.status === "Active"
  );
  const activeTenant = tenants.find(
    (t) => t.property_name === propertyName && t.status === "Active"
  );

  const rentDue =
    property?.monthly_rent ?? activeLease?.monthly_rent ?? null;
  const tenantName =
    activeLease?.tenant_name ??
    (activeTenant ? tenantDisplayName(activeTenant) : "");
  const unit = activeLease?.unit ?? activeTenant?.unit ?? "";

  return { rentDue, tenantName, unit };
}