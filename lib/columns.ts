import type { SheetTab } from "./types";

export interface ColumnDef {
  key: string;
  label: string;
  type:
    | "text"
    | "number"
    | "date"
    | "currency"
    | "percent"
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
  { id: "available", label: "Available" },
  { id: "leases", label: "Leases" },
  { id: "rent_ledger", label: "Rent Ledger" },
  { id: "expenses", label: "Expenses" },
  { id: "maintenance", label: "Maintenance" },
];

export const SETTINGS_TABS: { id: SheetTab; label: string }[] = [
  { id: "businesses", label: "Business" },
  { id: "tenants", label: "Tenants" },
  { id: "investors", label: "Investor" },
  { id: "users", label: "User Setup" },
  { id: "sms_setup", label: "SMS Setup" },
  { id: "gmail_setup", label: "Gmail Setup" },
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
  { id: "reports", label: "Reports" },
];

export const COMMUNICATION_TABS: { id: SheetTab; label: string }[] = [
  { id: "communication_tenant", label: "Tenant" },
  { id: "communication_investor", label: "Investor" },
];

export const SHEET_TABS: { id: SheetTab; label: string }[] = [
  ...SETTINGS_TABS,
  ...NAV_TABS_BEFORE_MANAGEMENT,
  ...MANAGEMENT_TABS,
  ...INVESTOR_TABS,
  ...COMMUNICATION_TABS,
  ...NAV_TABS_AFTER_MANAGEMENT,
];

export function isManagementTab(tab: SheetTab): boolean {
  return MANAGEMENT_TABS.some((item) => item.id === tab);
}

export function isInvestorTab(tab: SheetTab): boolean {
  return INVESTOR_TABS.some((item) => item.id === tab);
}

export function isCommunicationTab(tab: SheetTab): boolean {
  return COMMUNICATION_TABS.some((item) => item.id === tab);
}

export function isSettingsTab(tab: SheetTab): boolean {
  return (
    tab === "businesses" ||
    tab === "tenants" ||
    tab === "investors" ||
    tab === "users" ||
    tab === "sms_setup" ||
    tab === "gmail_setup"
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

export const PROPERTY_TYPE_OPTIONS = [
  "Single Family",
  "Multi-Family",
  "Condo",
  "Townhouse",
  "Commercial",
] as const;

export const PROPERTY_STATUS_OPTIONS = [
  "Occupied",
  "Vacant",
  "Under Renovation",
  "For Sale",
] as const;

const PROPERTY_COLUMN_DEFS: ColumnDef[] = [
  { key: "legal_id", label: "Legal ID", type: "text", required: true, width: "100px" },
  { key: "business_name", label: "Business", type: "business", width: "160px" },
  { key: "property_name", label: "Property Name", type: "text", required: true, width: "160px" },
  { key: "investor_name", label: "Investor", type: "investor", required: true, width: "150px" },
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
    options: [...PROPERTY_TYPE_OPTIONS],
    width: "130px",
  },
  { key: "units", label: "Units", type: "number", width: "70px" },
  { key: "bedrooms", label: "Bedrooms", type: "number", width: "80px" },
  { key: "bathrooms", label: "Bathrooms", type: "number", width: "90px" },
  { key: "sq_ft", label: "Sq Ft", type: "number", width: "80px" },
  { key: "year_built", label: "Year Built", type: "number", width: "90px" },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: [...PROPERTY_STATUS_OPTIONS],
    width: "130px",
  },
  { key: "insurance_carrier_name", label: "Insurance Carrier Name", type: "text", width: "160px" },
  { key: "insurance_policy_number", label: "Insurance Policy Number", type: "text", width: "160px" },
  { key: "attorney", label: "Attorney", type: "text", width: "150px" },
  { key: "notes", label: "Notes", type: "text", width: "200px" },
  { key: "purchase_date", label: "Purchase Date", type: "date", width: "120px" },
  { key: "purchase_price", label: "Purchase Price", type: "currency", width: "120px" },
  { key: "rehab_price", label: "Rehab Price", type: "currency", width: "120px" },
  { key: "rehab_amount", label: "Rehab Amount", type: "currency", width: "120px" },
  { key: "current_value", label: "Current Value", type: "currency", width: "120px" },
  { key: "loan_amount", label: "Loan Amount", type: "currency", width: "120px" },
  { key: "mortgage_balance", label: "Mortgage Balance", type: "currency", width: "130px" },
  { key: "monthly_mortgage", label: "Monthly Mortgage", type: "currency", width: "130px" },
  { key: "annual_property_tax", label: "Annual Property Tax", type: "currency", width: "140px" },
  { key: "annual_insurance", label: "Annual Insurance", type: "currency", width: "130px" },
  { key: "monthly_rent", label: "Monthly Rent", type: "currency", width: "120px" },
];

const PROPERTY_INFORMATION_KEYS = [
  "legal_id",
  "business_name",
  "property_name",
  "address",
  "city",
  "state",
  "zip",
  "property_type",
  "units",
  "bedrooms",
  "bathrooms",
  "sq_ft",
  "year_built",
  "lien_holder",
  "account_number",
  "insurance_carrier_name",
  "insurance_policy_number",
  "attorney",
  "status",
  "notes",
] as const;

const PROPERTY_FINANCIAL_KEYS = [
  "purchase_date",
  "purchase_price",
  "rehab_price",
  "rehab_amount",
  "current_value",
  "loan_amount",
  "mortgage_balance",
  "monthly_mortgage",
  "annual_property_tax",
  "annual_insurance",
  "monthly_rent",
] as const;

const PROPERTY_FORM_INFORMATION_KEYS = [
  "legal_id",
  "business_name",
  "property_name",
  "address",
  "city",
  "state",
  "zip",
  "property_type",
  "units",
  "bedrooms",
  "bathrooms",
  "sq_ft",
  "year_built",
  "investor_name",
  "lien_holder",
  "account_number",
  "insurance_carrier_name",
  "insurance_policy_number",
  "attorney",
  "status",
  "notes",
] as const;

export const PROPERTY_COLUMNS = orderColumnsByKeys(
  [...PROPERTY_INFORMATION_KEYS, ...PROPERTY_FINANCIAL_KEYS],
  PROPERTY_COLUMN_DEFS
);

export function getPropertyFormSections(): {
  informationColumns: ColumnDef[];
  financialColumns: ColumnDef[];
} {
  return {
    informationColumns: orderColumnsByKeys(PROPERTY_FORM_INFORMATION_KEYS, PROPERTY_COLUMN_DEFS),
    financialColumns: orderColumnsByKeys(PROPERTY_FINANCIAL_KEYS, PROPERTY_COLUMN_DEFS),
  };
}

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
  { key: "property_name", label: "Properties", type: "property", width: "180px" },
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

const INVESTOR_CAPITAL_COLUMN_DEFS: ColumnDef[] = [
  { key: "payout_id", label: "Capital ID", type: "text", width: "100px" },
  { key: "date", label: "Date", type: "date", required: true, width: "110px" },
  { key: "business_name", label: "Business", type: "business", required: true, width: "160px" },
  { key: "business_address", label: "Business Address", type: "text", width: "200px" },
  { key: "property_name", label: "Property", type: "property", required: true, width: "150px" },
  { key: "property_address", label: "Property Address", type: "text", width: "180px" },
  { key: "investor_name", label: "Investor", type: "investor", required: true, width: "150px" },
  { key: "loan_date", label: "Loan Date", type: "date", width: "110px" },
  { key: "sell_estimate_date", label: "Sell Estimate", type: "date", width: "120px" },
  { key: "attorney", label: "Attorney", type: "text", width: "130px" },
  { key: "amount_loaned", label: "Capital Received", type: "currency", width: "120px" },
  { key: "annual_interest_rate", label: "12-Mo Rate", type: "percent", width: "100px" },
  { key: "kicker", label: "Kicker", type: "currency", width: "100px" },
  { key: "days_in_year", label: "Days in Year", type: "number", width: "100px" },
  { key: "notes", label: "Notes", type: "text", width: "200px" },
];

const INVESTOR_CAPITAL_INPUT_KEYS = [
  "date",
  "property_name",
  "business_name",
  "investor_name",
  "loan_date",
  "sell_estimate_date",
  "attorney",
  "amount_loaned",
  "annual_interest_rate",
  "kicker",
  "days_in_year",
  "notes",
] as const;

const INVESTOR_CAPITAL_AUTO_KEYS = [
  "payout_id",
  "business_address",
  "property_address",
] as const;

const INVESTOR_PAYOUT_COLUMN_DEFS: ColumnDef[] = [
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

const INVESTOR_PAYOUT_INPUT_KEYS = [
  "capital_id",
  "date",
  "payout_type",
  "payout_amount",
  "payment_method",
  "payment_date",
  "tax_year",
  "status",
  "notes",
] as const;

const INVESTOR_PAYOUT_AUTO_KEYS = ["payout_id", "property_name", "investor_name"] as const;

function orderColumnsByKeys(keys: readonly string[], columns: ColumnDef[]): ColumnDef[] {
  const byKey = new Map(columns.map((column) => [column.key, column]));
  return keys
    .map((key) => byKey.get(key))
    .filter((column): column is ColumnDef => column != null);
}

export const INVESTOR_CAPITAL_COLUMNS = orderColumnsByKeys(
  [...INVESTOR_CAPITAL_INPUT_KEYS, ...INVESTOR_CAPITAL_AUTO_KEYS],
  INVESTOR_CAPITAL_COLUMN_DEFS
);

export const INVESTOR_PAYOUT_COLUMNS = orderColumnsByKeys(
  [...INVESTOR_PAYOUT_INPUT_KEYS, ...INVESTOR_PAYOUT_AUTO_KEYS],
  INVESTOR_PAYOUT_COLUMN_DEFS
);

export function getInvestorFormSections(tab: "investor_capital" | "investor_payout"): {
  inputColumns: ColumnDef[];
  autoColumns: ColumnDef[];
} {
  if (tab === "investor_capital") {
    return {
      inputColumns: orderColumnsByKeys(INVESTOR_CAPITAL_INPUT_KEYS, INVESTOR_CAPITAL_COLUMN_DEFS),
      autoColumns: orderColumnsByKeys(INVESTOR_CAPITAL_AUTO_KEYS, INVESTOR_CAPITAL_COLUMN_DEFS),
    };
  }
  return {
    inputColumns: orderColumnsByKeys(INVESTOR_PAYOUT_INPUT_KEYS, INVESTOR_PAYOUT_COLUMN_DEFS),
    autoColumns: orderColumnsByKeys(INVESTOR_PAYOUT_AUTO_KEYS, INVESTOR_PAYOUT_COLUMN_DEFS),
  };
}

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
    case "available":
    case "dashboard":
    case "reports":
    case "communication_tenant":
    case "communication_investor":
    case "sms_setup":
      return [];
    default:
      return [];
  }
}