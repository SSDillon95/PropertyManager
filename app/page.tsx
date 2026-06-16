"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import SpreadsheetTable from "@/components/SpreadsheetTable";
import { getColumnsForTab, SHEET_TABS, type ColumnDef } from "@/lib/columns";
import { formatCurrency, todayIso } from "@/lib/format";
import { rentDetailsForProperty, tenantDisplayName } from "@/lib/rent-ledger";
import type { DashboardSummary, Lease, Property, SheetTab, Tenant } from "@/lib/types";

const API_MAP: Record<Exclude<SheetTab, "dashboard">, string> = {
  properties: "/api/properties",
  tenants: "/api/tenants",
  leases: "/api/leases",
  rent_ledger: "/api/rent-payments",
  expenses: "/api/expenses",
  maintenance: "/api/maintenance",
};

function emptyForm(columns: ColumnDef[]): Record<string, string> {
  const form: Record<string, string> = {};
  for (const col of columns) {
    if (col.type === "date") form[col.key] = todayIso();
    else if (col.type === "number" || col.type === "currency") form[col.key] = "";
    else if (col.type === "select" && col.options?.length) form[col.key] = col.options[0];
    else form[col.key] = "";
  }
  return form;
}

function payloadFromForm(
  form: Record<string, string>,
  columns: ColumnDef[]
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const col of columns) {
    const raw = form[col.key]?.trim() ?? "";
    if (!raw) {
      payload[col.key] = null;
      continue;
    }
    if (col.type === "number" || col.type === "currency") {
      payload[col.key] = Number(raw);
    } else {
      payload[col.key] = raw;
    }
  }
  return payload;
}

export default function PropertyManagerApp() {
  const [tab, setTab] = useState<SheetTab>("dashboard");
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );
  const [properties, setProperties] = useState<Property[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);

  const columns = useMemo(() => getColumnsForTab(tab), [tab]);

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const loadDashboard = useCallback(async () => {
    const res = await fetch("/api/summary");
    const json = await res.json();
    if (json.success) setSummary(json.data);
  }, []);

  const loadProperties = useCallback(async () => {
    const res = await fetch("/api/properties");
    const json = await res.json();
    if (json.success) setProperties(json.data);
  }, []);

  const loadTenants = useCallback(async () => {
    const res = await fetch("/api/tenants");
    const json = await res.json();
    if (json.success) setTenants(json.data);
  }, []);

  const loadLeases = useCallback(async () => {
    const res = await fetch("/api/leases");
    const json = await res.json();
    if (json.success) setLeases(json.data);
  }, []);

  const loadTabData = useCallback(async (activeTab: SheetTab) => {
    if (activeTab === "dashboard") {
      await loadDashboard();
      setRows([]);
      return;
    }
    if (activeTab === "tenants") {
      await loadProperties();
    }
    if (activeTab === "leases") {
      await Promise.all([loadProperties(), loadTenants()]);
    }
    if (activeTab === "rent_ledger") {
      await Promise.all([loadProperties(), loadTenants(), loadLeases()]);
    }
    if (activeTab === "expenses") {
      await loadProperties();
    }
    const endpoint = API_MAP[activeTab];
    const res = await fetch(endpoint);
    const json = await res.json();
    if (json.success) setRows(json.data);
  }, [loadDashboard, loadProperties, loadTenants, loadLeases]);

  const handlePropertySelect = (propertyName: string, fieldKey: string) => {
    if (tab === "rent_ledger" && fieldKey === "property_name") {
      if (!propertyName) {
        setForm((prev) => ({
          ...prev,
          property_name: "",
          rent_due: "",
          tenant_name: "",
          unit: "",
        }));
        return;
      }
      const { rentDue, tenantName, unit } = rentDetailsForProperty(
        propertyName,
        properties,
        tenants,
        leases
      );
      setForm((prev) => ({
        ...prev,
        property_name: propertyName,
        rent_due: rentDue != null ? String(rentDue) : "",
        tenant_name: tenantName,
        unit: unit ?? "",
      }));
      return;
    }
    setForm((prev) => ({ ...prev, [fieldKey]: propertyName }));
  };

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadDashboard(), loadTabData(tab)]);
    } catch {
      showMessage("error", "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, [loadDashboard, loadTabData, tab]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (tab !== "dashboard") {
      setForm(emptyForm(columns));
    }
  }, [tab, columns]);

  const handleTabChange = async (next: SheetTab) => {
    setTab(next);
    setLoading(true);
    try {
      await loadTabData(next);
      if (next === "dashboard") await loadDashboard();
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tab === "dashboard") return;

    const missing = columns.find((c) => c.required && !form[c.key]?.trim());
    if (missing) {
      showMessage("error", `${missing.label} is required.`);
      return;
    }

    setSaving(true);
    try {
      const endpoint = API_MAP[tab];
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadFromForm(form, columns)),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Save failed");
      showMessage("success", "Row added.");
      setForm(emptyForm(columns));
      await Promise.all([loadTabData(tab), loadDashboard()]);
    } catch (error) {
      showMessage("error", (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (tab === "dashboard") return;
    setDeletingId(id);
    try {
      const endpoint = API_MAP[tab];
      const res = await fetch(`${endpoint}?id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Delete failed");
      showMessage("success", "Row deleted.");
      await Promise.all([loadTabData(tab), loadDashboard()]);
    } catch (error) {
      showMessage("error", (error as Error).message);
    } finally {
      setDeletingId(null);
    }
  };

  const exportCsv = () => {
    if (tab === "dashboard" || rows.length === 0) return;
    const headers = columns.map((c) => c.label);
    const lines = [
      headers.join(","),
      ...rows.map((row) =>
        columns
          .map((col) => {
            const val = row[col.key];
            const text = val == null ? "" : String(val);
            return `"${text.replace(/"/g, '""')}"`;
          })
          .join(",")
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `property-manager-${tab}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans flex flex-col">
      <header className="border-b border-white/10 bg-zinc-950/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <svg width="36" height="36" viewBox="0 0 36 36" className="flex-shrink-0" aria-hidden>
              <rect width="36" height="36" rx="8" fill="#0a0a0a" stroke="#3b82f6" strokeWidth="1.5" />
              <path
                d="M18 8 L28 16 L28 28 L8 28 L8 16 Z"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <rect x="14" y="20" width="8" height="8" fill="#3b82f6" opacity="0.4" />
            </svg>
            <div className="min-w-0">
              <div className="font-semibold text-xl sm:text-2xl tracking-tighter truncate">
                PropertyManager
              </div>
              <div className="text-[10px] text-blue-400 -mt-1 hidden sm:block">
                RENTAL PROPERTY SPREADSHEET
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {tab !== "dashboard" && rows.length > 0 && (
              <button
                type="button"
                onClick={exportCsv}
                className="text-xs px-3 py-1.5 rounded-lg border border-white/10 hover:bg-zinc-900"
              >
                Export CSV
              </button>
            )}
            <button
              type="button"
              onClick={refresh}
              className="text-xs px-3 py-1.5 rounded-lg border border-white/10 hover:bg-zinc-900"
            >
              Refresh
            </button>
          </div>
        </div>
      </header>

      <div className="border-b border-white/10 bg-zinc-900/80 overflow-x-auto">
        <div className="max-w-[1600px] mx-auto px-2 flex">
          {SHEET_TABS.map((sheet) => (
            <button
              key={sheet.id}
              type="button"
              onClick={() => handleTabChange(sheet.id)}
              className={`px-4 py-2.5 text-sm whitespace-nowrap border-b-2 transition ${
                tab === sheet.id
                  ? "border-blue-500 text-blue-400 bg-zinc-950/60"
                  : "border-transparent text-zinc-400 hover:text-white hover:bg-zinc-950/30"
              }`}
            >
              {sheet.label}
            </button>
          ))}
        </div>
      </div>

      {message && (
        <div
          className={`mx-4 mt-4 max-w-[1600px] lg:mx-auto px-4 py-2 rounded-lg text-sm ${
            message.type === "success"
              ? "bg-emerald-950/60 border border-emerald-800 text-emerald-300"
              : "bg-red-950/60 border border-red-800 text-red-300"
          }`}
        >
          {message.text}
        </div>
      )}

      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 py-6">
        {loading ? (
          <div className="text-zinc-500 py-12 text-center">Loading...</div>
        ) : tab === "dashboard" ? (
          <DashboardView summary={summary} />
        ) : (
          <div className="space-y-6">
            <section className="rounded-xl border border-white/10 bg-zinc-900 p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-semibold text-lg">Add New Row</h2>
                  <p className="text-xs text-zinc-500 mt-1">
                    Yellow headers match spreadsheet input columns. Required fields are marked.
                    {tab === "rent_ledger" &&
                      " Selecting a property auto-fills rent due and tenant from the Properties tab."}
                  </p>
                </div>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {columns.map((col) => (
                    <label key={col.key} className="block">
                      <span className="text-xs font-semibold uppercase tracking-wide text-amber-400 mb-1 block">
                        {col.label}
                        {col.required ? " *" : ""}
                      </span>
                      {col.type === "property" ? (
                        <select
                          value={form[col.key] ?? ""}
                          onChange={(e) => handlePropertySelect(e.target.value, col.key)}
                          className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-sm"
                        >
                          <option value="">
                            {properties.length
                              ? "Select property..."
                              : "No properties — add one in Properties tab"}
                          </option>
                          {properties.map((property) => (
                            <option key={property.id} value={property.property_name}>
                              {property.property_name}
                            </option>
                          ))}
                        </select>
                      ) : col.type === "tenant" ? (
                        <select
                          value={form[col.key] ?? ""}
                          onChange={(e) =>
                            setForm((prev) => ({ ...prev, [col.key]: e.target.value }))
                          }
                          className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-sm"
                        >
                          <option value="">
                            {tenants.length
                              ? "Select tenant..."
                              : "No tenants — add one in Tenants tab"}
                          </option>
                          {tenants.map((tenant) => (
                            <option key={tenant.id} value={tenantDisplayName(tenant)}>
                              {tenantDisplayName(tenant)}
                              {tenant.property_name ? ` (${tenant.property_name})` : ""}
                            </option>
                          ))}
                        </select>
                      ) : col.type === "select" ? (
                        <select
                          value={form[col.key] ?? ""}
                          onChange={(e) =>
                            setForm((prev) => ({ ...prev, [col.key]: e.target.value }))
                          }
                          className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-sm"
                        >
                          {col.options?.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={
                            col.type === "date"
                              ? "date"
                              : col.type === "number" || col.type === "currency"
                                ? "number"
                                : "text"
                          }
                          step={col.type === "currency" ? "0.01" : undefined}
                          value={form[col.key] ?? ""}
                          readOnly={
                            tab === "rent_ledger" &&
                            col.key === "tenant_name" &&
                            Boolean(form.property_name)
                          }
                          onChange={(e) =>
                            setForm((prev) => ({ ...prev, [col.key]: e.target.value }))
                          }
                          className={`w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-sm ${
                            tab === "rent_ledger" &&
                            col.key === "tenant_name" &&
                            form.property_name
                              ? "text-zinc-400 cursor-not-allowed"
                              : ""
                          }`}
                        />
                      )}
                    </label>
                  ))}
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="mt-4 px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Add Row"}
                </button>
              </form>
            </section>

            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-lg">
                  {SHEET_TABS.find((s) => s.id === tab)?.label} ({rows.length})
                </h2>
              </div>
              <SpreadsheetTable
                columns={columns}
                rows={rows}
                onDelete={handleDelete}
                deletingId={deletingId}
              />
            </section>
          </div>
        )}
      </main>

      <footer className="border-t border-white/10 py-4 text-center text-xs text-zinc-600">
        PropertyManager — spreadsheet-format tabs: Properties, Tenants, Leases, Rent Ledger,
        Expenses, Maintenance
      </footer>
    </div>
  );
}

function DashboardView({ summary }: { summary: DashboardSummary | null }) {
  if (!summary) return null;

  const cards = [
    { label: "Total Properties", value: String(summary.total_properties) },
    { label: "Active Tenants", value: String(summary.active_tenants) },
    { label: "Active Leases", value: String(summary.active_leases) },
    { label: "Monthly Rent Expected", value: formatCurrency(summary.monthly_rent_expected) },
    { label: "Rent Collected (MTD)", value: formatCurrency(summary.monthly_rent_collected) },
    { label: "Open Maintenance", value: String(summary.open_maintenance) },
    { label: "Expenses (MTD)", value: formatCurrency(summary.monthly_expenses) },
  ];

  const collectionRate =
    summary.monthly_rent_expected > 0
      ? Math.round(
          (summary.monthly_rent_collected / summary.monthly_rent_expected) * 100
        )
      : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tighter mb-2">Dashboard</h1>
        <p className="text-zinc-400">
          Summary view matching your property management spreadsheet overview.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-white/10 bg-zinc-900 p-5"
          >
            <div className="text-xs text-zinc-500 uppercase tracking-wide mb-1">
              {card.label}
            </div>
            <div className="text-2xl font-semibold text-blue-400">{card.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-white/10 bg-zinc-900 p-6">
        <div className="text-sm text-zinc-400 mb-2">Rent Collection Rate (Month to Date)</div>
        <div className="flex items-end gap-3">
          <div className="text-4xl font-semibold text-emerald-400">{collectionRate}%</div>
          <div className="text-sm text-zinc-500 pb-1">
            {formatCurrency(summary.monthly_rent_collected)} of{" "}
            {formatCurrency(summary.monthly_rent_expected)}
          </div>
        </div>
        <div className="mt-4 h-3 rounded-full bg-zinc-800 overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${Math.min(collectionRate, 100)}%` }}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-5 text-sm text-amber-200/80">
        <strong className="text-amber-300">Spreadsheet format:</strong> Use the tabs above to
        manage each sheet. Column headers match standard rental property manager templates
        (Property ID, Tenant ID, Lease ID, Rent Ledger, Expenses, Maintenance).
      </div>
    </div>
  );
}