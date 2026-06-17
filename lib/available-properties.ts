import type { Lease, Property } from "./types";

export function isAvailableProperty(property: Property): boolean {
  return property.status !== "Occupied";
}

export function depositForAvailableProperty(
  propertyName: string,
  leases: Lease[]
): number | null {
  const propertyLeases = leases.filter((lease) => lease.property_name === propertyName);
  const pending = propertyLeases.find((lease) => lease.status === "Pending");
  if (pending?.security_deposit != null) return pending.security_deposit;

  for (let index = propertyLeases.length - 1; index >= 0; index -= 1) {
    const deposit = propertyLeases[index]?.security_deposit;
    if (deposit != null) return deposit;
  }
  return null;
}

export function formatBedBath(
  bedrooms: number | null | undefined,
  bathrooms: number | null | undefined
): string {
  const beds = bedrooms != null ? String(bedrooms) : "—";
  const baths = bathrooms != null ? String(bathrooms) : "—";
  return `${beds} / ${baths}`;
}

export function listAvailableProperties(properties: Property[]): Property[] {
  return properties
    .filter(isAvailableProperty)
    .sort((left, right) => left.property_name.localeCompare(right.property_name));
}