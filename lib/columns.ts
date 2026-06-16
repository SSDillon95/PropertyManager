import type { SheetTab } from "./types";

export interface ColumnDef {
  key: string;
  label: string;
  type:
    | "text"
    | "number"
    | "date"
    | "currency"
    | "select"
    | "property"
    | "tenant"
    | "investor"
    | "capital"
    | "business";
  options?: string[];
  required?: boolean;
  width?: string;
}

export const MANAGEMENT_TABS: { id: SheetTab; label: string }[] = [
  { id: "tenants", label: "Tenants" },
  { id: "leases", label: "Leases" },
  { id: "rent_ledger", label: "Rent Ledger" },
  { id: "expenses", label: "Expenses" },
  { id: "maintenance", label: "Maintenance" },
];

export const SETTINGS_TABS: { id: SheetTab; label: string }[] = [
  { id: "businesses", label: "Business" },
  { id: "investors", label: "Investor Contacts" },
  { id: "users", label: "User Setup" },
];

export const INVESTOR_TABS: { id: SheetTab; label: string }[] = [
  { id: "investor_capital", label: "Capital" },
  { id: "investor_payout", label: "Payout" },
];

export const NAV_TABS_BEFORE_MANAGEMENT: { id: SheetTab; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "properties", label: "Properties" },
];

export const NAV_TABS_AFTER_MANAGEMENT: { id: SheetTab; label: string }[] = [
  { id: "communication", label: "Communication" },
  { id: "reports", label: "Reports" },
];

export const SHEET_TABS: { id: SheetTab; label: string }[] = [
  ...SETTINGS_TABS,
  ...NAV_TABS_BEFORE_MANAGEMENT,
  ...MANAGEMENT_TABS,
  ...INVESTOR_TABS,
  ...NAV_TABS_AFTER_MANAGEMENT,
];

export function isManagementTab(tab: SheetTab): boolean {
  return MANAGEMENT_TABS.some((item) => item.id === tab);
}

export function isInvestorTab(tab: SheetTab): boolean {
  return INVESTOR_TABS.some((item) => item.id === tab);
}

export function isSettingsTab(tab: SheetTab): boolean {
  return (
    tab === "businesses" || tab === "investors" || tab === "users"
  );
}

export const BUSINESS_COLUMNS: ColumnDef[] = [
  { key: "business_id", label: "Business ID", type: "text", required: true, width: "110px" },
  { key: "business_name", label: "Business Name", type: "text", required: true, width: "180px" },
  {
    key: "entity_type",
    label: "Entity Type",
    type: "select",
    options: ["LLC", "Corporation", "Partnership", "Sole Proprietorship", "Trust", "Other"],
    width: "150px",
  },
  { key: "address", label: "Address", type: "text", width: "180px" },
  { key: "city", label: "City", type: "text", width: "120px" },
  { key: "state", label: "State", type: "text", width: "70px" },
  { key: "zip", label: "ZIP", type: "text", width: "80px" },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: ["Active", "Inactive"],
    width: "100px",
  },
  { key: "notes", label: "Notes", type: "text", width: "200px" },
];

export const PROPERTY_COLUMNS: ColumnDef[] = [
  { key: "legal_id", label: "Legal ID", type: "text", required: true, width: "100px" },
  { key: "business_name", label: "Business", type: "business", width: "160px" },
  { key: "property_name", label: "Property Name", type: "text", required: true, width: "160px" },
  { key: "lien_holder", label: "Lien Holder", type: "text", width: "150px" },
  { key: "account_number", label: "Account Number", type: "text", width: "130px" },
  { key: "address", label: "Address", type: "text", required: true, width: "180px" },
  { key: "city", label: "City", type: "text", required: true, width: "120px" },
  { key: "state", label: "State", type: "text", required: true, width: "70px" },
  { key: "zip", label: "ZIP", type: "text", required: true, width: "80px" },
  {
    key: "property_type",
    label: "Property Type",
    type: "select",
    options: ["Single Family", "Multi-Family", "Condo", "Townhouse", "Commercial"],
    width: "130px",
  },
  { key: "units", label: "Units", type: "number", width: "70px" },
  { key: "bedrooms", label: "Bedrooms", type: "number", width: "80px" },
  { key: "bathrooms", label: "Bathrooms", type: "number", width: "90px" },
  { key: "sq_ft", label: "Sq Ft", type: "number", width: "80px" },
  { key: "year_built", label: "Year Built", type: "number", width: "90px" },
  { key: "purchase_date", label: "Purchase Date", type: "date", width: "120px" },
  { key: "purchase_price", label: "Purchase Price", type: "currency", width: "120px" },
  { key: "current_value", label: "Current Value", type: "currency", width: "120px" },
  { key: "mortgage_balance", label: "Mortgage Balance", type: "currency", width: "130px" },
  { key: "monthly_mortgage", label: "Monthly Mortgage", type: "currency", width: "130px" },
  { key: "annual_property_tax", label: "Annual Property Tax", type: "currency", width: "140px" },
  { key: "annual_insurance", label: "Annual Insurance", type: "currency", width: "130px" },
  { key: "monthly_hoa", label: "Monthly HOA", type: "currency", width: "110px" },
  { key: "monthly_rent", label: "Monthly Rent", type: "currency", width: "120px" },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: ["Occupied", "Vacant", "Under Renovation", "For Sale"],
    width: "130px",
  },
  { key: "notes", label: "Notes", type: "text", width: "200px" },
];

export const TENANT_COLUMNS: ColumnDef[] = [
  { key: "tenant_id", label: "Tenant ID", type: "text", required: true, width: "100px" },
  { key: "first_name", label: "First Name", type: "text", required: true, width: "120px" },
  { key: "last_name", label: "Last Name", type: "text", required: true, width: "120px" },
  { key: "email", label: "Email", type: "text", width: "180px" },
  { key: "phone", label: "Phone", type: "text", width: "120px" },
  { key: "emergency_contact", label: "Emergency Contact", type: "text", width: "150px" },
  { key: "emergency_phone", label: "Emergency Phone", type: "text", width: "130px" },
  { key: "property_name", label: "Property", type: "property", width: "150px" },
  { key: "unit", label: "Unit", type: "text", width: "80px" },
  { key: "move_in_date", label: "Move-In Date", type: "date", width: "120px" },
  { key: "move_out_date", label: "Move-Out Date", type: "date", width: "120px" },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: ["Active", "Past", "Applicant", "Notice Given"],
    width: "120px",
  },
  { key: "notes", label: "Notes", type: "text", width: "200px" },
];

export const LEASE_COLUMNS: ColumnDef[] = [
  { key: "lease_id", label: "Lease ID", type: "text", required: true, width: "100px" },
  { key: "property_name", label: "Property", type: "property", required: true, width: "150px" },
  { key: "unit", label: "Unit", type: "text", width: "80px" },
  { key: "tenant_name", label: "Tenant", type: "tenant", required: true, width: "150px" },
  { key: "lease_start", label: "Lease Start", type: "date", required: true, width: "120px" },
  { key: "lease_end", label: "Lease End", type: "date", width: "120px" },
  { key: "monthly_rent", label: "Monthly Rent", type: "currency", required: true, width: "120px" },
  { key: "security_deposit", label: "Security Deposit", type: "currency", width: "130px" },
  { key: "pet_deposit", label: "Pet Deposit", type: "currency", width: "110px" },
  {
    key: "lease_type",
    label: "Lease Type",
    type: "select",
    options: ["Fixed Term", "Month-to-Month"],
    width: "130px",
  },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: ["Active", "Expired", "Terminated", "Pending"],
    width: "110px",
  },
  { key: "renewal_date", label: "Renewal Date", type: "date", width: "120px" },
  { key: "notes", label: "Notes", type: "text", width: "200px" },
];

export const RENT_LEDGER_COLUMNS: ColumnDef[] = [
  { key: "date", label: "Date", type: "date", required: true, width: "110px" },
  { key: "property_name", label: "Property", type: "property", required: true, width: "150px" },
  { key: "unit", label: "Unit", type: "text", width: "80px" },
  { key: "tenant_name", label: "Tenant", type: "text", required: true, width: "150px" },
  { key: "rent_due", label: "Rent Due", type: "currency", required: true, width: "100px" },
  { key: "amount_paid", label: "Amount Paid", type: "currency", required: true, width: "110px" },
  { key: "payment_date", label: "Payment Date", type: "date", width: "120px" },
  {
    key: "payment_method",
    label: "Payment Method",
    type: "select",
    options: ["Check", "ACH", "Cash", "Credit Card", "Zelle", "Other"],
    width: "130px",
  },
  { key: "late_fee", label: "Late Fee", type: "currency", width: "90px" },
  { key: "balance", label: "Balance", type: "currency", width: "90px" },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: ["Paid", "Partial", "Overdue", "Pending"],
    width: "100px",
  },
  { key: "notes", label: "Notes", type: "text", width: "200px" },
];

export const EXPENSE_COLUMNS: ColumnDef[] = [
  { key: "date", label: "Date", type: "date", required: true, width: "110px" },
  { key: "property_name", label: "Property", type: "property", required: true, width: "150px" },
  {
    key: "category",
    label: "Category",
    type: "select",
    options: [
      "Repairs",
      "Utilities",
      "Insurance",
      "Property Tax",
      "HOA",
      "Landscaping",
      "Management",
      "Legal",
      "Other",
    ],
    required: true,
    width: "130px",
  },
  { key: "vendor", label: "Vendor", type: "text", width: "140px" },
  { key: "description", label: "Description", type: "text", width: "200px" },
  { key: "amount", label: "Amount", type: "currency", required: true, width: "100px" },
  {
    key: "payment_method",
    label: "Payment Method",
    type: "select",
    options: ["Check", "ACH", "Cash", "Credit Card", "Other"],
    width: "130px",
  },
  { key: "receipt_number", label: "Receipt #", type: "text", width: "100px" },
  { key: "notes", label: "Notes", type: "text", width: "200px" },
];

export const MAINTENANCE_COLUMNS: ColumnDef[] = [
  { key: "date_reported", label: "Date Reported", type: "date", required: true, width: "120px" },
  { key: "property_name", label: "Property", type: "property", required: true, width: "150px" },
  { key: "unit", label: "Unit", type: "text", width: "80px" },
  {
    key: "category",
    label: "Category",
    type: "select",
    options: ["Plumbing", "Electrical", "HVAC", "Appliance", "Structural", "Pest", "Other"],
    required: true,
    width: "120px",
  },
  { key: "description", label: "Description", type: "text", required: true, width: "200px" },
  {
    key: "priority",
    label: "Priority",
    type: "select",
    options: ["Low", "Medium", "High", "Emergency"],
    width: "100px",
  },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: ["Open", "In Progress", "Completed", "Cancelled"],
    width: "120px",
  },
  { key: "vendor", label: "Vendor", type: "text", width: "140px" },
  { key: "estimated_cost", label: "Est. Cost", type: "currency", width: "100px" },
  { key: "actual_cost", label: "Actual Cost", type: "currency", width: "110px" },
  { key: "date_completed", label: "Date Completed", type: "date", width: "130px" },
  { key: "notes", label: "Notes", type: "text", width: "200px" },
];

export const INVESTOR_COLUMNS: ColumnDef[] = [
  { key: "investor_id", label: "Investor ID", type: "text", required: true, width: "100px" },
  { key: "investor_name", label: "Investor Name", type: "text", required: true, width: "160px" },
  { key: "email", label: "Email", type: "text", width: "180px" },
  { key: "phone", label: "Phone", type: "text", width: "120px" },
  {
    key: "entity_type",
    label: "Entity Type",
    type: "select",
    options: ["Individual", "LLC", "Trust", "Partnership", "Corporation"],
    width: "130px",
  },
  { key: "tax_id", label: "Tax ID", type: "text", width: "120px" },
  { key: "address", label: "Address", type: "text", width: "180px" },
  { key: "city", label: "City", type: "text", width: "120px" },
  { key: "state", label: "State", type: "text", width: "70px" },
  { key: "zip", label: "ZIP", type: "text", width: "80px" },
  { key: "property_name", label: "Property", type: "property", width: "150px" },
  { key: "ownership_pct", label: "Ownership %", type: "number", width: "100px" },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: ["Active", "Inactive"],
    width: "100px",
  },
  { key: "notes", label: "Notes", type: "text", width: "200px" },
];

export const INVESTOR_CAPITAL_COLUMNS: ColumnDef[] = [
  { key: "payout_id", label: "Capital ID", type: "text", required: true, width: "100px" },
  { key: "date", label: "Date", type: "date", required: true, width: "110px" },
  { key: "property_name", label: "Property", type: "property", required: true, width: "150px" },
  { key: "property_address", label: "Property Address", type: "text", width: "180px" },
  { key: "loan_date", label: "Loan Date", type: "date", width: "110px" },
  { key: "sell_estimate_date", label: "Sell Estimate", type: "date", width: "120px" },
  { key: "investor_name", label: "Investor", type: "investor", required: true, width: "150px" },
  { key: "attorney", label: "Attorney", type: "text", width: "130px" },
  { key: "amount_loaned", label: "Amount Loaned", type: "currency", width: "120px" },
  { key: "annual_interest_rate", label: "12-Mo Rate", type: "number", width: "100px" },
  { key: "kicker", label: "Kicker", type: "currency", width: "100px" },
  { key: "days_in_year", label: "Days in Year", type: "number", width: "100px" },
  { key: "notes", label: "Notes", type: "text", width: "200px" },
];

export const INVESTOR_PAYOUT_COLUMNS: ColumnDef[] = [
  { key: "capital_id", label: "Capital ID", type: "capital", required: true, width: "120px" },
  { key: "payout_id", label: "Payout ID", type: "text", width: "90px" },
  { key: "date", label: "Date", type: "date", required: true, width: "110px" },
  { key: "property_name", label: "Property", type: "property", required: true, width: "150px" },
  { key: "investor_name", label: "Investor", type: "investor", required: true, width: "150px" },
  {
    key: "payout_type",
    label: "Payout Type",
    type: "select",
    options: [
      "Distribution",
      "Return of Capital",
      "Preferred Return",
      "Profit Share",
      "Tax Distribution",
      "Other",
    ],
    required: true,
    width: "140px",
  },
  { key: "payout_amount", label: "Payout Amount", type: "currency", required: true, width: "120px" },
  {
    key: "payment_method",
    label: "Payment Method",
    type: "select",
    options: ["Check", "ACH", "Wire", "Cash", "Other"],
    width: "130px",
  },
  { key: "payment_date", label: "Payment Date", type: "date", width: "120px" },
  { key: "tax_year", label: "Tax Year", type: "number", width: "90px" },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: ["Pending", "Paid", "Cancelled"],
    width: "100px",
  },
  { key: "notes", label: "Notes", type: "text", width: "200px" },
];

export const USER_COLUMNS: ColumnDef[] = [
  { key: "username", label: "Username", type: "text", required: true, width: "160px" },
  {
    key: "role",
    label: "Role",
    type: "select",
    options: ["Admin", "Standard"],
    required: true,
    width: "120px",
  },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: ["Active", "Inactive"],
    required: true,
    width: "110px",
  },
];

export function getColumnsForTab(tab: SheetTab): ColumnDef[] {
  switch (tab) {
    case "businesses":
      return BUSINESS_COLUMNS;
    case "properties":
      return PROPERTY_COLUMNS;
    case "tenants":
      return TENANT_COLUMNS;
    case "leases":
      return LEASE_COLUMNS;
    case "rent_ledger":
      return RENT_LEDGER_COLUMNS;
    case "expenses":
      return EXPENSE_COLUMNS;
    case "maintenance":
      return MAINTENANCE_COLUMNS;
    case "investors":
      return INVESTOR_COLUMNS;
    case "investor_capital":
      return INVESTOR_CAPITAL_COLUMNS;
    case "investor_payout":
      return INVESTOR_PAYOUT_COLUMNS;
    case "users":
      return USER_COLUMNS;
    default:
      return [];
  }
}