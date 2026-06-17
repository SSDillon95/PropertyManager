import { hashPassword, verifyPassword } from "./password";
import { isRecoveryUsername } from "./recovery-auth";
import { normalizePhoneNumber } from "./sms-utils";
import type {
  AppUser,
  Business,
  DashboardSummary,
  Expense,
  Investor,
  InvestorPayout,
  Lease,
  MaintenanceRecord,
  Property,
  RentPayment,
  SmsMessage,
  SmsSettings,
  Tenant,
  UserRole,
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

function assertProductionDatabase(): void {
  if (process.env.VERCEL === "1" && !getPostgresUrl()) {
    throw new Error(
      "No persistent database configured. Connect Neon Postgres to this Vercel project."
    );
  }
}

function ensureSchema(): Promise<void> {
  if (!schemaReady) schemaReady = initSchema();
  return schemaReady;
}

const SQLITE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS businesses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id TEXT NOT NULL UNIQUE,
    business_name TEXT NOT NULL,
    entity_type TEXT DEFAULT 'LLC',
    address TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,
    status TEXT DEFAULT 'Active',
    notes TEXT,
    archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS properties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    legal_id TEXT NOT NULL UNIQUE,
    business_name TEXT,
    property_name TEXT NOT NULL,
    lien_holder TEXT,
    account_number TEXT,
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
    rehab_amount REAL,
    rehab_price REAL,
    current_value REAL,
    loan_amount REAL,
    mortgage_balance REAL,
    monthly_mortgage REAL,
    annual_property_tax REAL,
    annual_insurance REAL,
    insurance_carrier_name TEXT,
    insurance_policy_number TEXT,
    attorney TEXT,
    monthly_hoa REAL,
    monthly_rent REAL,
    status TEXT DEFAULT 'Vacant',
    notes TEXT,
    entry_code TEXT,
    archived INTEGER NOT NULL DEFAULT 0,
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
    archived INTEGER NOT NULL DEFAULT 0,
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
    archived INTEGER NOT NULL DEFAULT 0,
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
    archived INTEGER NOT NULL DEFAULT 0,
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
    archived INTEGER NOT NULL DEFAULT 0,
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
    archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS investors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    investor_id TEXT NOT NULL UNIQUE,
    investor_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    entity_type TEXT DEFAULT 'Individual',
    tax_id TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,
    property_name TEXT,
    ownership_pct REAL,
    status TEXT DEFAULT 'Active',
    notes TEXT,
    archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS investor_payouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_kind TEXT NOT NULL DEFAULT 'capital',
    capital_id TEXT,
    payout_seq INTEGER,
    payout_id TEXT NOT NULL,
    date TEXT NOT NULL,
    business_name TEXT,
    business_address TEXT,
    property_name TEXT NOT NULL,
    property_address TEXT,
    loan_date TEXT,
    sell_estimate_date TEXT,
    investor_name TEXT NOT NULL,
    attorney TEXT,
    amount_loaned REAL,
    annual_interest_rate REAL,
    kicker REAL,
    days_in_year INTEGER DEFAULT 365,
    payout_type TEXT NOT NULL,
    payout_amount REAL NOT NULL,
    payment_method TEXT,
    payment_date TEXT,
    tax_year INTEGER,
    status TEXT DEFAULT 'Pending',
    notes TEXT,
    archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sms_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_type TEXT NOT NULL DEFAULT 'tenant',
    direction TEXT NOT NULL,
    tenant_id INTEGER,
    tenant_name TEXT,
    investor_id INTEGER,
    investor_name TEXT,
    property_name TEXT,
    phone_number TEXT NOT NULL,
    body TEXT NOT NULL,
    message_type TEXT NOT NULL DEFAULT 'general',
    status TEXT NOT NULL DEFAULT 'queued',
    external_id TEXT,
    related_id INTEGER,
    related_type TEXT,
    error_message TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS app_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'standard',
    status TEXT NOT NULL DEFAULT 'Active',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sms_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    account_sid TEXT,
    auth_token TEXT,
    phone_number TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sms_archived_threads (
    phone_number TEXT NOT NULL,
    contact_type TEXT NOT NULL DEFAULT 'tenant',
    archived_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (phone_number, contact_type)
  );
`;

const ARCHIVED_TABLES = [
  "businesses",
  "properties",
  "tenants",
  "leases",
  "rent_payments",
  "expenses",
  "maintenance_records",
  "investors",
  "investor_payouts",
] as const;

async function initSchema(): Promise<void> {
  assertProductionDatabase();
  if (usePostgres) {
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(getPostgresUrl()!);
    await sql`
      CREATE TABLE IF NOT EXISTS businesses (
        id SERIAL PRIMARY KEY,
        business_id TEXT NOT NULL UNIQUE,
        business_name TEXT NOT NULL,
        entity_type TEXT DEFAULT 'LLC',
        address TEXT,
        city TEXT,
        state TEXT,
        zip TEXT,
        status TEXT DEFAULT 'Active',
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS properties (
        id SERIAL PRIMARY KEY,
        legal_id TEXT NOT NULL UNIQUE,
        business_name TEXT,
        property_name TEXT NOT NULL,
        lien_holder TEXT,
        account_number TEXT,
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
        rehab_amount REAL,
        rehab_price REAL,
        current_value REAL,
        loan_amount REAL,
        mortgage_balance REAL,
        monthly_mortgage REAL,
        annual_property_tax REAL,
        annual_insurance REAL,
        insurance_carrier_name TEXT,
        insurance_policy_number TEXT,
        attorney TEXT,
        monthly_hoa REAL,
        monthly_rent REAL,
        status TEXT DEFAULT 'Vacant',
        notes TEXT,
        entry_code TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`ALTER TABLE properties ADD COLUMN IF NOT EXISTS business_name TEXT`;
    await sql`ALTER TABLE properties ADD COLUMN IF NOT EXISTS monthly_rent REAL`;
    await sql`ALTER TABLE properties ADD COLUMN IF NOT EXISTS legal_id TEXT`;
    await sql`ALTER TABLE properties ADD COLUMN IF NOT EXISTS lien_holder TEXT`;
    await sql`ALTER TABLE properties ADD COLUMN IF NOT EXISTS account_number TEXT`;
    try {
      await sql`
        UPDATE properties SET legal_id = property_id
        WHERE legal_id IS NULL AND property_id IS NOT NULL
      `;
    } catch {
      // property_id column may not exist on newer schemas
    }
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
    await sql`
      CREATE TABLE IF NOT EXISTS investors (
        id SERIAL PRIMARY KEY,
        investor_id TEXT NOT NULL UNIQUE,
        investor_name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        entity_type TEXT DEFAULT 'Individual',
        tax_id TEXT,
        address TEXT,
        city TEXT,
        state TEXT,
        zip TEXT,
        property_name TEXT,
        ownership_pct REAL,
        status TEXT DEFAULT 'Active',
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS investor_payouts (
        id SERIAL PRIMARY KEY,
        record_kind TEXT NOT NULL DEFAULT 'capital',
        capital_id TEXT,
        payout_seq INTEGER,
        payout_id TEXT NOT NULL,
        date TEXT NOT NULL,
        property_name TEXT NOT NULL,
        property_address TEXT,
        loan_date TEXT,
        sell_estimate_date TEXT,
        investor_name TEXT NOT NULL,
        attorney TEXT,
        amount_loaned REAL,
        annual_interest_rate REAL,
        kicker REAL,
        days_in_year INTEGER DEFAULT 365,
        payout_type TEXT NOT NULL,
        payout_amount REAL NOT NULL,
        payment_method TEXT,
        payment_date TEXT,
        tax_year INTEGER,
        status TEXT DEFAULT 'Pending',
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`ALTER TABLE investor_payouts ADD COLUMN IF NOT EXISTS property_address TEXT`;
    await sql`ALTER TABLE investor_payouts ADD COLUMN IF NOT EXISTS loan_date TEXT`;
    await sql`ALTER TABLE investor_payouts ADD COLUMN IF NOT EXISTS sell_estimate_date TEXT`;
    await sql`ALTER TABLE investor_payouts ADD COLUMN IF NOT EXISTS attorney TEXT`;
    await sql`ALTER TABLE investor_payouts ADD COLUMN IF NOT EXISTS amount_loaned REAL`;
    await sql`ALTER TABLE investor_payouts ADD COLUMN IF NOT EXISTS annual_interest_rate REAL`;
    await sql`ALTER TABLE investor_payouts ADD COLUMN IF NOT EXISTS kicker REAL`;
    await sql`ALTER TABLE investor_payouts ADD COLUMN IF NOT EXISTS days_in_year INTEGER DEFAULT 365`;
    await sql`ALTER TABLE investor_payouts ADD COLUMN IF NOT EXISTS record_kind TEXT NOT NULL DEFAULT 'capital'`;
    await sql`ALTER TABLE investor_payouts ADD COLUMN IF NOT EXISTS capital_id TEXT`;
    await sql`ALTER TABLE investor_payouts ADD COLUMN IF NOT EXISTS payout_seq INTEGER`;
    await sql`ALTER TABLE investor_payouts ADD COLUMN IF NOT EXISTS business_name TEXT`;
    await sql`ALTER TABLE investor_payouts ADD COLUMN IF NOT EXISTS business_address TEXT`;
    await sql`UPDATE investor_payouts SET record_kind = 'capital' WHERE record_kind IS NULL`;
    await sql`ALTER TABLE investor_payouts DROP CONSTRAINT IF EXISTS investor_payouts_payout_id_key`;
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS investor_payouts_capital_id_unique
      ON investor_payouts (payout_id) WHERE record_kind = 'capital'
    `;
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS investor_payouts_capital_seq_unique
      ON investor_payouts (capital_id, payout_seq) WHERE record_kind = 'payout'
    `;
    await sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE`;
    await sql`ALTER TABLE properties ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE`;
    await sql`ALTER TABLE properties ADD COLUMN IF NOT EXISTS rehab_amount REAL`;
    await sql`ALTER TABLE properties ADD COLUMN IF NOT EXISTS rehab_price REAL`;
    await sql`ALTER TABLE properties ADD COLUMN IF NOT EXISTS loan_amount REAL`;
    await sql`ALTER TABLE properties ADD COLUMN IF NOT EXISTS insurance_carrier_name TEXT`;
    await sql`ALTER TABLE properties ADD COLUMN IF NOT EXISTS insurance_policy_number TEXT`;
    await sql`ALTER TABLE properties ADD COLUMN IF NOT EXISTS attorney TEXT`;
    await sql`ALTER TABLE properties ADD COLUMN IF NOT EXISTS entry_code TEXT`;
    await sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE`;
    await sql`ALTER TABLE leases ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE`;
    await sql`ALTER TABLE rent_payments ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE`;
    await sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE`;
    await sql`ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE`;
    await sql`ALTER TABLE investors ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE`;
    await sql`ALTER TABLE investor_payouts ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE`;
    await sql`
      CREATE TABLE IF NOT EXISTS sms_messages (
        id SERIAL PRIMARY KEY,
        direction TEXT NOT NULL,
        tenant_id INTEGER,
        tenant_name TEXT,
        property_name TEXT,
        phone_number TEXT NOT NULL,
        body TEXT NOT NULL,
        message_type TEXT NOT NULL DEFAULT 'general',
        status TEXT NOT NULL DEFAULT 'queued',
        external_id TEXT,
        related_id INTEGER,
        related_type TEXT,
        error_message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS app_users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'standard',
        status TEXT NOT NULL DEFAULT 'Active',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS sms_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        account_sid TEXT,
        auth_token TEXT,
        phone_number TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS sms_archived_threads (
        phone_number TEXT NOT NULL,
        contact_type TEXT NOT NULL DEFAULT 'tenant',
        archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (phone_number, contact_type)
      )
    `;
    await sql`ALTER TABLE sms_messages ADD COLUMN IF NOT EXISTS contact_type TEXT NOT NULL DEFAULT 'tenant'`;
    await sql`ALTER TABLE sms_messages ADD COLUMN IF NOT EXISTS investor_id INTEGER`;
    await sql`ALTER TABLE sms_messages ADD COLUMN IF NOT EXISTS investor_name TEXT`;
    await sql`ALTER TABLE sms_archived_threads ADD COLUMN IF NOT EXISTS contact_type TEXT NOT NULL DEFAULT 'tenant'`;
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
  const hasCol = (name: string) => propertyCols.some((c) => c.name === name);
  if (!hasCol("business_name")) db.exec("ALTER TABLE properties ADD COLUMN business_name TEXT");
  if (!hasCol("monthly_rent")) db.exec("ALTER TABLE properties ADD COLUMN monthly_rent REAL");
  if (!hasCol("legal_id")) db.exec("ALTER TABLE properties ADD COLUMN legal_id TEXT");
  if (!hasCol("lien_holder")) db.exec("ALTER TABLE properties ADD COLUMN lien_holder TEXT");
  if (!hasCol("account_number")) db.exec("ALTER TABLE properties ADD COLUMN account_number TEXT");
  if (!hasCol("rehab_amount")) db.exec("ALTER TABLE properties ADD COLUMN rehab_amount REAL");
  if (!hasCol("rehab_price")) db.exec("ALTER TABLE properties ADD COLUMN rehab_price REAL");
  if (!hasCol("loan_amount")) db.exec("ALTER TABLE properties ADD COLUMN loan_amount REAL");
  if (!hasCol("insurance_carrier_name")) {
    db.exec("ALTER TABLE properties ADD COLUMN insurance_carrier_name TEXT");
  }
  if (!hasCol("insurance_policy_number")) {
    db.exec("ALTER TABLE properties ADD COLUMN insurance_policy_number TEXT");
  }
  if (!hasCol("attorney")) db.exec("ALTER TABLE properties ADD COLUMN attorney TEXT");
  if (!hasCol("entry_code")) db.exec("ALTER TABLE properties ADD COLUMN entry_code TEXT");
  if (hasCol("property_id") && hasCol("legal_id")) {
    db.exec(
      "UPDATE properties SET legal_id = property_id WHERE legal_id IS NULL AND property_id IS NOT NULL"
    );
  }
  for (const table of ARCHIVED_TABLES) {
    const cols = db.pragma(`table_info(${table})`) as { name: string }[];
    if (!cols.some((c) => c.name === "archived")) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN archived INTEGER NOT NULL DEFAULT 0`);
    }
  }
  let payoutCols = db.pragma("table_info(investor_payouts)") as { name: string }[];
  const hasPayoutCol = (name: string) => payoutCols.some((c) => c.name === name);
  const refreshPayoutCols = () => {
    payoutCols = db.pragma("table_info(investor_payouts)") as { name: string }[];
  };
  if (!hasPayoutCol("property_address")) {
    db.exec("ALTER TABLE investor_payouts ADD COLUMN property_address TEXT");
  }
  if (!hasPayoutCol("loan_date")) {
    db.exec("ALTER TABLE investor_payouts ADD COLUMN loan_date TEXT");
  }
  if (!hasPayoutCol("sell_estimate_date")) {
    db.exec("ALTER TABLE investor_payouts ADD COLUMN sell_estimate_date TEXT");
  }
  if (!hasPayoutCol("attorney")) {
    db.exec("ALTER TABLE investor_payouts ADD COLUMN attorney TEXT");
  }
  if (!hasPayoutCol("amount_loaned")) {
    db.exec("ALTER TABLE investor_payouts ADD COLUMN amount_loaned REAL");
  }
  if (!hasPayoutCol("annual_interest_rate")) {
    db.exec("ALTER TABLE investor_payouts ADD COLUMN annual_interest_rate REAL");
  }
  if (!hasPayoutCol("kicker")) {
    db.exec("ALTER TABLE investor_payouts ADD COLUMN kicker REAL");
  }
  if (!hasPayoutCol("days_in_year")) {
    db.exec("ALTER TABLE investor_payouts ADD COLUMN days_in_year INTEGER DEFAULT 365");
  }
  if (!hasPayoutCol("record_kind")) {
    db.exec(`
      CREATE TABLE investor_payouts_migrated (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        record_kind TEXT NOT NULL DEFAULT 'capital',
        capital_id TEXT,
        payout_seq INTEGER,
        payout_id TEXT NOT NULL,
        date TEXT NOT NULL,
        business_name TEXT,
        business_address TEXT,
        property_name TEXT NOT NULL,
        property_address TEXT,
        loan_date TEXT,
        sell_estimate_date TEXT,
        investor_name TEXT NOT NULL,
        attorney TEXT,
        amount_loaned REAL,
        annual_interest_rate REAL,
        kicker REAL,
        days_in_year INTEGER DEFAULT 365,
        payout_type TEXT NOT NULL,
        payout_amount REAL NOT NULL,
        payment_method TEXT,
        payment_date TEXT,
        tax_year INTEGER,
        status TEXT DEFAULT 'Pending',
        notes TEXT,
        archived INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    db.exec(`
      INSERT INTO investor_payouts_migrated (
        id, record_kind, capital_id, payout_seq, payout_id, date, business_name, business_address,
        property_name, property_address,
        loan_date, sell_estimate_date, investor_name, attorney, amount_loaned, annual_interest_rate,
        kicker, days_in_year, payout_type, payout_amount, payment_method, payment_date, tax_year,
        status, notes, archived, created_at
      )
      SELECT
        id, 'capital', NULL, NULL, payout_id, date, NULL, NULL, property_name, property_address,
        loan_date, sell_estimate_date, investor_name, attorney, amount_loaned, annual_interest_rate,
        kicker, days_in_year, payout_type, payout_amount, payment_method, payment_date, tax_year,
        status, notes, archived, created_at
      FROM investor_payouts
    `);
    db.exec("DROP TABLE investor_payouts");
    db.exec("ALTER TABLE investor_payouts_migrated RENAME TO investor_payouts");
    refreshPayoutCols();
  }
  if (!hasPayoutCol("business_name")) {
    db.exec("ALTER TABLE investor_payouts ADD COLUMN business_name TEXT");
  }
  if (!hasPayoutCol("business_address")) {
    db.exec("ALTER TABLE investor_payouts ADD COLUMN business_address TEXT");
  }
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS investor_payouts_capital_id_unique
    ON investor_payouts (payout_id) WHERE record_kind = 'capital'
  `);
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS investor_payouts_capital_seq_unique
    ON investor_payouts (capital_id, payout_seq) WHERE record_kind = 'payout'
  `);
  const smsTable = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sms_messages'")
    .get();
  if (!smsTable) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS sms_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        direction TEXT NOT NULL,
        tenant_id INTEGER,
        tenant_name TEXT,
        property_name TEXT,
        phone_number TEXT NOT NULL,
        body TEXT NOT NULL,
        message_type TEXT NOT NULL DEFAULT 'general',
        status TEXT NOT NULL DEFAULT 'queued',
        external_id TEXT,
        related_id INTEGER,
        related_type TEXT,
        error_message TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  }
  const usersTable = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='app_users'")
    .get();
  if (!usersTable) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS app_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'standard',
        status TEXT NOT NULL DEFAULT 'Active',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  }
  const smsSettingsTable = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sms_settings'")
    .get();
  if (!smsSettingsTable) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS sms_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        account_sid TEXT,
        auth_token TEXT,
        phone_number TEXT,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  }
  const smsArchivedThreadsTable = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sms_archived_threads'")
    .get();
  if (!smsArchivedThreadsTable) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS sms_archived_threads (
        phone_number TEXT NOT NULL,
        contact_type TEXT NOT NULL DEFAULT 'tenant',
        archived_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (phone_number, contact_type)
      )
    `);
  } else {
    const archiveCols = db.pragma("table_info(sms_archived_threads)") as { name: string }[];
    if (!archiveCols.some((column) => column.name === "contact_type")) {
      db.exec(`
        CREATE TABLE sms_archived_threads_migrated (
          phone_number TEXT NOT NULL,
          contact_type TEXT NOT NULL DEFAULT 'tenant',
          archived_at TEXT NOT NULL DEFAULT (datetime('now')),
          PRIMARY KEY (phone_number, contact_type)
        );
        INSERT INTO sms_archived_threads_migrated (phone_number, contact_type, archived_at)
        SELECT phone_number, 'tenant', archived_at FROM sms_archived_threads;
        DROP TABLE sms_archived_threads;
        ALTER TABLE sms_archived_threads_migrated RENAME TO sms_archived_threads;
      `);
    }
  }
  const smsCols = db.pragma("table_info(sms_messages)") as { name: string }[];
  const hasSmsCol = (name: string) => smsCols.some((column) => column.name === name);
  if (!hasSmsCol("contact_type")) {
    db.exec("ALTER TABLE sms_messages ADD COLUMN contact_type TEXT NOT NULL DEFAULT 'tenant'");
  }
  if (!hasSmsCol("investor_id")) db.exec("ALTER TABLE sms_messages ADD COLUMN investor_id INTEGER");
  if (!hasSmsCol("investor_name")) {
    db.exec("ALTER TABLE sms_messages ADD COLUMN investor_name TEXT");
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

function mapBusiness(row: Record<string, unknown>): Business {
  return {
    id: Number(row.id),
    business_id: String(row.business_id),
    business_name: String(row.business_name),
    entity_type: String(row.entity_type ?? "LLC"),
    address: str(row.address),
    city: str(row.city),
    state: str(row.state),
    zip: str(row.zip),
    status: String(row.status ?? "Active"),
    notes: str(row.notes),
    created_at: String(row.created_at),
  };
}

function mapProperty(row: Record<string, unknown>): Property {
  return {
    id: Number(row.id),
    legal_id: String(row.legal_id ?? row.property_id ?? ""),
    business_name: str(row.business_name),
    property_name: String(row.property_name),
    lien_holder: str(row.lien_holder),
    account_number: str(row.account_number),
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
    rehab_amount: num(row.rehab_amount),
    rehab_price: num(row.rehab_price),
    current_value: num(row.current_value),
    loan_amount: num(row.loan_amount),
    mortgage_balance: num(row.mortgage_balance),
    monthly_mortgage: num(row.monthly_mortgage),
    annual_property_tax: num(row.annual_property_tax),
    annual_insurance: num(row.annual_insurance),
    insurance_carrier_name: str(row.insurance_carrier_name),
    insurance_policy_number: str(row.insurance_policy_number),
    attorney: str(row.attorney),
    monthly_hoa: num(row.monthly_hoa),
    monthly_rent: num(row.monthly_rent),
    status: String(row.status ?? "Vacant"),
    notes: str(row.notes),
    entry_code: str(row.entry_code),
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

function mapInvestor(row: Record<string, unknown>): Investor {
  return {
    id: Number(row.id),
    investor_id: String(row.investor_id),
    investor_name: String(row.investor_name),
    email: str(row.email),
    phone: str(row.phone),
    entity_type: String(row.entity_type ?? "Individual"),
    tax_id: str(row.tax_id),
    address: str(row.address),
    city: str(row.city),
    state: str(row.state),
    zip: str(row.zip),
    property_name: str(row.property_name),
    ownership_pct: num(row.ownership_pct),
    status: String(row.status ?? "Active"),
    notes: str(row.notes),
    created_at: String(row.created_at),
  };
}

function mapInvestorPayout(row: Record<string, unknown>): InvestorPayout {
  const recordKind = row.record_kind === "payout" ? "payout" : "capital";
  const payoutSeq = num(row.payout_seq);
  return {
    id: Number(row.id),
    record_kind: recordKind,
    capital_id: str(row.capital_id),
    payout_seq: payoutSeq != null ? Number(payoutSeq) : null,
    payout_id:
      recordKind === "payout" && payoutSeq != null
        ? String(payoutSeq)
        : String(row.payout_id),
    date: String(row.date),
    business_name: str(row.business_name),
    business_address: str(row.business_address),
    property_name: String(row.property_name),
    property_address: str(row.property_address),
    loan_date: str(row.loan_date),
    sell_estimate_date: str(row.sell_estimate_date),
    investor_name: String(row.investor_name),
    attorney: str(row.attorney),
    amount_loaned: num(row.amount_loaned),
    annual_interest_rate: num(row.annual_interest_rate),
    kicker: num(row.kicker),
    days_in_year: num(row.days_in_year) != null ? Number(row.days_in_year) : null,
    payout_type: String(row.payout_type),
    payout_amount: Number(row.payout_amount),
    payment_method: str(row.payment_method),
    payment_date: str(row.payment_date),
    tax_year: num(row.tax_year) != null ? Number(row.tax_year) : null,
    status: String(row.status ?? "Pending"),
    notes: str(row.notes),
    created_at: String(row.created_at),
  };
}

export async function listProperties(archived = false): Promise<Property[]> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    const rows = archived
      ? await sql`SELECT * FROM properties WHERE archived = TRUE ORDER BY business_name NULLS LAST, property_name`
      : await sql`SELECT * FROM properties WHERE archived = FALSE ORDER BY business_name NULLS LAST, property_name`;
    return rows.map((r) => mapProperty(r as Record<string, unknown>));
  }
  const db = await getSqliteDb();
  const rows = db
    .prepare(
      `SELECT * FROM properties WHERE archived = ? ORDER BY COALESCE(business_name, ''), property_name`
    )
    .all(archived ? 1 : 0);
  db.close();
  return rows.map((r) => mapProperty(r as Record<string, unknown>));
}

export async function listBusinesses(archived = false): Promise<Business[]> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    const rows = archived
      ? await sql`SELECT * FROM businesses WHERE archived = TRUE ORDER BY business_name`
      : await sql`SELECT * FROM businesses WHERE archived = FALSE ORDER BY business_name`;
    return rows.map((r) => mapBusiness(r as Record<string, unknown>));
  }
  const db = await getSqliteDb();
  const rows = db
    .prepare("SELECT * FROM businesses WHERE archived = ? ORDER BY business_name")
    .all(archived ? 1 : 0);
  db.close();
  return rows.map((r) => mapBusiness(r as Record<string, unknown>));
}

export async function createBusiness(
  data: Omit<Business, "id" | "created_at">
): Promise<Business> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    const rows = await sql`
      INSERT INTO businesses (
        business_id, business_name, entity_type, address, city, state, zip, status, notes
      ) VALUES (
        ${data.business_id}, ${data.business_name}, ${data.entity_type}, ${data.address},
        ${data.city}, ${data.state}, ${data.zip}, ${data.status}, ${data.notes}
      ) RETURNING *
    `;
    return mapBusiness(rows[0] as Record<string, unknown>);
  }
  const db = await getSqliteDb();
  const row = db
    .prepare(
      `INSERT INTO businesses (
        business_id, business_name, entity_type, address, city, state, zip, status, notes
      ) VALUES (
        @business_id, @business_name, @entity_type, @address, @city, @state, @zip, @status, @notes
      ) RETURNING *`
    )
    .get(data);
  db.close();
  return mapBusiness(row as Record<string, unknown>);
}

export async function archiveBusiness(id: number): Promise<void> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    await sql`UPDATE businesses SET archived = TRUE WHERE id = ${id}`;
    return;
  }
  const db = await getSqliteDb();
  db.prepare("UPDATE businesses SET archived = 1 WHERE id = ?").run(id);
  db.close();
}

export async function restoreBusiness(id: number): Promise<void> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    await sql`UPDATE businesses SET archived = FALSE WHERE id = ${id}`;
    return;
  }
  const db = await getSqliteDb();
  db.prepare("UPDATE businesses SET archived = 0 WHERE id = ?").run(id);
  db.close();
}

export async function updateBusiness(
  id: number,
  data: Omit<Business, "id" | "created_at">
): Promise<Business> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    const rows = await sql`
      UPDATE businesses SET
        business_id = ${data.business_id}, business_name = ${data.business_name},
        entity_type = ${data.entity_type}, address = ${data.address}, city = ${data.city},
        state = ${data.state}, zip = ${data.zip}, status = ${data.status}, notes = ${data.notes}
      WHERE id = ${id} RETURNING *
    `;
    if (!rows[0]) throw new Error("Business not found.");
    return mapBusiness(rows[0] as Record<string, unknown>);
  }
  const db = await getSqliteDb();
  const row = db
    .prepare(
      `UPDATE businesses SET
        business_id = @business_id, business_name = @business_name, entity_type = @entity_type,
        address = @address, city = @city, state = @state, zip = @zip, status = @status, notes = @notes
      WHERE id = @id RETURNING *`
    )
    .get({ ...data, id });
  db.close();
  if (!row) throw new Error("Business not found.");
  return mapBusiness(row as Record<string, unknown>);
}

export async function createProperty(
  data: Omit<Property, "id" | "created_at">
): Promise<Property> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    const legacyCols = await sql`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'properties' AND column_name = 'property_id'
      LIMIT 1
    `;
    const hasLegacyPropertyId = legacyCols.length > 0;
    const rows = hasLegacyPropertyId
      ? await sql`
          INSERT INTO properties (
            legal_id, property_id, business_name, property_name, lien_holder, account_number,
            address, city, state, zip, property_type,
            units, bedrooms, bathrooms, sq_ft, year_built, purchase_date,
            purchase_price, rehab_amount, rehab_price, current_value, loan_amount,
            mortgage_balance, monthly_mortgage, annual_property_tax, annual_insurance,
            insurance_carrier_name, insurance_policy_number, attorney,
            monthly_hoa, monthly_rent, status, notes
          ) VALUES (
            ${data.legal_id}, ${data.legal_id}, ${data.business_name}, ${data.property_name},
            ${data.lien_holder}, ${data.account_number}, ${data.address}, ${data.city},
            ${data.state}, ${data.zip}, ${data.property_type}, ${data.units},
            ${data.bedrooms}, ${data.bathrooms}, ${data.sq_ft}, ${data.year_built},
            ${data.purchase_date}, ${data.purchase_price}, ${data.rehab_amount}, ${data.rehab_price},
            ${data.current_value}, ${data.loan_amount}, ${data.mortgage_balance}, ${data.monthly_mortgage},
            ${data.annual_property_tax}, ${data.annual_insurance}, ${data.insurance_carrier_name},
            ${data.insurance_policy_number}, ${data.attorney}, ${data.monthly_hoa},
            ${data.monthly_rent}, ${data.status}, ${data.notes}
          ) RETURNING *
        `
      : await sql`
          INSERT INTO properties (
            legal_id, business_name, property_name, lien_holder, account_number,
            address, city, state, zip, property_type,
            units, bedrooms, bathrooms, sq_ft, year_built, purchase_date,
            purchase_price, rehab_amount, rehab_price, current_value, loan_amount,
            mortgage_balance, monthly_mortgage, annual_property_tax, annual_insurance,
            insurance_carrier_name, insurance_policy_number, attorney,
            monthly_hoa, monthly_rent, status, notes
          ) VALUES (
            ${data.legal_id}, ${data.business_name}, ${data.property_name}, ${data.lien_holder},
            ${data.account_number}, ${data.address}, ${data.city},
            ${data.state}, ${data.zip}, ${data.property_type}, ${data.units},
            ${data.bedrooms}, ${data.bathrooms}, ${data.sq_ft}, ${data.year_built},
            ${data.purchase_date}, ${data.purchase_price}, ${data.rehab_amount}, ${data.rehab_price},
            ${data.current_value}, ${data.loan_amount}, ${data.mortgage_balance}, ${data.monthly_mortgage},
            ${data.annual_property_tax}, ${data.annual_insurance}, ${data.insurance_carrier_name},
            ${data.insurance_policy_number}, ${data.attorney}, ${data.monthly_hoa},
            ${data.monthly_rent}, ${data.status}, ${data.notes}
          ) RETURNING *
        `;
    return mapProperty(rows[0] as Record<string, unknown>);
  }
  const db = await getSqliteDb();
  const tableCols = db.pragma("table_info(properties)") as { name: string }[];
  const hasLegacyPropertyId = tableCols.some((c) => c.name === "property_id");
  const payload = { ...data, property_id: data.legal_id };
  const row = hasLegacyPropertyId
    ? db
        .prepare(
          `INSERT INTO properties (
            legal_id, property_id, business_name, property_name, lien_holder, account_number,
            address, city, state, zip, property_type,
            units, bedrooms, bathrooms, sq_ft, year_built, purchase_date,
            purchase_price, rehab_amount, rehab_price, current_value, loan_amount,
            mortgage_balance, monthly_mortgage, annual_property_tax, annual_insurance,
            insurance_carrier_name, insurance_policy_number, attorney,
            monthly_hoa, monthly_rent, status, notes
          ) VALUES (
            @legal_id, @property_id, @business_name, @property_name, @lien_holder, @account_number,
            @address, @city, @state, @zip, @property_type,
            @units, @bedrooms, @bathrooms, @sq_ft, @year_built, @purchase_date,
            @purchase_price, @rehab_amount, @rehab_price, @current_value, @loan_amount,
            @mortgage_balance, @monthly_mortgage, @annual_property_tax, @annual_insurance,
            @insurance_carrier_name, @insurance_policy_number, @attorney,
            @monthly_hoa, @monthly_rent, @status, @notes
          ) RETURNING *`
        )
        .get(payload)
    : db
        .prepare(
          `INSERT INTO properties (
            legal_id, business_name, property_name, lien_holder, account_number,
            address, city, state, zip, property_type,
            units, bedrooms, bathrooms, sq_ft, year_built, purchase_date,
            purchase_price, rehab_amount, rehab_price, current_value, loan_amount,
            mortgage_balance, monthly_mortgage, annual_property_tax, annual_insurance,
            insurance_carrier_name, insurance_policy_number, attorney,
            monthly_hoa, monthly_rent, status, notes
          ) VALUES (
            @legal_id, @business_name, @property_name, @lien_holder, @account_number,
            @address, @city, @state, @zip, @property_type,
            @units, @bedrooms, @bathrooms, @sq_ft, @year_built, @purchase_date,
            @purchase_price, @rehab_amount, @rehab_price, @current_value, @loan_amount,
            @mortgage_balance, @monthly_mortgage, @annual_property_tax, @annual_insurance,
            @insurance_carrier_name, @insurance_policy_number, @attorney,
            @monthly_hoa, @monthly_rent, @status, @notes
          ) RETURNING *`
        )
        .get(data);
  db.close();
  return mapProperty(row as Record<string, unknown>);
}

export async function archiveProperty(id: number): Promise<void> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    await sql`UPDATE properties SET archived = TRUE WHERE id = ${id}`;
    return;
  }
  const db = await getSqliteDb();
  db.prepare("UPDATE properties SET archived = 1 WHERE id = ?").run(id);
  db.close();
}

export async function restoreProperty(id: number): Promise<void> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    await sql`UPDATE properties SET archived = FALSE WHERE id = ${id}`;
    return;
  }
  const db = await getSqliteDb();
  db.prepare("UPDATE properties SET archived = 0 WHERE id = ?").run(id);
  db.close();
}

export async function updatePropertyEntryCode(
  id: number,
  entry_code: string | null
): Promise<Property> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    const rows = await sql`
      UPDATE properties SET entry_code = ${entry_code}
      WHERE id = ${id}
      RETURNING *
    `;
    if (!rows[0]) throw new Error("Property not found.");
    return mapProperty(rows[0] as Record<string, unknown>);
  }
  const db = await getSqliteDb();
  const row = db
    .prepare("UPDATE properties SET entry_code = ? WHERE id = ? RETURNING *")
    .get(entry_code, id);
  db.close();
  if (!row) throw new Error("Property not found.");
  return mapProperty(row as Record<string, unknown>);
}

export async function listTenants(archived = false): Promise<Tenant[]> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    const rows = archived
      ? await sql`SELECT * FROM tenants WHERE archived = TRUE ORDER BY last_name, first_name`
      : await sql`SELECT * FROM tenants WHERE archived = FALSE ORDER BY last_name, first_name`;
    return rows.map((r) => mapTenant(r as Record<string, unknown>));
  }
  const db = await getSqliteDb();
  const rows = db
    .prepare("SELECT * FROM tenants WHERE archived = ? ORDER BY last_name, first_name")
    .all(archived ? 1 : 0);
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

export async function archiveTenant(id: number): Promise<void> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    await sql`UPDATE tenants SET archived = TRUE WHERE id = ${id}`;
    return;
  }
  const db = await getSqliteDb();
  db.prepare("UPDATE tenants SET archived = 1 WHERE id = ?").run(id);
  db.close();
}

export async function restoreTenant(id: number): Promise<void> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    await sql`UPDATE tenants SET archived = FALSE WHERE id = ${id}`;
    return;
  }
  const db = await getSqliteDb();
  db.prepare("UPDATE tenants SET archived = 0 WHERE id = ?").run(id);
  db.close();
}

export async function listLeases(archived = false): Promise<Lease[]> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    const rows = archived
      ? await sql`SELECT * FROM leases WHERE archived = TRUE ORDER BY lease_start DESC`
      : await sql`SELECT * FROM leases WHERE archived = FALSE ORDER BY lease_start DESC`;
    return rows.map((r) => mapLease(r as Record<string, unknown>));
  }
  const db = await getSqliteDb();
  const rows = db
    .prepare("SELECT * FROM leases WHERE archived = ? ORDER BY lease_start DESC")
    .all(archived ? 1 : 0);
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

export async function archiveLease(id: number): Promise<void> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    await sql`UPDATE leases SET archived = TRUE WHERE id = ${id}`;
    return;
  }
  const db = await getSqliteDb();
  db.prepare("UPDATE leases SET archived = 1 WHERE id = ?").run(id);
  db.close();
}

export async function restoreLease(id: number): Promise<void> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    await sql`UPDATE leases SET archived = FALSE WHERE id = ${id}`;
    return;
  }
  const db = await getSqliteDb();
  db.prepare("UPDATE leases SET archived = 0 WHERE id = ?").run(id);
  db.close();
}

export async function listRentPayments(archived = false): Promise<RentPayment[]> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    const rows = archived
      ? await sql`SELECT * FROM rent_payments WHERE archived = TRUE ORDER BY date DESC`
      : await sql`SELECT * FROM rent_payments WHERE archived = FALSE ORDER BY date DESC`;
    return rows.map((r) => mapRentPayment(r as Record<string, unknown>));
  }
  const db = await getSqliteDb();
  const rows = db
    .prepare("SELECT * FROM rent_payments WHERE archived = ? ORDER BY date DESC")
    .all(archived ? 1 : 0);
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

export async function archiveRentPayment(id: number): Promise<void> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    await sql`UPDATE rent_payments SET archived = TRUE WHERE id = ${id}`;
    return;
  }
  const db = await getSqliteDb();
  db.prepare("UPDATE rent_payments SET archived = 1 WHERE id = ?").run(id);
  db.close();
}

export async function restoreRentPayment(id: number): Promise<void> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    await sql`UPDATE rent_payments SET archived = FALSE WHERE id = ${id}`;
    return;
  }
  const db = await getSqliteDb();
  db.prepare("UPDATE rent_payments SET archived = 0 WHERE id = ?").run(id);
  db.close();
}

export async function listExpenses(archived = false): Promise<Expense[]> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    const rows = archived
      ? await sql`SELECT * FROM expenses WHERE archived = TRUE ORDER BY date DESC`
      : await sql`SELECT * FROM expenses WHERE archived = FALSE ORDER BY date DESC`;
    return rows.map((r) => mapExpense(r as Record<string, unknown>));
  }
  const db = await getSqliteDb();
  const rows = db
    .prepare("SELECT * FROM expenses WHERE archived = ? ORDER BY date DESC")
    .all(archived ? 1 : 0);
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

export async function archiveExpense(id: number): Promise<void> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    await sql`UPDATE expenses SET archived = TRUE WHERE id = ${id}`;
    return;
  }
  const db = await getSqliteDb();
  db.prepare("UPDATE expenses SET archived = 1 WHERE id = ?").run(id);
  db.close();
}

export async function restoreExpense(id: number): Promise<void> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    await sql`UPDATE expenses SET archived = FALSE WHERE id = ${id}`;
    return;
  }
  const db = await getSqliteDb();
  db.prepare("UPDATE expenses SET archived = 0 WHERE id = ?").run(id);
  db.close();
}

export async function listMaintenance(archived = false): Promise<MaintenanceRecord[]> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    const rows = archived
      ? await sql`SELECT * FROM maintenance_records WHERE archived = TRUE ORDER BY date_reported DESC`
      : await sql`SELECT * FROM maintenance_records WHERE archived = FALSE ORDER BY date_reported DESC`;
    return rows.map((r) => mapMaintenance(r as Record<string, unknown>));
  }
  const db = await getSqliteDb();
  const rows = db
    .prepare(
      "SELECT * FROM maintenance_records WHERE archived = ? ORDER BY date_reported DESC"
    )
    .all(archived ? 1 : 0);
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

export async function archiveMaintenance(id: number): Promise<void> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    await sql`UPDATE maintenance_records SET archived = TRUE WHERE id = ${id}`;
    return;
  }
  const db = await getSqliteDb();
  db.prepare("UPDATE maintenance_records SET archived = 1 WHERE id = ?").run(id);
  db.close();
}

export async function restoreMaintenance(id: number): Promise<void> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    await sql`UPDATE maintenance_records SET archived = FALSE WHERE id = ${id}`;
    return;
  }
  const db = await getSqliteDb();
  db.prepare("UPDATE maintenance_records SET archived = 0 WHERE id = ?").run(id);
  db.close();
}

export async function listInvestors(archived = false): Promise<Investor[]> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    const rows = archived
      ? await sql`SELECT * FROM investors WHERE archived = TRUE ORDER BY investor_name`
      : await sql`SELECT * FROM investors WHERE archived = FALSE ORDER BY investor_name`;
    return rows.map((r) => mapInvestor(r as Record<string, unknown>));
  }
  const db = await getSqliteDb();
  const rows = db
    .prepare("SELECT * FROM investors WHERE archived = ? ORDER BY investor_name")
    .all(archived ? 1 : 0);
  db.close();
  return rows.map((r) => mapInvestor(r as Record<string, unknown>));
}

export async function createInvestor(
  data: Omit<Investor, "id" | "created_at">
): Promise<Investor> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    const rows = await sql`
      INSERT INTO investors (
        investor_id, investor_name, email, phone, entity_type, tax_id,
        address, city, state, zip, property_name, ownership_pct, status, notes
      ) VALUES (
        ${data.investor_id}, ${data.investor_name}, ${data.email}, ${data.phone},
        ${data.entity_type}, ${data.tax_id}, ${data.address}, ${data.city},
        ${data.state}, ${data.zip}, ${data.property_name}, ${data.ownership_pct},
        ${data.status}, ${data.notes}
      ) RETURNING *
    `;
    return mapInvestor(rows[0] as Record<string, unknown>);
  }
  const db = await getSqliteDb();
  const row = db
    .prepare(
      `INSERT INTO investors (
        investor_id, investor_name, email, phone, entity_type, tax_id,
        address, city, state, zip, property_name, ownership_pct, status, notes
      ) VALUES (
        @investor_id, @investor_name, @email, @phone, @entity_type, @tax_id,
        @address, @city, @state, @zip, @property_name, @ownership_pct, @status, @notes
      ) RETURNING *`
    )
    .get(data);
  db.close();
  return mapInvestor(row as Record<string, unknown>);
}

export async function archiveInvestor(id: number): Promise<void> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    await sql`UPDATE investors SET archived = TRUE WHERE id = ${id}`;
    return;
  }
  const db = await getSqliteDb();
  db.prepare("UPDATE investors SET archived = 1 WHERE id = ?").run(id);
  db.close();
}

export async function restoreInvestor(id: number): Promise<void> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    await sql`UPDATE investors SET archived = FALSE WHERE id = ${id}`;
    return;
  }
  const db = await getSqliteDb();
  db.prepare("UPDATE investors SET archived = 0 WHERE id = ?").run(id);
  db.close();
}

export async function listInvestorPayouts(
  archived = false,
  kind?: "capital" | "payout"
): Promise<InvestorPayout[]> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    const rows =
      kind === "capital"
        ? archived
          ? await sql`SELECT * FROM investor_payouts WHERE archived = TRUE AND record_kind = 'capital' ORDER BY date DESC`
          : await sql`SELECT * FROM investor_payouts WHERE archived = FALSE AND record_kind = 'capital' ORDER BY date DESC`
        : kind === "payout"
          ? archived
            ? await sql`SELECT * FROM investor_payouts WHERE archived = TRUE AND record_kind = 'payout' ORDER BY capital_id, payout_seq`
            : await sql`SELECT * FROM investor_payouts WHERE archived = FALSE AND record_kind = 'payout' ORDER BY capital_id, payout_seq`
          : archived
            ? await sql`SELECT * FROM investor_payouts WHERE archived = TRUE ORDER BY date DESC`
            : await sql`SELECT * FROM investor_payouts WHERE archived = FALSE ORDER BY date DESC`;
    return rows.map((r) => mapInvestorPayout(r as Record<string, unknown>));
  }
  const db = await getSqliteDb();
  const orderBy =
    kind === "payout"
      ? "capital_id, payout_seq"
      : "date DESC";
  const kindClause =
    kind === "capital"
      ? " AND record_kind = 'capital'"
      : kind === "payout"
        ? " AND record_kind = 'payout'"
        : "";
  const rows = db
    .prepare(
      `SELECT * FROM investor_payouts WHERE archived = ?${kindClause} ORDER BY ${orderBy}`
    )
    .all(archived ? 1 : 0);
  db.close();
  return rows.map((r) => mapInvestorPayout(r as Record<string, unknown>));
}

export async function getInvestorCapitalByCapitalId(
  capitalId: string
): Promise<InvestorPayout | null> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    const rows = await sql`
      SELECT * FROM investor_payouts
      WHERE record_kind = 'capital' AND payout_id = ${capitalId} AND archived = FALSE
      LIMIT 1
    `;
    return rows[0]
      ? mapInvestorPayout(rows[0] as Record<string, unknown>)
      : null;
  }
  const db = await getSqliteDb();
  const row = db
    .prepare(
      `SELECT * FROM investor_payouts
       WHERE record_kind = 'capital' AND payout_id = ? AND archived = 0
       LIMIT 1`
    )
    .get(capitalId);
  db.close();
  return row ? mapInvestorPayout(row as Record<string, unknown>) : null;
}

export async function getNextCapitalId(): Promise<number> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    const rows = await sql`
      SELECT payout_id
      FROM investor_payouts
      WHERE record_kind = 'capital' AND archived = FALSE
    `;
    const ids = rows
      .map((row) => Number((row as { payout_id: string }).payout_id))
      .filter((value) => Number.isFinite(value) && value > 0);
    return ids.length > 0 ? Math.max(...ids) + 1 : 1;
  }
  const db = await getSqliteDb();
  const rows = db
    .prepare(
      `SELECT payout_id
       FROM investor_payouts
       WHERE record_kind = 'capital' AND archived = 0`
    )
    .all() as { payout_id: string }[];
  db.close();
  const ids = rows
    .map((row) => Number(row.payout_id))
    .filter((value) => Number.isFinite(value) && value > 0);
  return ids.length > 0 ? Math.max(...ids) + 1 : 1;
}

export async function getNextPayoutSequenceForCapital(capitalId: string): Promise<number> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    const rows = await sql`
      SELECT COALESCE(MAX(payout_seq), 0) AS max_seq
      FROM investor_payouts
      WHERE record_kind = 'payout' AND capital_id = ${capitalId} AND archived = FALSE
    `;
    return Number(rows[0]?.max_seq ?? 0) + 1;
  }
  const db = await getSqliteDb();
  const row = db
    .prepare(
      `SELECT COALESCE(MAX(payout_seq), 0) AS max_seq
       FROM investor_payouts
       WHERE record_kind = 'payout' AND capital_id = ? AND archived = 0`
    )
    .get(capitalId) as { max_seq: number } | undefined;
  db.close();
  return Number(row?.max_seq ?? 0) + 1;
}

export async function createInvestorPayout(
  data: Omit<InvestorPayout, "id" | "created_at">
): Promise<InvestorPayout> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    const rows = await sql`
      INSERT INTO investor_payouts (
        record_kind, capital_id, payout_seq, payout_id, date, business_name, business_address,
        property_name, property_address, loan_date, sell_estimate_date, investor_name, attorney,
        amount_loaned, annual_interest_rate, kicker, days_in_year, payout_type, payout_amount,
        payment_method, payment_date, tax_year, status, notes
      ) VALUES (
        ${data.record_kind}, ${data.capital_id}, ${data.payout_seq}, ${data.payout_id},
        ${data.date}, ${data.business_name}, ${data.business_address}, ${data.property_name},
        ${data.property_address}, ${data.loan_date}, ${data.sell_estimate_date}, ${data.investor_name},
        ${data.attorney}, ${data.amount_loaned}, ${data.annual_interest_rate}, ${data.kicker},
        ${data.days_in_year}, ${data.payout_type}, ${data.payout_amount}, ${data.payment_method},
        ${data.payment_date}, ${data.tax_year}, ${data.status}, ${data.notes}
      ) RETURNING *
    `;
    return mapInvestorPayout(rows[0] as Record<string, unknown>);
  }
  const db = await getSqliteDb();
  const row = db
    .prepare(
      `INSERT INTO investor_payouts (
        record_kind, capital_id, payout_seq, payout_id, date, business_name, business_address,
        property_name, property_address, loan_date, sell_estimate_date, investor_name, attorney,
        amount_loaned, annual_interest_rate, kicker, days_in_year, payout_type, payout_amount,
        payment_method, payment_date, tax_year, status, notes
      ) VALUES (
        @record_kind, @capital_id, @payout_seq, @payout_id, @date, @business_name, @business_address,
        @property_name, @property_address, @loan_date, @sell_estimate_date, @investor_name, @attorney,
        @amount_loaned, @annual_interest_rate, @kicker, @days_in_year, @payout_type,
        @payout_amount, @payment_method, @payment_date, @tax_year, @status, @notes
      ) RETURNING *`
    )
    .get(data);
  db.close();
  return mapInvestorPayout(row as Record<string, unknown>);
}

export async function archiveInvestorPayout(id: number): Promise<void> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    await sql`UPDATE investor_payouts SET archived = TRUE WHERE id = ${id}`;
    return;
  }
  const db = await getSqliteDb();
  db.prepare("UPDATE investor_payouts SET archived = 1 WHERE id = ?").run(id);
  db.close();
}

export async function restoreInvestorPayout(id: number): Promise<void> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    await sql`UPDATE investor_payouts SET archived = FALSE WHERE id = ${id}`;
    return;
  }
  const db = await getSqliteDb();
  db.prepare("UPDATE investor_payouts SET archived = 0 WHERE id = ?").run(id);
  db.close();
}

export async function updateProperty(
  id: number,
  data: Omit<Property, "id" | "created_at">
): Promise<Property> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    const legacyCols = await sql`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'properties' AND column_name = 'property_id'
      LIMIT 1
    `;
    const hasLegacyPropertyId = legacyCols.length > 0;
    const rows = hasLegacyPropertyId
      ? await sql`
          UPDATE properties SET
            legal_id = ${data.legal_id}, property_id = ${data.legal_id},
            business_name = ${data.business_name}, property_name = ${data.property_name},
            lien_holder = ${data.lien_holder}, account_number = ${data.account_number},
            address = ${data.address}, city = ${data.city}, state = ${data.state}, zip = ${data.zip},
            property_type = ${data.property_type}, units = ${data.units},
            bedrooms = ${data.bedrooms}, bathrooms = ${data.bathrooms}, sq_ft = ${data.sq_ft},
            year_built = ${data.year_built}, purchase_date = ${data.purchase_date},
            purchase_price = ${data.purchase_price}, rehab_amount = ${data.rehab_amount},
            rehab_price = ${data.rehab_price}, current_value = ${data.current_value},
            loan_amount = ${data.loan_amount}, mortgage_balance = ${data.mortgage_balance},
            monthly_mortgage = ${data.monthly_mortgage}, annual_property_tax = ${data.annual_property_tax},
            annual_insurance = ${data.annual_insurance},
            insurance_carrier_name = ${data.insurance_carrier_name},
            insurance_policy_number = ${data.insurance_policy_number}, attorney = ${data.attorney},
            monthly_hoa = ${data.monthly_hoa}, monthly_rent = ${data.monthly_rent},
            status = ${data.status}, notes = ${data.notes}
          WHERE id = ${id} RETURNING *
        `
      : await sql`
          UPDATE properties SET
            legal_id = ${data.legal_id}, business_name = ${data.business_name},
            property_name = ${data.property_name}, lien_holder = ${data.lien_holder},
            account_number = ${data.account_number}, address = ${data.address},
            city = ${data.city}, state = ${data.state}, zip = ${data.zip},
            property_type = ${data.property_type}, units = ${data.units},
            bedrooms = ${data.bedrooms}, bathrooms = ${data.bathrooms}, sq_ft = ${data.sq_ft},
            year_built = ${data.year_built}, purchase_date = ${data.purchase_date},
            purchase_price = ${data.purchase_price}, rehab_amount = ${data.rehab_amount},
            rehab_price = ${data.rehab_price}, current_value = ${data.current_value},
            loan_amount = ${data.loan_amount}, mortgage_balance = ${data.mortgage_balance},
            monthly_mortgage = ${data.monthly_mortgage}, annual_property_tax = ${data.annual_property_tax},
            annual_insurance = ${data.annual_insurance},
            insurance_carrier_name = ${data.insurance_carrier_name},
            insurance_policy_number = ${data.insurance_policy_number}, attorney = ${data.attorney},
            monthly_hoa = ${data.monthly_hoa}, monthly_rent = ${data.monthly_rent},
            status = ${data.status}, notes = ${data.notes}
          WHERE id = ${id} RETURNING *
        `;
    if (!rows[0]) throw new Error("Property not found.");
    return mapProperty(rows[0] as Record<string, unknown>);
  }
  const db = await getSqliteDb();
  const tableCols = db.pragma("table_info(properties)") as { name: string }[];
  const hasLegacyPropertyId = tableCols.some((c) => c.name === "property_id");
  const payload = { ...data, id, property_id: data.legal_id };
  const row = hasLegacyPropertyId
    ? db
        .prepare(
          `UPDATE properties SET
            legal_id = @legal_id, property_id = @property_id, business_name = @business_name,
            property_name = @property_name, lien_holder = @lien_holder, account_number = @account_number,
            address = @address, city = @city, state = @state, zip = @zip, property_type = @property_type,
            units = @units, bedrooms = @bedrooms, bathrooms = @bathrooms, sq_ft = @sq_ft,
            year_built = @year_built, purchase_date = @purchase_date,
            purchase_price = @purchase_price, rehab_amount = @rehab_amount, rehab_price = @rehab_price,
            current_value = @current_value, loan_amount = @loan_amount,
            mortgage_balance = @mortgage_balance, monthly_mortgage = @monthly_mortgage,
            annual_property_tax = @annual_property_tax, annual_insurance = @annual_insurance,
            insurance_carrier_name = @insurance_carrier_name,
            insurance_policy_number = @insurance_policy_number, attorney = @attorney,
            monthly_hoa = @monthly_hoa, monthly_rent = @monthly_rent, status = @status, notes = @notes
          WHERE id = @id RETURNING *`
        )
        .get(payload)
    : db
        .prepare(
          `UPDATE properties SET
            legal_id = @legal_id, business_name = @business_name, property_name = @property_name,
            lien_holder = @lien_holder, account_number = @account_number, address = @address,
            city = @city, state = @state, zip = @zip, property_type = @property_type,
            units = @units, bedrooms = @bedrooms, bathrooms = @bathrooms, sq_ft = @sq_ft,
            year_built = @year_built, purchase_date = @purchase_date, purchase_price = @purchase_price,
            rehab_amount = @rehab_amount, rehab_price = @rehab_price, current_value = @current_value,
            loan_amount = @loan_amount, mortgage_balance = @mortgage_balance,
            monthly_mortgage = @monthly_mortgage, annual_property_tax = @annual_property_tax,
            annual_insurance = @annual_insurance, insurance_carrier_name = @insurance_carrier_name,
            insurance_policy_number = @insurance_policy_number, attorney = @attorney,
            monthly_hoa = @monthly_hoa, monthly_rent = @monthly_rent, status = @status, notes = @notes
          WHERE id = @id RETURNING *`
        )
        .get({ ...data, id });
  db.close();
  if (!row) throw new Error("Property not found.");
  return mapProperty(row as Record<string, unknown>);
}

export async function updateTenant(
  id: number,
  data: Omit<Tenant, "id" | "created_at">
): Promise<Tenant> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    const rows = await sql`
      UPDATE tenants SET
        tenant_id = ${data.tenant_id}, first_name = ${data.first_name}, last_name = ${data.last_name},
        email = ${data.email}, phone = ${data.phone}, emergency_contact = ${data.emergency_contact},
        emergency_phone = ${data.emergency_phone}, property_name = ${data.property_name},
        unit = ${data.unit}, move_in_date = ${data.move_in_date}, move_out_date = ${data.move_out_date},
        status = ${data.status}, notes = ${data.notes}
      WHERE id = ${id} RETURNING *
    `;
    if (!rows[0]) throw new Error("Tenant not found.");
    return mapTenant(rows[0] as Record<string, unknown>);
  }
  const db = await getSqliteDb();
  const row = db
    .prepare(
      `UPDATE tenants SET
        tenant_id = @tenant_id, first_name = @first_name, last_name = @last_name,
        email = @email, phone = @phone, emergency_contact = @emergency_contact,
        emergency_phone = @emergency_phone, property_name = @property_name, unit = @unit,
        move_in_date = @move_in_date, move_out_date = @move_out_date, status = @status, notes = @notes
      WHERE id = @id RETURNING *`
    )
    .get({ ...data, id });
  db.close();
  if (!row) throw new Error("Tenant not found.");
  return mapTenant(row as Record<string, unknown>);
}

export async function updateLease(
  id: number,
  data: Omit<Lease, "id" | "created_at">
): Promise<Lease> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    const rows = await sql`
      UPDATE leases SET
        lease_id = ${data.lease_id}, property_name = ${data.property_name}, unit = ${data.unit},
        tenant_name = ${data.tenant_name}, lease_start = ${data.lease_start}, lease_end = ${data.lease_end},
        monthly_rent = ${data.monthly_rent}, security_deposit = ${data.security_deposit},
        pet_deposit = ${data.pet_deposit}, lease_type = ${data.lease_type}, status = ${data.status},
        renewal_date = ${data.renewal_date}, notes = ${data.notes}
      WHERE id = ${id} RETURNING *
    `;
    if (!rows[0]) throw new Error("Lease not found.");
    return mapLease(rows[0] as Record<string, unknown>);
  }
  const db = await getSqliteDb();
  const row = db
    .prepare(
      `UPDATE leases SET
        lease_id = @lease_id, property_name = @property_name, unit = @unit,
        tenant_name = @tenant_name, lease_start = @lease_start, lease_end = @lease_end,
        monthly_rent = @monthly_rent, security_deposit = @security_deposit,
        pet_deposit = @pet_deposit, lease_type = @lease_type, status = @status,
        renewal_date = @renewal_date, notes = @notes
      WHERE id = @id RETURNING *`
    )
    .get({ ...data, id });
  db.close();
  if (!row) throw new Error("Lease not found.");
  return mapLease(row as Record<string, unknown>);
}

export async function updateRentPayment(
  id: number,
  data: Omit<RentPayment, "id" | "created_at">
): Promise<RentPayment> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    const rows = await sql`
      UPDATE rent_payments SET
        date = ${data.date}, property_name = ${data.property_name}, unit = ${data.unit},
        tenant_name = ${data.tenant_name}, rent_due = ${data.rent_due}, amount_paid = ${data.amount_paid},
        payment_date = ${data.payment_date}, payment_method = ${data.payment_method},
        late_fee = ${data.late_fee}, balance = ${data.balance}, status = ${data.status}, notes = ${data.notes}
      WHERE id = ${id} RETURNING *
    `;
    if (!rows[0]) throw new Error("Rent payment not found.");
    return mapRentPayment(rows[0] as Record<string, unknown>);
  }
  const db = await getSqliteDb();
  const row = db
    .prepare(
      `UPDATE rent_payments SET
        date = @date, property_name = @property_name, unit = @unit, tenant_name = @tenant_name,
        rent_due = @rent_due, amount_paid = @amount_paid, payment_date = @payment_date,
        payment_method = @payment_method, late_fee = @late_fee, balance = @balance,
        status = @status, notes = @notes
      WHERE id = @id RETURNING *`
    )
    .get({ ...data, id });
  db.close();
  if (!row) throw new Error("Rent payment not found.");
  return mapRentPayment(row as Record<string, unknown>);
}

export async function updateExpense(
  id: number,
  data: Omit<Expense, "id" | "created_at">
): Promise<Expense> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    const rows = await sql`
      UPDATE expenses SET
        date = ${data.date}, property_name = ${data.property_name}, category = ${data.category},
        vendor = ${data.vendor}, description = ${data.description}, amount = ${data.amount},
        payment_method = ${data.payment_method}, receipt_number = ${data.receipt_number}, notes = ${data.notes}
      WHERE id = ${id} RETURNING *
    `;
    if (!rows[0]) throw new Error("Expense not found.");
    return mapExpense(rows[0] as Record<string, unknown>);
  }
  const db = await getSqliteDb();
  const row = db
    .prepare(
      `UPDATE expenses SET
        date = @date, property_name = @property_name, category = @category, vendor = @vendor,
        description = @description, amount = @amount, payment_method = @payment_method,
        receipt_number = @receipt_number, notes = @notes
      WHERE id = @id RETURNING *`
    )
    .get({ ...data, id });
  db.close();
  if (!row) throw new Error("Expense not found.");
  return mapExpense(row as Record<string, unknown>);
}

export async function updateMaintenance(
  id: number,
  data: Omit<MaintenanceRecord, "id" | "created_at">
): Promise<MaintenanceRecord> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    const rows = await sql`
      UPDATE maintenance_records SET
        date_reported = ${data.date_reported}, property_name = ${data.property_name}, unit = ${data.unit},
        category = ${data.category}, description = ${data.description}, priority = ${data.priority},
        status = ${data.status}, vendor = ${data.vendor}, estimated_cost = ${data.estimated_cost},
        actual_cost = ${data.actual_cost}, date_completed = ${data.date_completed}, notes = ${data.notes}
      WHERE id = ${id} RETURNING *
    `;
    if (!rows[0]) throw new Error("Maintenance record not found.");
    return mapMaintenance(rows[0] as Record<string, unknown>);
  }
  const db = await getSqliteDb();
  const row = db
    .prepare(
      `UPDATE maintenance_records SET
        date_reported = @date_reported, property_name = @property_name, unit = @unit,
        category = @category, description = @description, priority = @priority, status = @status,
        vendor = @vendor, estimated_cost = @estimated_cost, actual_cost = @actual_cost,
        date_completed = @date_completed, notes = @notes
      WHERE id = @id RETURNING *`
    )
    .get({ ...data, id });
  db.close();
  if (!row) throw new Error("Maintenance record not found.");
  return mapMaintenance(row as Record<string, unknown>);
}

export async function updateInvestor(
  id: number,
  data: Omit<Investor, "id" | "created_at">
): Promise<Investor> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    const rows = await sql`
      UPDATE investors SET
        investor_id = ${data.investor_id}, investor_name = ${data.investor_name},
        email = ${data.email}, phone = ${data.phone}, entity_type = ${data.entity_type},
        tax_id = ${data.tax_id}, address = ${data.address}, city = ${data.city},
        state = ${data.state}, zip = ${data.zip}, property_name = ${data.property_name},
        ownership_pct = ${data.ownership_pct}, status = ${data.status}, notes = ${data.notes}
      WHERE id = ${id} RETURNING *
    `;
    if (!rows[0]) throw new Error("Investor not found.");
    return mapInvestor(rows[0] as Record<string, unknown>);
  }
  const db = await getSqliteDb();
  const row = db
    .prepare(
      `UPDATE investors SET
        investor_id = @investor_id, investor_name = @investor_name, email = @email, phone = @phone,
        entity_type = @entity_type, tax_id = @tax_id, address = @address, city = @city,
        state = @state, zip = @zip, property_name = @property_name, ownership_pct = @ownership_pct,
        status = @status, notes = @notes
      WHERE id = @id RETURNING *`
    )
    .get({ ...data, id });
  db.close();
  if (!row) throw new Error("Investor not found.");
  return mapInvestor(row as Record<string, unknown>);
}

export async function updateInvestorPayout(
  id: number,
  data: Omit<InvestorPayout, "id" | "created_at">
): Promise<InvestorPayout> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    const rows = await sql`
      UPDATE investor_payouts SET
        record_kind = ${data.record_kind}, capital_id = ${data.capital_id},
        payout_seq = ${data.payout_seq}, payout_id = ${data.payout_id}, date = ${data.date},
        business_name = ${data.business_name}, business_address = ${data.business_address},
        property_name = ${data.property_name}, property_address = ${data.property_address},
        loan_date = ${data.loan_date}, sell_estimate_date = ${data.sell_estimate_date},
        investor_name = ${data.investor_name}, attorney = ${data.attorney},
        amount_loaned = ${data.amount_loaned}, annual_interest_rate = ${data.annual_interest_rate},
        kicker = ${data.kicker}, days_in_year = ${data.days_in_year}, payout_type = ${data.payout_type},
        payout_amount = ${data.payout_amount}, payment_method = ${data.payment_method},
        payment_date = ${data.payment_date}, tax_year = ${data.tax_year},
        status = ${data.status}, notes = ${data.notes}
      WHERE id = ${id} RETURNING *
    `;
    if (!rows[0]) throw new Error("Investor payout not found.");
    return mapInvestorPayout(rows[0] as Record<string, unknown>);
  }
  const db = await getSqliteDb();
  const row = db
    .prepare(
      `UPDATE investor_payouts SET
        record_kind = @record_kind, capital_id = @capital_id, payout_seq = @payout_seq,
        payout_id = @payout_id, date = @date, business_name = @business_name,
        business_address = @business_address, property_name = @property_name,
        property_address = @property_address, loan_date = @loan_date,
        sell_estimate_date = @sell_estimate_date, investor_name = @investor_name,
        attorney = @attorney, amount_loaned = @amount_loaned,
        annual_interest_rate = @annual_interest_rate, kicker = @kicker,
        days_in_year = @days_in_year, payout_type = @payout_type, payout_amount = @payout_amount,
        payment_method = @payment_method, payment_date = @payment_date, tax_year = @tax_year,
        status = @status, notes = @notes
      WHERE id = @id RETURNING *`
    )
    .get({ ...data, id });
  db.close();
  if (!row) throw new Error("Investor payout not found.");
  return mapInvestorPayout(row as Record<string, unknown>);
}

function mapSmsMessage(row: Record<string, unknown>): SmsMessage {
  const contactType = String(row.contact_type ?? "tenant");
  return {
    id: Number(row.id),
    contact_type:
      contactType === "investor" ? "investor" : ("tenant" as SmsMessage["contact_type"]),
    direction: String(row.direction) as SmsMessage["direction"],
    tenant_id: num(row.tenant_id) != null ? Number(row.tenant_id) : null,
    tenant_name: str(row.tenant_name),
    investor_id: num(row.investor_id) != null ? Number(row.investor_id) : null,
    investor_name: str(row.investor_name),
    property_name: str(row.property_name),
    phone_number: String(row.phone_number),
    body: String(row.body),
    message_type: String(row.message_type ?? "general") as SmsMessage["message_type"],
    status: String(row.status ?? "queued") as SmsMessage["status"],
    external_id: str(row.external_id),
    related_id: num(row.related_id) != null ? Number(row.related_id) : null,
    related_type: str(row.related_type) as SmsMessage["related_type"],
    error_message: str(row.error_message),
    created_at: String(row.created_at),
  };
}

function normalizeArchivedThreadPhone(phone: string): string {
  const trimmed = phone.trim();
  if (!trimmed) throw new Error("Phone number is required.");
  return normalizePhoneNumber(trimmed) ?? trimmed;
}

function isPhoneArchived(
  phone: string,
  contactType: SmsMessage["contact_type"],
  archivedPhones: Set<string>
): boolean {
  const normalized = normalizeArchivedThreadPhone(phone);
  return archivedPhones.has(`${contactType}:${normalized}`);
}

export async function listArchivedThreadPhones(
  contactType: SmsMessage["contact_type"]
): Promise<string[]> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    const rows = await sql`
      SELECT phone_number FROM sms_archived_threads
      WHERE contact_type = ${contactType}
      ORDER BY archived_at DESC
    `;
    return rows.map((row) => String((row as Record<string, unknown>).phone_number));
  }
  const db = await getSqliteDb();
  const rows = db
    .prepare(
      "SELECT phone_number FROM sms_archived_threads WHERE contact_type = ? ORDER BY archived_at DESC"
    )
    .all(contactType);
  db.close();
  return rows.map((row) => String((row as Record<string, unknown>).phone_number));
}

export async function archiveSmsThread(
  phone: string,
  contactType: SmsMessage["contact_type"]
): Promise<void> {
  await ensureSchema();
  const phoneNumber = normalizeArchivedThreadPhone(phone);
  if (usePostgres) {
    const sql = await getPostgresSql();
    await sql`
      INSERT INTO sms_archived_threads (phone_number, contact_type, archived_at)
      VALUES (${phoneNumber}, ${contactType}, NOW())
      ON CONFLICT (phone_number, contact_type) DO UPDATE SET archived_at = NOW()
    `;
    return;
  }
  const db = await getSqliteDb();
  db.prepare(
    `INSERT INTO sms_archived_threads (phone_number, contact_type, archived_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(phone_number, contact_type) DO UPDATE SET archived_at = datetime('now')`
  ).run(phoneNumber, contactType);
  db.close();
}

export async function restoreSmsThread(
  phone: string,
  contactType: SmsMessage["contact_type"]
): Promise<void> {
  await ensureSchema();
  const phoneNumber = normalizeArchivedThreadPhone(phone);
  if (usePostgres) {
    const sql = await getPostgresSql();
    await sql`
      DELETE FROM sms_archived_threads
      WHERE phone_number = ${phoneNumber} AND contact_type = ${contactType}
    `;
    return;
  }
  const db = await getSqliteDb();
  db.prepare("DELETE FROM sms_archived_threads WHERE phone_number = ? AND contact_type = ?").run(
    phoneNumber,
    contactType
  );
  db.close();
}

export async function getLastSmsMessageForPhone(phone: string): Promise<SmsMessage | null> {
  await ensureSchema();
  const phoneNumber = normalizeArchivedThreadPhone(phone);
  if (usePostgres) {
    const sql = await getPostgresSql();
    const rows = await sql`
      SELECT * FROM sms_messages
      WHERE phone_number = ${phoneNumber}
      ORDER BY created_at DESC
      LIMIT 1
    `;
    if (!rows[0]) return null;
    return mapSmsMessage(rows[0] as Record<string, unknown>);
  }
  const db = await getSqliteDb();
  const row = db
    .prepare("SELECT * FROM sms_messages WHERE phone_number = ? ORDER BY created_at DESC LIMIT 1")
    .get(phoneNumber);
  db.close();
  return row ? mapSmsMessage(row as Record<string, unknown>) : null;
}

export async function listSmsMessages(options: {
  contact_type: SmsMessage["contact_type"];
  phone?: string;
  archived?: boolean;
}): Promise<SmsMessage[]> {
  await ensureSchema();
  const phone = options.phone;
  const archived = options.archived;
  const contactType = options.contact_type;
  const archivedPhones = new Set(
    (await listArchivedThreadPhones(contactType)).map(
      (archivedPhone) => `${contactType}:${archivedPhone}`
    )
  );

  if (usePostgres) {
    const sql = await getPostgresSql();
    const rows = phone
      ? await sql`
          SELECT * FROM sms_messages
          WHERE phone_number = ${phone} AND contact_type = ${contactType}
          ORDER BY created_at DESC
        `
      : await sql`
          SELECT * FROM sms_messages
          WHERE contact_type = ${contactType}
          ORDER BY created_at DESC
        `;
    const messages = rows.map((r) => mapSmsMessage(r as Record<string, unknown>));
    if (archived == null) return messages;
    return messages.filter((message) =>
      archived
        ? isPhoneArchived(message.phone_number, contactType, archivedPhones)
        : !isPhoneArchived(message.phone_number, contactType, archivedPhones)
    );
  }
  const db = await getSqliteDb();
  const rows = phone
    ? db
        .prepare(
          "SELECT * FROM sms_messages WHERE phone_number = ? AND contact_type = ? ORDER BY created_at DESC"
        )
        .all(phone, contactType)
    : db
        .prepare("SELECT * FROM sms_messages WHERE contact_type = ? ORDER BY created_at DESC")
        .all(contactType);
  db.close();
  const messages = rows.map((r) => mapSmsMessage(r as Record<string, unknown>));
  if (archived == null) return messages;
  return messages.filter((message) =>
    archived
      ? isPhoneArchived(message.phone_number, contactType, archivedPhones)
      : !isPhoneArchived(message.phone_number, contactType, archivedPhones)
  );
}

function mapSmsSettings(row: Record<string, unknown>): SmsSettings {
  return {
    account_sid: row.account_sid != null ? String(row.account_sid) : null,
    auth_token: row.auth_token != null ? String(row.auth_token) : null,
    phone_number: row.phone_number != null ? String(row.phone_number) : null,
    updated_at: String(row.updated_at),
  };
}

export async function getSmsSettings(): Promise<SmsSettings | null> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    const rows = await sql`SELECT * FROM sms_settings WHERE id = 1 LIMIT 1`;
    if (!rows[0]) return null;
    return mapSmsSettings(rows[0] as Record<string, unknown>);
  }
  const db = await getSqliteDb();
  const row = db.prepare("SELECT * FROM sms_settings WHERE id = 1").get();
  db.close();
  return row ? mapSmsSettings(row as Record<string, unknown>) : null;
}

export async function upsertSmsSettings(data: {
  account_sid: string;
  auth_token?: string | null;
  phone_number: string;
}): Promise<SmsSettings> {
  await ensureSchema();
  const existing = await getSmsSettings();
  const accountSid = data.account_sid.trim();
  const phoneNumber = data.phone_number.trim();
  const authToken = data.auth_token?.trim()
    ? data.auth_token.trim()
    : existing?.auth_token?.trim() ?? null;

  if (!accountSid) throw new Error("Twilio Account SID is required.");
  if (!phoneNumber) throw new Error("Twilio phone number is required.");
  if (!authToken) throw new Error("Twilio Auth Token is required.");

  if (usePostgres) {
    const sql = await getPostgresSql();
    const rows = await sql`
      INSERT INTO sms_settings (id, account_sid, auth_token, phone_number, updated_at)
      VALUES (1, ${accountSid}, ${authToken}, ${phoneNumber}, NOW())
      ON CONFLICT (id) DO UPDATE SET
        account_sid = EXCLUDED.account_sid,
        auth_token = EXCLUDED.auth_token,
        phone_number = EXCLUDED.phone_number,
        updated_at = NOW()
      RETURNING *
    `;
    return mapSmsSettings(rows[0] as Record<string, unknown>);
  }

  const db = await getSqliteDb();
  const row = db
    .prepare(
      `INSERT INTO sms_settings (id, account_sid, auth_token, phone_number, updated_at)
       VALUES (1, @account_sid, @auth_token, @phone_number, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         account_sid = excluded.account_sid,
         auth_token = excluded.auth_token,
         phone_number = excluded.phone_number,
         updated_at = datetime('now')
       RETURNING *`
    )
    .get({
      account_sid: accountSid,
      auth_token: authToken,
      phone_number: phoneNumber,
    });
  db.close();
  return mapSmsSettings(row as Record<string, unknown>);
}

export async function createSmsMessage(
  data: Omit<SmsMessage, "id" | "created_at">
): Promise<SmsMessage> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    const rows = await sql`
      INSERT INTO sms_messages (
        contact_type, direction, tenant_id, tenant_name, investor_id, investor_name,
        property_name, phone_number, body, message_type, status, external_id,
        related_id, related_type, error_message
      ) VALUES (
        ${data.contact_type}, ${data.direction}, ${data.tenant_id}, ${data.tenant_name},
        ${data.investor_id}, ${data.investor_name}, ${data.property_name}, ${data.phone_number},
        ${data.body}, ${data.message_type}, ${data.status}, ${data.external_id},
        ${data.related_id}, ${data.related_type}, ${data.error_message}
      ) RETURNING *
    `;
    return mapSmsMessage(rows[0] as Record<string, unknown>);
  }
  const db = await getSqliteDb();
  const row = db
    .prepare(
      `INSERT INTO sms_messages (
        contact_type, direction, tenant_id, tenant_name, investor_id, investor_name,
        property_name, phone_number, body, message_type, status, external_id,
        related_id, related_type, error_message
      ) VALUES (
        @contact_type, @direction, @tenant_id, @tenant_name, @investor_id, @investor_name,
        @property_name, @phone_number, @body, @message_type, @status, @external_id,
        @related_id, @related_type, @error_message
      ) RETURNING *`
    )
    .get(data);
  db.close();
  return mapSmsMessage(row as Record<string, unknown>);
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  await ensureSchema();
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  if (usePostgres) {
    const sql = await getPostgresSql();
    const [props, tenants, leases, rentExpected, rentCollected, maint, exp] =
      await Promise.all([
        sql`SELECT COUNT(*)::int AS c FROM properties WHERE archived = FALSE`,
        sql`SELECT COUNT(*)::int AS c FROM tenants WHERE status = 'Active' AND archived = FALSE`,
        sql`SELECT COUNT(*)::int AS c FROM leases WHERE status = 'Active' AND archived = FALSE`,
        sql`
          SELECT COALESCE(SUM(monthly_rent), 0)::float AS total
          FROM leases WHERE status = 'Active' AND archived = FALSE
        `,
        sql`
          SELECT COALESCE(SUM(amount_paid), 0)::float AS total
          FROM rent_payments
          WHERE date >= ${monthStart} AND status IN ('Paid', 'Partial') AND archived = FALSE
        `,
        sql`
          SELECT COUNT(*)::int AS c FROM maintenance_records
          WHERE status IN ('Open', 'In Progress') AND archived = FALSE
        `,
        sql`
          SELECT COALESCE(SUM(amount), 0)::float AS total
          FROM expenses WHERE date >= ${monthStart} AND archived = FALSE
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
    db
      .prepare("SELECT COUNT(*) AS c FROM properties WHERE archived = 0")
      .get() as { c: number }
  ).c;
  const active_tenants = (
    db
      .prepare(
        "SELECT COUNT(*) AS c FROM tenants WHERE status = 'Active' AND archived = 0"
      )
      .get() as { c: number }
  ).c;
  const active_leases = (
    db
      .prepare(
        "SELECT COUNT(*) AS c FROM leases WHERE status = 'Active' AND archived = 0"
      )
      .get() as { c: number }
  ).c;
  const monthly_rent_expected = (
    db
      .prepare(
        `SELECT COALESCE(SUM(monthly_rent), 0) AS total FROM leases
         WHERE status = 'Active' AND archived = 0`
      )
      .get() as { total: number }
  ).total;
  const monthly_rent_collected = (
    db
      .prepare(
        `SELECT COALESCE(SUM(amount_paid), 0) AS total FROM rent_payments
         WHERE date >= ? AND status IN ('Paid', 'Partial') AND archived = 0`
      )
      .get(monthStart) as { total: number }
  ).total;
  const open_maintenance = (
    db
      .prepare(
        `SELECT COUNT(*) AS c FROM maintenance_records
         WHERE status IN ('Open', 'In Progress') AND archived = 0`
      )
      .get() as { c: number }
  ).c;
  const monthly_expenses = (
    db
      .prepare(
        "SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE date >= ? AND archived = 0"
      )
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

function normalizeUserRole(role: string): UserRole {
  return role.trim().toLowerCase() === "admin" ? "admin" : "standard";
}

function roleLabel(role: UserRole): string {
  return role === "admin" ? "Admin" : "Standard";
}

function mapAppUser(row: Record<string, unknown>): AppUser {
  const role = normalizeUserRole(String(row.role ?? "standard"));
  return {
    id: Number(row.id),
    username: String(row.username),
    role,
    status: String(row.status ?? "Active"),
    created_at: String(row.created_at),
  };
}

export async function ensureDefaultAdmin(): Promise<void> {
  await ensureSchema();
  const existing = await getAppUserByUsername("Hop2it");
  if (!existing) {
    await createAppUser({
      username: "Hop2it",
      password: "legroom",
      role: "admin",
      status: "Active",
    });
    return;
  }

  const needsUpdate =
    existing.status !== "Active" ||
    existing.role !== "admin" ||
    !(await verifyPassword("legroom", (await getAppUserPasswordHash(existing.username)) ?? ""));

  if (needsUpdate) {
    await updateAppUser(existing.id, {
      username: "Hop2it",
      role: "admin",
      status: "Active",
      password: "legroom",
    });
  }
}

export async function listAppUsers(): Promise<AppUser[]> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    const rows = await sql`SELECT id, username, role, status, created_at FROM app_users ORDER BY username`;
    return rows
      .map((r) => mapAppUser(r as Record<string, unknown>))
      .filter((user) => !isRecoveryUsername(user.username));
  }
  const db = await getSqliteDb();
  const rows = db
    .prepare("SELECT id, username, role, status, created_at FROM app_users ORDER BY username")
    .all();
  db.close();
  return rows
    .map((r) => mapAppUser(r as Record<string, unknown>))
    .filter((user) => !isRecoveryUsername(user.username));
}

export async function getAppUserByUsername(username: string): Promise<AppUser | null> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    const rows = await sql`
      SELECT id, username, role, status, created_at
      FROM app_users
      WHERE LOWER(username) = LOWER(${username})
      LIMIT 1
    `;
    if (!rows[0]) return null;
    return mapAppUser(rows[0] as Record<string, unknown>);
  }
  const db = await getSqliteDb();
  const row = db
    .prepare(
      "SELECT id, username, role, status, created_at FROM app_users WHERE username = ? COLLATE NOCASE"
    )
    .get(username);
  db.close();
  return row ? mapAppUser(row as Record<string, unknown>) : null;
}

async function getAppUserPasswordHash(username: string): Promise<string | null> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    const rows = await sql`
      SELECT password_hash FROM app_users WHERE LOWER(username) = LOWER(${username}) LIMIT 1
    `;
    return rows[0] ? String((rows[0] as Record<string, unknown>).password_hash) : null;
  }
  const db = await getSqliteDb();
  const row = db
    .prepare("SELECT password_hash FROM app_users WHERE username = ? COLLATE NOCASE")
    .get(username) as { password_hash: string } | undefined;
  db.close();
  return row?.password_hash ?? null;
}

export async function authenticateAppUser(
  username: string,
  password: string
): Promise<AppUser | null> {
  const user = await getAppUserByUsername(username);
  if (!user || user.status !== "Active") return null;
  const hash = await getAppUserPasswordHash(user.username);
  if (!hash || !(await verifyPassword(password, hash))) return null;
  return user;
}

export async function createAppUser(input: {
  username: string;
  password: string;
  role: UserRole | string;
  status?: string;
}): Promise<AppUser> {
  await ensureSchema();
  const username = input.username.trim();
  if (!username) throw new Error("Username is required.");
  if (isRecoveryUsername(username)) {
    throw new Error("That username is reserved.");
  }
  if (!input.password) throw new Error("Password is required.");
  const passwordHash = await hashPassword(input.password);
  const role = normalizeUserRole(String(input.role));
  const status = input.status?.trim() || "Active";

  if (usePostgres) {
    const sql = await getPostgresSql();
    const rows = await sql`
      INSERT INTO app_users (username, password_hash, role, status)
      VALUES (${username}, ${passwordHash}, ${role}, ${status})
      RETURNING id, username, role, status, created_at
    `;
    return mapAppUser(rows[0] as Record<string, unknown>);
  }

  const db = await getSqliteDb();
  try {
    const row = db
      .prepare(
        `INSERT INTO app_users (username, password_hash, role, status)
         VALUES (@username, @password_hash, @role, @status)
         RETURNING id, username, role, status, created_at`
      )
      .get({
        username,
        password_hash: passwordHash,
        role,
        status,
      });
    db.close();
    return mapAppUser(row as Record<string, unknown>);
  } catch (error) {
    db.close();
    if (String(error).includes("UNIQUE")) throw new Error("Username already exists.");
    throw error;
  }
}

export async function updateAppUser(
  id: number,
  input: {
    username: string;
    role: UserRole | string;
    status: string;
    password?: string;
  }
): Promise<AppUser> {
  await ensureSchema();
  const username = input.username.trim();
  if (!username) throw new Error("Username is required.");
  if (isRecoveryUsername(username)) {
    throw new Error("That username is reserved.");
  }
  const role = normalizeUserRole(String(input.role));
  const status = input.status.trim() || "Active";
  const passwordHash = input.password?.trim()
    ? await hashPassword(input.password)
    : null;

  if (usePostgres) {
    const sql = await getPostgresSql();
    const rows = passwordHash
      ? await sql`
          UPDATE app_users
          SET username = ${username}, role = ${role}, status = ${status}, password_hash = ${passwordHash}
          WHERE id = ${id}
          RETURNING id, username, role, status, created_at
        `
      : await sql`
          UPDATE app_users
          SET username = ${username}, role = ${role}, status = ${status}
          WHERE id = ${id}
          RETURNING id, username, role, status, created_at
        `;
    if (!rows[0]) throw new Error("User not found.");
    return mapAppUser(rows[0] as Record<string, unknown>);
  }

  const db = await getSqliteDb();
  const row = passwordHash
    ? db
        .prepare(
          `UPDATE app_users
           SET username = @username, role = @role, status = @status, password_hash = @password_hash
           WHERE id = @id
           RETURNING id, username, role, status, created_at`
        )
        .get({ id, username, role, status, password_hash: passwordHash })
    : db
        .prepare(
          `UPDATE app_users
           SET username = @username, role = @role, status = @status
           WHERE id = @id
           RETURNING id, username, role, status, created_at`
        )
        .get({ id, username, role, status });
  db.close();
  if (!row) throw new Error("User not found.");
  return mapAppUser(row as Record<string, unknown>);
}

export async function deactivateAppUser(id: number): Promise<void> {
  await ensureSchema();
  if (usePostgres) {
    const sql = await getPostgresSql();
    const rows = await sql`
      UPDATE app_users SET status = 'Inactive' WHERE id = ${id} RETURNING id
    `;
    if (!rows[0]) throw new Error("User not found.");
    return;
  }
  const db = await getSqliteDb();
  const row = db
    .prepare("UPDATE app_users SET status = 'Inactive' WHERE id = ? RETURNING id")
    .get(id);
  db.close();
  if (!row) throw new Error("User not found.");
}

export function appUserToRow(user: AppUser): Record<string, unknown> {
  return {
    id: user.id,
    username: user.username,
    role: roleLabel(user.role),
    status: user.status,
    created_at: user.created_at,
  };
}