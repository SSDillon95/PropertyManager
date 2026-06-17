export type SheetTab =
  | "dashboard"
  | "businesses"
  | "properties"
  | "tenants"
  | "leases"
  | "rent_ledger"
  | "expenses"
  | "maintenance"
  | "communication"
  | "investors"
  | "investor_capital"
  | "investor_payout"
  | "reports"
  | "users";

export type UserRole = "admin" | "standard";

export interface SessionUser {
  username: string;
  role: UserRole;
}

export interface AppUser {
  id: number;
  username: string;
  role: UserRole;
  status: string;
  created_at: string;
}

export interface Business {
  id: number;
  business_id: string;
  business_name: string;
  entity_type: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  status: string;
  notes: string | null;
  created_at: string;
}

export interface Property {
  id: number;
  legal_id: string;
  business_name: string | null;
  property_name: string;
  lien_holder: string | null;
  account_number: string | null;
  address: string;
  city: string;
  state: string;
  zip: string;
  property_type: string;
  units: number;
  bedrooms: number | null;
  bathrooms: number | null;
  sq_ft: number | null;
  year_built: number | null;
  purchase_date: string | null;
  purchase_price: number | null;
  rehab_amount: number | null;
  rehab_price: number | null;
  current_value: number | null;
  loan_amount: number | null;
  mortgage_balance: number | null;
  monthly_mortgage: number | null;
  annual_property_tax: number | null;
  annual_insurance: number | null;
  insurance_carrier_name: string | null;
  insurance_policy_number: string | null;
  attorney: string | null;
  monthly_hoa: number | null;
  monthly_rent: number | null;
  status: string;
  notes: string | null;
  created_at: string;
}

export interface Tenant {
  id: number;
  tenant_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  emergency_contact: string | null;
  emergency_phone: string | null;
  property_name: string | null;
  unit: string | null;
  move_in_date: string | null;
  move_out_date: string | null;
  status: string;
  notes: string | null;
  created_at: string;
}

export interface Lease {
  id: number;
  lease_id: string;
  property_name: string;
  unit: string | null;
  tenant_name: string;
  lease_start: string;
  lease_end: string | null;
  monthly_rent: number;
  security_deposit: number | null;
  pet_deposit: number | null;
  lease_type: string;
  status: string;
  renewal_date: string | null;
  notes: string | null;
  created_at: string;
}

export interface RentPayment {
  id: number;
  date: string;
  property_name: string;
  unit: string | null;
  tenant_name: string;
  rent_due: number;
  amount_paid: number;
  payment_date: string | null;
  payment_method: string | null;
  late_fee: number | null;
  balance: number | null;
  status: string;
  notes: string | null;
  created_at: string;
}

export interface Expense {
  id: number;
  date: string;
  property_name: string;
  category: string;
  vendor: string | null;
  description: string | null;
  amount: number;
  payment_method: string | null;
  receipt_number: string | null;
  notes: string | null;
  created_at: string;
}

export interface MaintenanceRecord {
  id: number;
  date_reported: string;
  property_name: string;
  unit: string | null;
  category: string;
  description: string;
  priority: string;
  status: string;
  vendor: string | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  date_completed: string | null;
  notes: string | null;
  created_at: string;
}

export interface Investor {
  id: number;
  investor_id: string;
  investor_name: string;
  email: string | null;
  phone: string | null;
  entity_type: string;
  tax_id: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  property_name: string | null;
  ownership_pct: number | null;
  status: string;
  notes: string | null;
  created_at: string;
}

export type InvestorRecordKind = "capital" | "payout";

export interface InvestorPayout {
  id: number;
  record_kind: InvestorRecordKind;
  capital_id: string | null;
  payout_seq: number | null;
  payout_id: string;
  date: string;
  business_name: string | null;
  business_address: string | null;
  property_name: string;
  property_address: string | null;
  loan_date: string | null;
  sell_estimate_date: string | null;
  investor_name: string;
  attorney: string | null;
  amount_loaned: number | null;
  annual_interest_rate: number | null;
  kicker: number | null;
  days_in_year: number | null;
  payout_type: string;
  payout_amount: number;
  payment_method: string | null;
  payment_date: string | null;
  tax_year: number | null;
  status: string;
  notes: string | null;
  created_at: string;
}

export type SmsDirection = "inbound" | "outbound";
export type SmsMessageType =
  | "general"
  | "rent_reminder"
  | "maintenance"
  | "maintenance_reply";
export type SmsStatus = "queued" | "sent" | "delivered" | "failed" | "received";
export type SmsRelatedType = "rent_payment" | "maintenance" | null;

export interface SmsMessage {
  id: number;
  direction: SmsDirection;
  tenant_id: number | null;
  tenant_name: string | null;
  property_name: string | null;
  phone_number: string;
  body: string;
  message_type: SmsMessageType;
  status: SmsStatus;
  external_id: string | null;
  related_id: number | null;
  related_type: SmsRelatedType;
  error_message: string | null;
  created_at: string;
}

export interface DashboardSummary {
  total_properties: number;
  active_tenants: number;
  active_leases: number;
  monthly_rent_expected: number;
  monthly_rent_collected: number;
  open_maintenance: number;
  monthly_expenses: number;
}