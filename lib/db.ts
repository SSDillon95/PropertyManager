import type {
  DashboardSummary,
  Expense,
  Lease,
  MaintenanceRecord,
  Property,
  RentPayment,
  Tenant,
} from "./types";

function getPostgresUrl(): string | undefined {
  return (
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL_NON_POOLING
  );
}

const usePostgres = Boolean(getPostgresUrl());
let schemaReady: Promise<void> | null = null;

function ensureSchema(): Promise<void> {
  if (!schemaReady) schemaReady = initSchema();
  return schemaReady;
}

const SQLITE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS properties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_id TEXT NOT NULL UNIQUE,
    property_name TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    zip TEXT NOT NULL,
    property_type TEXT DEFAULT 'Single Family',
    units INTEGER DEFAULT 1,
    bedrooms REAL,
    bathrooms REAL,
    sq_ft INTEGER,
    year_built INTEGER,
    purchase_date TEXT,
    purchase_price REAL,
    current_value REAL,
    mortgage_balance REAL,
    monthly_mortgage REAL,
    annual_property_tax REAL,
    annual_insurance REAL,
    monthly_hoa REAL,
    monthly_rent REAL,
    status TEXT DEFAULT 'Vacant',
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tenants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    emergency_contact TEXT,
    emergency_phone TEXT,
    property_name TEXT,
    unit TEXT,
    move_in_date TEXT,
    move_out_date TEXT,
    status TEXT DEFAULT 'Active',
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS leases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lease_id TEXT NOT NULL UNIQUE,
    property_name TEXT NOT NULL,
    unit TEXT,
    tenant_name TEXT NOT NULL,
    lease_start TEXT NOT NULL,
    lease_end TEXT,
    monthly_rent REAL NOT NULL,
    security_deposit REAL,
    pet_deposit REAL,
    lease_type TEXT DEFAULT 'Fixed Term',
    status TEXT DEFAULT 'Active',
    renewal_date TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS rent_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    property_name TEXT NOT NULL,
    unit TEXT,
    tenant_name TEXT NOT NULL,
    rent_due REAL NOT NULL,
    amount_paid REAL NOT NULL,
    payment_date TEXT,
    payment_method TEXT,
    late_fee REAL,
    balance REAL,
    status TEXT DEFAULT 'Pending',
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    property_name TEXT NOT NULL,
    category TEXT NOT NULL,
    vendor TEXT,
    description TEXT,
    amount REAL NOT NULL,
    payment_method TEXT,
    receipt_number TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS maintenance_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date_reported TEXT NOT NULL,
    property_name TEXT NOT NULL,
    unit TEXT,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    priority TEXT DEFAULT 'Medium',
    status TEXT DEFAULT 'Open',
    vendor TEXT,
    estimated_cost REAL,
    actual_cost REAL,
    date_completed TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

async function initSchema(): Promise<void> {
  if (usePostgres) {
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(getPostgresUrl()!);
    await sql`
      CREATE TABLE IF NOT EXISTS properties (
        id SERIAL PRIMARY KEY,
        property_id TEXT NOT NULL UNIQUE,
        property_name TEXT NOT NULL,
        address TEXT NOT NULL,
        city TEXT NOT NULL,
        state TEXT NOT NULL,
        zip TEXT NOT NULL,
        property_type TEXT DEFAULT 'Single Family',
        units INTEGER DEFAULT 1,
        bedrooms REAL,
        bathrooms REAL,
        sq_ft INTEGER,
        year_built INTEGER,
        purchase_date TEXT,
        purchase_price REAL,
        current_value REAL,
        mortgage_balance REAL,
        monthly_mortgage REAL,
        annual_property_tax REAL,
        annual_insurance REAL,
        monthly_hoa REAL,
        monthly_rent REAL,
        status TEXT DEFAULT 'Vacant',
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`ALTER TABLE properties ADD COLUMN IF NOT EXISTS monthly_rent REAL`;
    await sql`
      CREATE TABLE IF NOT EXISTS tenants (
        id SERIAL PRIMARY KEY,
        tenant_id TEXT NOT NULL UNIQUE,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        emergency_contact TEXT,
        emergency_phone TEXT,
        property_name TEXT,
        unit TEXT,
        move_in_date TEXT,
        move_out_date TEXT,
        status TEXT DEFAULT 'Active',
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS leases (
        id SERIAL PRIMARY KEY,
        lease_id TEXT NOT NULL UNIQUE,
        property_name TEXT NOT NULL,
        unit TEXT,
        tenant_name TEXT NOT NULL,
        lease_start TEXT NOT NULL,
        lease_end TEXT,
        monthly_rent REAL NOT NULL,
        security_deposit REAL,
        pet_deposit REAL,
        lease_type TEXT DEFAULT 'Fixed Term',
        status TEXT DEFAULT 'Active',
        renewal_date TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS rent_payments (
        id SERIAL PRIMARY KEY,
        date TEXT NOT NULL,
        property_name TEXT NOT NULL,
        unit TEXT,
        tenant_name TEXT NOT NULL,
        rent_due REAL NOT NULL,
        amount_paid REAL NOT NULL,
        payment_date TEXT,
        payment_method TEXT,
        late_fee REAL,
        balance REAL,
        status TEXT DEFAULT 'Pending',
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY,
        date TEXT NOT NULL,
        property_name TEXT NOT NULL,
        category TEXT NOT NULL,
        vendor TEXT,
        description TEXT,
        amount REAL NOT NULL,
        payment_method TEXT,
        receipt_number TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS maintenance_records (
        id SERIAL PRIMARY KEY,
        date_reported TEXT NOT NULL,
        property_name TEXT NOT NULL,
        unit TEXT,
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        priority TEXT DEFAULT 'Medium',
        status TEXT DEFAULT 'Open',
        vendor TEXT,
        estimated_cost REAL,
        actual_cost REAL,
        date_completed TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    return;
  }

  const Database = (await import("better-sqlite3")).default;
  const fs = await import("fs");
  const path = await import("path");
  const dataDir =
    process.env.VERCEL === "1" ? "/tmp" : path.join(process.cwd(), "data");
  const dbPath = path.join(dataDir, "propertymanager.db");
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new Database(dbPath);
  db.exec(SQLITE_SCHEMA);
  const propertyCols = db.pragma("table_info(properties)") as { name: string }[];
  if (!propertyCols.some((c) => c.name === "monthly_rent")) {
    db.exec("ALTER TABLE properties ADD COLUMN monthly_rent REAL");
  }
  db.close();
}

async function getSqliteDb() {
  const Database = (await import("better-sqlite3")).default;
  const fs = await import("fs");
  const path = await import("path");
  const dataDir =
    process.env.VERCEL === "1" ? "/tmp" : path.join(process.cwd(), "data");
  const dbPath = path.join(dataDir, "propertymanager.db");
  fs.mkdirSync(dataDir, { recursive: true });
  return new Database(dbPath);
}

async function getPostgresSql() {
  const { neon } = await import("@neondatabase/serverless");
  return neon(getPostgresUrl()!);
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s || null;
}

function mapProperty(row: Record<string, unknown>): Property {
  return {
    id: Number(row.id),
    property_id: String(row.property_id),
    property_name: String(row.property_name),
    address: String(row.address),
    city: String(row.city),
    state: String(row.state),
    zip: String(row.zip),
    property_type: String(row.property_type ?? "Single Family"),
    units: Number(row.units ?? 1),
    bedrooms: num(row.bedrooms),
    bathrooms: num(row.bathrooms),
    sq_ft: num(row.sq_ft),
    year_built: num(row.year_built),
    purchase_date: str(row.purchase_date),
    purchase_price: num(row.purchase_price),
    current_value: num(row.current_value),
    mortgage_balance: num(row.mortgage_balance),
    monthly_mortgage: num(row.monthly_mortgage),
    annual_property_tax: num(row.annual_property_tax),
    annual_insurance: num(row.annual_insurance),
    monthly_hoa: num(row.monthly_hoa),
    monthly_rent: num(row.monthly_rent),
    status: String(row.status ?? "Vacant"),
    notes: str(row.notes),
    created_at: String(row.created_at),
  };
}

function mapTenant(row: Record<string, unknown>): Tenant {
  return {
    id: Number(row.id),
    tenant_id: String(row.tenant_id),
    first_name: String(row.first_name),
    last_name: String(row.last_name),
    email: str(row.email),
    phone: str(row.phone),
    emergency_contact: str(row.emergency_contact),
    emergency_phone: str(row.emergency_phone),
    property_name: str(row.property_name),
    unit: str(row.unit),
    move_in_date: str(row.move_in_date),
    move_out_date: str(row.move_out_date),
    status: String(row.status ?? "Active"),
    notes: str(row.notes),
    created_at: String(row.created_at),
  };
}

function mapLease(row: Record<string, unknown>): Lease {
  return {
    id: Number(row.id),
    lease_id: String(row.lease_id),
    property_name: String(row.property_name),
    unit: str(row.unit),
    tenant_name: String(row.tenant_name),
    lease_start: String(row.lease_start),
    lease_end: str(row.lease_end),
    monthly_rent: Number(row.monthly_rent),
    security_deposit: num(row.security_deposit),
    pet_deposit: num(row.pet_deposit),
    lease_type: String(row.lease_type ?? "Fixed Term"),
    status: String(row.status ?? "Active"),
    renewal_date: str(row.renewal_date),
    notes: str(row.notes),
    created_at: String(row.created_at),
  };
}

function mapRentPayment(row: Record<string, unknown>): RentPayment {
  return {
    id: Number(row.id),
    date: String(row.date),
    property_name: String(row.property_name),
    unit: str(row.unit),
    tenant_name: String(row.tenant_name),
    rent_due: Number(row.rent_due),
    amount_paid: Number(row.amount_paid),
    payment_date: str(row.payment_date),
    payment_method: str(row.payment_method),
    late_fee: num(row.late_fee),
    balance: num(row.balance),
    status: String(row.status ?? "Pending"),
    notes: str(row.notes),
    created_at: String(row.created_at),
  };
}

function mapExpense(row: Record<string, unknown>): Expense {
  return {
    id: Number(row.id),
    date: String(row.date),
    property_name: String(row.property_name),
    category: String(row.category),
    vendor: str(row.vendor),
    description: str(row.description),
    amount: Number(row.amount),
    payment_method: str(row.payment_method),
    receipt_number: str(row.receipt_number),
    notes: str(row.notes),
    created_at: String(row.created_at),
  };
}

function mapMaintenance(row: Record<string, unknown>): MaintenanceRecord {
  return {
    id: Number(row.id),
    date_reported: String(row.date_reported),
    property_name: String(row.property_name),
    unit: str(row.unit),
    category: String(row.category),
    description: String(row.description),
    priority: String(row.priority ?? "Medium"),
    status: String(row.status ?? "Open"),
    vendor: str(row.vendor),
    estimated_cost: num(row.estimated_cost),
    actual_cost: num(row.actual_cost),
    date_completed: str(row.date_completed),
    notes: str(row.notes),
    created_at: String(row.created_at),
  };
}

export async function listProperties(): Promise<Property[]> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    const rows = await sql`SELECT * FROM properties ORDER BY property_name`;
    return rows.map((r) => mapProperty(r as Record<string, unknown>));
  }
  const db = await getSqliteDb();
  const rows = db.prepare("SELECT * FROM properties ORDER BY property_name").all();
  db.close();
  return rows.map((r) => mapProperty(r as Record<string, unknown>));
}

export async function createProperty(
  data: Omit<Property, "id" | "created_at">
): Promise<Property> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    const rows = await sql`
      INSERT INTO properties (
        property_id, property_name, address, city, state, zip, property_type,
        units, bedrooms, bathrooms, sq_ft, year_built, purchase_date,
        purchase_price, current_value, mortgage_balance, monthly_mortgage,
        annual_property_tax, annual_insurance, monthly_hoa, monthly_rent, status, notes
      ) VALUES (
        ${data.property_id}, ${data.property_name}, ${data.address}, ${data.city},
        ${data.state}, ${data.zip}, ${data.property_type}, ${data.units},
        ${data.bedrooms}, ${data.bathrooms}, ${data.sq_ft}, ${data.year_built},
        ${data.purchase_date}, ${data.purchase_price}, ${data.current_value},
        ${data.mortgage_balance}, ${data.monthly_mortgage}, ${data.annual_property_tax},
        ${data.annual_insurance}, ${data.monthly_hoa}, ${data.monthly_rent}, ${data.status}, ${data.notes}
      ) RETURNING *
    `;
    return mapProperty(rows[0] as Record<string, unknown>);
  }
  const db = await getSqliteDb();
  const row = db
    .prepare(
      `INSERT INTO properties (
        property_id, property_name, address, city, state, zip, property_type,
        units, bedrooms, bathrooms, sq_ft, year_built, purchase_date,
        purchase_price, current_value, mortgage_balance, monthly_mortgage,
        annual_property_tax, annual_insurance, monthly_hoa, monthly_rent, status, notes
      ) VALUES (
        @property_id, @property_name, @address, @city, @state, @zip, @property_type,
        @units, @bedrooms, @bathrooms, @sq_ft, @year_built, @purchase_date,
        @purchase_price, @current_value, @mortgage_balance, @monthly_mortgage,
        @annual_property_tax, @annual_insurance, @monthly_hoa, @monthly_rent, @status, @notes
      ) RETURNING *`
    )
    .get(data);
  db.close();
  return mapProperty(row as Record<string, unknown>);
}

export async function deleteProperty(id: number): Promise<void> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    await sql`DELETE FROM properties WHERE id = ${id}`;
    return;
  }
  const db = await getSqliteDb();
  db.prepare("DELETE FROM properties WHERE id = ?").run(id);
  db.close();
}

export async function listTenants(): Promise<Tenant[]> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    const rows = await sql`SELECT * FROM tenants ORDER BY last_name, first_name`;
    return rows.map((r) => mapTenant(r as Record<string, unknown>));
  }
  const db = await getSqliteDb();
  const rows = db
    .prepare("SELECT * FROM tenants ORDER BY last_name, first_name")
    .all();
  db.close();
  return rows.map((r) => mapTenant(r as Record<string, unknown>));
}

export async function createTenant(
  data: Omit<Tenant, "id" | "created_at">
): Promise<Tenant> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    const rows = await sql`
      INSERT INTO tenants (
        tenant_id, first_name, last_name, email, phone, emergency_contact,
        emergency_phone, property_name, unit, move_in_date, move_out_date, status, notes
      ) VALUES (
        ${data.tenant_id}, ${data.first_name}, ${data.last_name}, ${data.email},
        ${data.phone}, ${data.emergency_contact}, ${data.emergency_phone},
        ${data.property_name}, ${data.unit}, ${data.move_in_date}, ${data.move_out_date},
        ${data.status}, ${data.notes}
      ) RETURNING *
    `;
    return mapTenant(rows[0] as Record<string, unknown>);
  }
  const db = await getSqliteDb();
  const row = db
    .prepare(
      `INSERT INTO tenants (
        tenant_id, first_name, last_name, email, phone, emergency_contact,
        emergency_phone, property_name, unit, move_in_date, move_out_date, status, notes
      ) VALUES (
        @tenant_id, @first_name, @last_name, @email, @phone, @emergency_contact,
        @emergency_phone, @property_name, @unit, @move_in_date, @move_out_date,
        @status, @notes
      ) RETURNING *`
    )
    .get(data);
  db.close();
  return mapTenant(row as Record<string, unknown>);
}

export async function deleteTenant(id: number): Promise<void> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    await sql`DELETE FROM tenants WHERE id = ${id}`;
    return;
  }
  const db = await getSqliteDb();
  db.prepare("DELETE FROM tenants WHERE id = ?").run(id);
  db.close();
}

export async function listLeases(): Promise<Lease[]> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    const rows = await sql`SELECT * FROM leases ORDER BY lease_start DESC`;
    return rows.map((r) => mapLease(r as Record<string, unknown>));
  }
  const db = await getSqliteDb();
  const rows = db.prepare("SELECT * FROM leases ORDER BY lease_start DESC").all();
  db.close();
  return rows.map((r) => mapLease(r as Record<string, unknown>));
}

export async function createLease(
  data: Omit<Lease, "id" | "created_at">
): Promise<Lease> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    const rows = await sql`
      INSERT INTO leases (
        lease_id, property_name, unit, tenant_name, lease_start, lease_end,
        monthly_rent, security_deposit, pet_deposit, lease_type, status, renewal_date, notes
      ) VALUES (
        ${data.lease_id}, ${data.property_name}, ${data.unit}, ${data.tenant_name},
        ${data.lease_start}, ${data.lease_end}, ${data.monthly_rent}, ${data.security_deposit},
        ${data.pet_deposit}, ${data.lease_type}, ${data.status}, ${data.renewal_date}, ${data.notes}
      ) RETURNING *
    `;
    return mapLease(rows[0] as Record<string, unknown>);
  }
  const db = await getSqliteDb();
  const row = db
    .prepare(
      `INSERT INTO leases (
        lease_id, property_name, unit, tenant_name, lease_start, lease_end,
        monthly_rent, security_deposit, pet_deposit, lease_type, status, renewal_date, notes
      ) VALUES (
        @lease_id, @property_name, @unit, @tenant_name, @lease_start, @lease_end,
        @monthly_rent, @security_deposit, @pet_deposit, @lease_type, @status, @renewal_date, @notes
      ) RETURNING *`
    )
    .get(data);
  db.close();
  return mapLease(row as Record<string, unknown>);
}

export async function deleteLease(id: number): Promise<void> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    await sql`DELETE FROM leases WHERE id = ${id}`;
    return;
  }
  const db = await getSqliteDb();
  db.prepare("DELETE FROM leases WHERE id = ?").run(id);
  db.close();
}

export async function listRentPayments(): Promise<RentPayment[]> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    const rows = await sql`SELECT * FROM rent_payments ORDER BY date DESC`;
    return rows.map((r) => mapRentPayment(r as Record<string, unknown>));
  }
  const db = await getSqliteDb();
  const rows = db.prepare("SELECT * FROM rent_payments ORDER BY date DESC").all();
  db.close();
  return rows.map((r) => mapRentPayment(r as Record<string, unknown>));
}

export async function createRentPayment(
  data: Omit<RentPayment, "id" | "created_at">
): Promise<RentPayment> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    const rows = await sql`
      INSERT INTO rent_payments (
        date, property_name, unit, tenant_name, rent_due, amount_paid,
        payment_date, payment_method, late_fee, balance, status, notes
      ) VALUES (
        ${data.date}, ${data.property_name}, ${data.unit}, ${data.tenant_name},
        ${data.rent_due}, ${data.amount_paid}, ${data.payment_date}, ${data.payment_method},
        ${data.late_fee}, ${data.balance}, ${data.status}, ${data.notes}
      ) RETURNING *
    `;
    return mapRentPayment(rows[0] as Record<string, unknown>);
  }
  const db = await getSqliteDb();
  const row = db
    .prepare(
      `INSERT INTO rent_payments (
        date, property_name, unit, tenant_name, rent_due, amount_paid,
        payment_date, payment_method, late_fee, balance, status, notes
      ) VALUES (
        @date, @property_name, @unit, @tenant_name, @rent_due, @amount_paid,
        @payment_date, @payment_method, @late_fee, @balance, @status, @notes
      ) RETURNING *`
    )
    .get(data);
  db.close();
  return mapRentPayment(row as Record<string, unknown>);
}

export async function deleteRentPayment(id: number): Promise<void> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    await sql`DELETE FROM rent_payments WHERE id = ${id}`;
    return;
  }
  const db = await getSqliteDb();
  db.prepare("DELETE FROM rent_payments WHERE id = ?").run(id);
  db.close();
}

export async function listExpenses(): Promise<Expense[]> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    const rows = await sql`SELECT * FROM expenses ORDER BY date DESC`;
    return rows.map((r) => mapExpense(r as Record<string, unknown>));
  }
  const db = await getSqliteDb();
  const rows = db.prepare("SELECT * FROM expenses ORDER BY date DESC").all();
  db.close();
  return rows.map((r) => mapExpense(r as Record<string, unknown>));
}

export async function createExpense(
  data: Omit<Expense, "id" | "created_at">
): Promise<Expense> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    const rows = await sql`
      INSERT INTO expenses (
        date, property_name, category, vendor, description, amount,
        payment_method, receipt_number, notes
      ) VALUES (
        ${data.date}, ${data.property_name}, ${data.category}, ${data.vendor},
        ${data.description}, ${data.amount}, ${data.payment_method},
        ${data.receipt_number}, ${data.notes}
      ) RETURNING *
    `;
    return mapExpense(rows[0] as Record<string, unknown>);
  }
  const db = await getSqliteDb();
  const row = db
    .prepare(
      `INSERT INTO expenses (
        date, property_name, category, vendor, description, amount,
        payment_method, receipt_number, notes
      ) VALUES (
        @date, @property_name, @category, @vendor, @description, @amount,
        @payment_method, @receipt_number, @notes
      ) RETURNING *`
    )
    .get(data);
  db.close();
  return mapExpense(row as Record<string, unknown>);
}

export async function deleteExpense(id: number): Promise<void> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    await sql`DELETE FROM expenses WHERE id = ${id}`;
    return;
  }
  const db = await getSqliteDb();
  db.prepare("DELETE FROM expenses WHERE id = ?").run(id);
  db.close();
}

export async function listMaintenance(): Promise<MaintenanceRecord[]> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    const rows = await sql`SELECT * FROM maintenance_records ORDER BY date_reported DESC`;
    return rows.map((r) => mapMaintenance(r as Record<string, unknown>));
  }
  const db = await getSqliteDb();
  const rows = db
    .prepare("SELECT * FROM maintenance_records ORDER BY date_reported DESC")
    .all();
  db.close();
  return rows.map((r) => mapMaintenance(r as Record<string, unknown>));
}

export async function createMaintenance(
  data: Omit<MaintenanceRecord, "id" | "created_at">
): Promise<MaintenanceRecord> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    const rows = await sql`
      INSERT INTO maintenance_records (
        date_reported, property_name, unit, category, description, priority,
        status, vendor, estimated_cost, actual_cost, date_completed, notes
      ) VALUES (
        ${data.date_reported}, ${data.property_name}, ${data.unit}, ${data.category},
        ${data.description}, ${data.priority}, ${data.status}, ${data.vendor},
        ${data.estimated_cost}, ${data.actual_cost}, ${data.date_completed}, ${data.notes}
      ) RETURNING *
    `;
    return mapMaintenance(rows[0] as Record<string, unknown>);
  }
  const db = await getSqliteDb();
  const row = db
    .prepare(
      `INSERT INTO maintenance_records (
        date_reported, property_name, unit, category, description, priority,
        status, vendor, estimated_cost, actual_cost, date_completed, notes
      ) VALUES (
        @date_reported, @property_name, @unit, @category, @description, @priority,
        @status, @vendor, @estimated_cost, @actual_cost, @date_completed, @notes
      ) RETURNING *`
    )
    .get(data);
  db.close();
  return mapMaintenance(row as Record<string, unknown>);
}

export async function deleteMaintenance(id: number): Promise<void> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    await sql`DELETE FROM maintenance_records WHERE id = ${id}`;
    return;
  }
  const db = await getSqliteDb();
  db.prepare("DELETE FROM maintenance_records WHERE id = ?").run(id);
  db.close();
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  await ensureSchema();
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  if (usePostgres) {
    const sql = await getPostgresSql();
    const [props, tenants, leases, rentExpected, rentCollected, maint, exp] =
      await Promise.all([
        sql`SELECT COUNT(*)::int AS c FROM properties`,
        sql`SELECT COUNT(*)::int AS c FROM tenants WHERE status = 'Active'`,
        sql`SELECT COUNT(*)::int AS c FROM leases WHERE status = 'Active'`,
        sql`
          SELECT COALESCE(SUM(monthly_rent), 0)::float AS total
          FROM leases WHERE status = 'Active'
        `,
        sql`
          SELECT COALESCE(SUM(amount_paid), 0)::float AS total
          FROM rent_payments
          WHERE date >= ${monthStart} AND status IN ('Paid', 'Partial')
        `,
        sql`
          SELECT COUNT(*)::int AS c FROM maintenance_records
          WHERE status IN ('Open', 'In Progress')
        `,
        sql`
          SELECT COALESCE(SUM(amount), 0)::float AS total
          FROM expenses WHERE date >= ${monthStart}
        `,
      ]);
    return {
      total_properties: Number(props[0]?.c ?? 0),
      active_tenants: Number(tenants[0]?.c ?? 0),
      active_leases: Number(leases[0]?.c ?? 0),
      monthly_rent_expected: Number(rentExpected[0]?.total ?? 0),
      monthly_rent_collected: Number(rentCollected[0]?.total ?? 0),
      open_maintenance: Number(maint[0]?.c ?? 0),
      monthly_expenses: Number(exp[0]?.total ?? 0),
    };
  }

  const db = await getSqliteDb();
  const total_properties = (
    db.prepare("SELECT COUNT(*) AS c FROM properties").get() as { c: number }
  ).c;
  const active_tenants = (
    db
      .prepare("SELECT COUNT(*) AS c FROM tenants WHERE status = 'Active'")
      .get() as { c: number }
  ).c;
  const active_leases = (
    db
      .prepare("SELECT COUNT(*) AS c FROM leases WHERE status = 'Active'")
      .get() as { c: number }
  ).c;
  const monthly_rent_expected = (
    db
      .prepare(
        "SELECT COALESCE(SUM(monthly_rent), 0) AS total FROM leases WHERE status = 'Active'"
      )
      .get() as { total: number }
  ).total;
  const monthly_rent_collected = (
    db
      .prepare(
        `SELECT COALESCE(SUM(amount_paid), 0) AS total FROM rent_payments
         WHERE date >= ? AND status IN ('Paid', 'Partial')`
      )
      .get(monthStart) as { total: number }
  ).total;
  const open_maintenance = (
    db
      .prepare(
        `SELECT COUNT(*) AS c FROM maintenance_records
         WHERE status IN ('Open', 'In Progress')`
      )
      .get() as { c: number }
  ).c;
  const monthly_expenses = (
    db
      .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE date >= ?")
      .get(monthStart) as { total: number }
  ).total;
  db.close();

  return {
    total_properties,
    active_tenants,
    active_leases,
    monthly_rent_expected,
    monthly_rent_collected,
    open_maintenance,
    monthly_expenses,
  };
}