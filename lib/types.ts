export type SheetTab =
  | "dashboard"
  | "properties"
  | "tenants"
  | "leases"
  | "rent_ledger"
  | "expenses"
  | "maintenance"
  | "investor_payout"
  | "reports";

export interface Property {
  id: number;
  legal_id: string;
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
  current_value: number | null;
  mortgage_balance: number | null;
  monthly_mortgage: number | null;
  annual_property_tax: number | null;
  annual_insurance: number | null;
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

export interface InvestorPayout {
  id: number;
  payout_id: string;
  date: string;
  property_name: string;
  investor_name: string;
  payout_type: string;
  payout_amount: number;
  payment_method: string | null;
  payment_date: string | null;
  tax_year: number | null;
  status: string;
  notes: string | null;
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