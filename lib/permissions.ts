import type { SheetTab, UserRole } from "./types";

export const ADMIN_ONLY_TABS: SheetTab[] = [
  "investors",
  "investor_capital",
  "investor_payout",
  "reports",
  "users",
  "sms_setup",
  "communication_investor",
];

export function isAdminRole(role: UserRole): boolean {
  return role === "admin";
}

export function canAccessTab(role: UserRole, tab: SheetTab): boolean {
  if (ADMIN_ONLY_TABS.includes(tab)) return isAdminRole(role);
  return true;
}

export function settingsTabsForRole(role: UserRole): { id: SheetTab; label: string }[] {
  const tabs: { id: SheetTab; label: string }[] = [
    { id: "businesses", label: "Business" },
    { id: "tenants", label: "Tenants" },
  ];
  if (isAdminRole(role)) {
    tabs.push({ id: "investors", label: "Investor" });
    tabs.push({ id: "users", label: "User Setup" });
    tabs.push({ id: "sms_setup", label: "SMS Setup" });
  }
  return tabs;
}

export function investorTabsForRole(
  role: UserRole
): { id: SheetTab; label: string }[] {
  if (!isAdminRole(role)) return [];
  return [
    { id: "investor_capital", label: "Capital" },
    { id: "investor_payout", label: "Payout" },
  ];
}

export const COMMUNICATION_TABS: { id: SheetTab; label: string }[] = [
  { id: "communication_tenant", label: "Tenant" },
  { id: "communication_investor", label: "Investor" },
];

export function communicationTabsForRole(
  role: UserRole
): { id: SheetTab; label: string }[] {
  const tabs: { id: SheetTab; label: string }[] = [
    { id: "communication_tenant", label: "Tenant" },
  ];
  if (isAdminRole(role)) {
    tabs.push({ id: "communication_investor", label: "Investor" });
  }
  return tabs;
}

export function isCommunicationTab(tab: SheetTab): boolean {
  return tab === "communication_tenant" || tab === "communication_investor";
}

export function navTabsAfterManagementForRole(
  role: UserRole
): { id: SheetTab; label: string }[] {
  if (!isAdminRole(role)) return [];
  return [{ id: "reports", label: "Reports" }];
}