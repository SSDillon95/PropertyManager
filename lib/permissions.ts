import type { SheetTab, UserRole } from "./types";

export const ADMIN_ONLY_TABS: SheetTab[] = [
  "investors",
  "investor_capital",
  "investor_payout",
  "reports",
  "users",
  "sms_setup",
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

export function navTabsAfterManagementForRole(
  role: UserRole
): { id: SheetTab; label: string }[] {
  const tabs: { id: SheetTab; label: string }[] = [
    { id: "communication", label: "Communication" },
  ];
  if (isAdminRole(role)) {
    tabs.push({ id: "reports", label: "Reports" });
  }
  return tabs;
}