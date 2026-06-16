"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import PropertyDetailPanel from "@/components/PropertyDetailPanel";
import ReportsView from "@/components/ReportsView";
import SpreadsheetTable from "@/components/SpreadsheetTable";
import { getColumnsForTab, SHEET_TABS, type ColumnDef } from "@/lib/columns";
import { formatCurrency, todayIso } from "@/lib/format";
import { downloadInvestorPayoutPdf } from "@/lib/pdf-reports";
import { propertyProfitability } from "@/lib/profitability";
import { rentDetailsForProperty, tenantDisplayName } from "@/lib/rent-ledger";
import type {
  DashboardSummary,
  Expense,
  Investor,
  InvestorPayout,
  Lease,
  MaintenanceRecord,
  Property,
  RentPayment,
  SheetTab,
  Tenant,
} from "@/lib/types";

function apiFetch(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(input, { cache: "no-store", ...init });
}

type DataTab = Exclude<SheetTab, "dashboard" | "reports">;

const API_MAP: Record<DataTab, string> = {
  properties: "/api/properties",
  tenants: "/api/tenants",
  leases: "/api/leases",
  rent_ledger: "/api/rent-payments",
  expenses: "/api/expenses",
  maintenance: "/api/maintenance",
  investors: "/api/investors",
  investor_payout: "/api/investor-payouts",
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

function rowToForm(
  row: Record<string, unknown>,
  columns: ColumnDef[]
): Record<string, string> {
  const form: Record<string, string> = {};
  for (const col of columns) {
    const value = row[col.key];
    if (value == null || value === "") {
      form[col.key] = "";
    } else {
      form[col.key] = String(value);
    }
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
  const [actionId, setActionId] = useState<number | null>(null);
  const [printFormId, setPrintFormId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );
  const [properties, setProperties] = useState<Property[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [rentPayments, setRentPayments] = useState<RentPayment[]>([]);
  const [expenseRows, setExpenseRows] = useState<Expense[]>([]);
  const [maintenanceRows, setMaintenanceRows] = useState<MaintenanceRecord[]>([]);
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [profitabilityProperty, setProfitabilityProperty] = useState<Property | null>(null);
  const [expandedProperty, setExpandedProperty] = useState<Property | null>(null);

  const columns = useMemo(() => getColumnsForTab(tab), [tab]);
  const profitability = useMemo(
    () => (profitabilityProperty ? propertyProfitability(profitabilityProperty) : null),
    [profitabilityProperty]
  );

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const loadDashboard = useCallback(async () => {
    const res = await apiFetch("/api/summary");
    const json = await res.json();
    if (json.success) setSummary(json.data);
  }, []);

  const loadProperties = useCallback(async () => {
    const res = await apiFetch("/api/properties");
    const json = await res.json();
    if (json.success) setProperties(json.data);
  }, []);

  const loadTenants = useCallback(async () => {
    const res = await apiFetch("/api/tenants");
    const json = await res.json();
    if (json.success) setTenants(json.data);
  }, []);

  const loadLeases = useCallback(async () => {
    const res = await apiFetch("/api/leases");
    const json = await res.json();
    if (json.success) setLeases(json.data);
  }, []);

  const loadRentPayments = useCallback(async () => {
    const res = await apiFetch("/api/rent-payments");
    const json = await res.json();
    if (json.success) setRentPayments(json.data);
  }, []);

  const loadExpenseRows = useCallback(async () => {
    const res = await apiFetch("/api/expenses");
    const json = await res.json();
    if (json.success) setExpenseRows(json.data);
  }, []);

  const loadMaintenanceRows = useCallback(async () => {
    const res = await apiFetch("/api/maintenance");
    const json = await res.json();
    if (json.success) setMaintenanceRows(json.data);
  }, []);

  const loadInvestors = useCallback(async () => {
    const res = await apiFetch("/api/investors");
    const json = await res.json();
    if (json.success) setInvestors(json.data);
  }, []);

  const loadTabData = useCallback(
    async (activeTab: SheetTab, archived = false) => {
      if (activeTab === "dashboard") {
        await loadDashboard();
        setRows([]);
        return;
      }
      if (activeTab === "reports") {
        await Promise.all([
          loadProperties(),
          loadRentPayments(),
          loadExpenseRows(),
          loadMaintenanceRows(),
        ]);
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
      if (activeTab === "investors") {
        await loadProperties();
      }
      if (
        activeTab === "expenses" ||
        activeTab === "maintenance" ||
        activeTab === "investor_payout"
      ) {
        await loadProperties();
      }
      if (activeTab === "investor_payout") {
        await loadInvestors();
      }
      const endpoint = API_MAP[activeTab];
      const url = archived ? `${endpoint}?archived=1` : endpoint;
      const res = await apiFetch(url);
      const json = await res.json();
      if (json.success) setRows(json.data);
    },
    [
      loadDashboard,
      loadProperties,
      loadTenants,
      loadLeases,
      loadRentPayments,
      loadExpenseRows,
      loadMaintenanceRows,
      loadInvestors,
    ]
  );

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
    if (tab === "investor_payout" && fieldKey === "property_name") {
      if (!propertyName) {
        setForm((prev) => ({
          ...prev,
          property_name: "",
          investor_name: "",
        }));
        return;
      }
      const linkedInvestor = investors.find(
        (investor) =>
          investor.property_name === propertyName && investor.status === "Active"
      );
      setForm((prev) => ({
        ...prev,
        property_name: propertyName,
        investor_name: linkedInvestor?.investor_name ?? prev.investor_name,
      }));
      return;
    }
    setForm((prev) => ({ ...prev, [fieldKey]: propertyName }));
  };

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadDashboard(), loadTabData(tab, showArchived)]);
    } catch {
      showMessage("error", "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, [loadDashboard, loadTabData, tab, showArchived]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (tab !== "dashboard" && tab !== "reports") {
      setForm(emptyForm(columns));
      setFormOpen(false);
      setEditingId(null);
    }
  }, [tab, columns]);

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyForm(columns));
  };

  const openEntryForm = () => {
    setEditingId(null);
    setForm(emptyForm(columns));
    setFormOpen(true);
  };

  const openEditForm = (row: Record<string, unknown>) => {
    setEditingId(Number(row.id));
    setForm(rowToForm(row, columns));
    setFormOpen(true);
    setExpandedProperty(null);
  };

  const handleTabChange = async (next: SheetTab) => {
    setShowArchived(false);
    setFormOpen(false);
    setExpandedProperty(null);
    setTab(next);
    setLoading(true);
    try {
      await loadTabData(next, false);
      if (next === "dashboard") await loadDashboard();
    } finally {
      setLoading(false);
    }
  };

  const toggleArchiveView = async () => {
    const next = !showArchived;
    setShowArchived(next);
    setFormOpen(false);
    setExpandedProperty(null);
    setLoading(true);
    try {
      await loadTabData(tab, next);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tab === "dashboard" || tab === "reports") return;

    const missing = columns.find((c) => c.required && !form[c.key]?.trim());
    if (missing) {
      showMessage("error", `${missing.label} is required.`);
      return;
    }

    setSaving(true);
    try {
      const endpoint = API_MAP[tab];
      const isEdit = editingId != null;
      const url = isEdit ? `${endpoint}?id=${editingId}` : endpoint;
      const res = await apiFetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadFromForm(form, columns)),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Save failed");
      if (json.data && typeof json.data === "object") {
        const saved = json.data as Record<string, unknown>;
        if (isEdit) {
          setRows((prev) =>
            prev.map((row) => (Number(row.id) === editingId ? saved : row))
          );
          if (tab === "properties" && expandedProperty?.id === editingId) {
            setExpandedProperty(saved as unknown as Property);
          }
        } else {
          setRows((prev) => [...prev, saved]);
        }
      }
      showMessage("success", isEdit ? "Row updated." : "Row saved.");
      closeForm();
      await Promise.all([loadTabData(tab, showArchived), loadDashboard()]);
    } catch (error) {
      showMessage("error", (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (id: number) => {
    if (tab === "dashboard" || tab === "reports") return;
    setActionId(id);
    try {
      const endpoint = API_MAP[tab];
      const res = await apiFetch(`${endpoint}?id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Archive failed");
      showMessage("success", "Row archived.");
      await Promise.all([loadTabData(tab, showArchived), loadDashboard()]);
    } catch (error) {
      showMessage("error", (error as Error).message);
    } finally {
      setActionId(null);
    }
  };

  const handlePrintForm = async (row: Record<string, unknown>) => {
    const payout = row as unknown as InvestorPayout;
    setPrintFormId(payout.id);
    try {
      await downloadInvestorPayoutPdf({
        payout_id: payout.payout_id,
        date: payout.date,
        property_name: payout.property_name,
        investor_name: payout.investor_name,
        payout_type: payout.payout_type,
        payout_amount: payout.payout_amount,
        payment_method: payout.payment_method,
        payment_date: payout.payment_date,
        tax_year: payout.tax_year,
        status: payout.status,
        notes: payout.notes,
      });
    } catch (error) {
      showMessage("error", (error as Error).message);
    } finally {
      setPrintFormId(null);
    }
  };

  const handleRestore = async (id: number) => {
    if (tab === "dashboard" || tab === "reports") return;
    setActionId(id);
    try {
      const endpoint = API_MAP[tab];
      const res = await apiFetch(`${endpoint}?id=${id}`, { method: "PATCH" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Restore failed");
      showMessage("success", "Row restored.");
      await Promise.all([loadTabData(tab, showArchived), loadDashboard()]);
    } catch (error) {
      showMessage("error", (error as Error).message);
    } finally {
      setActionId(null);
    }
  };

  const exportCsv = () => {
    if (tab === "dashboard" || tab === "reports" || rows.length === 0) return;
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
    <div className="min-h-screen bg-zinc-800 text-zinc-100 font-sans flex flex-col relative">
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat opacity-28 pointer-events-none"
        style={{ backgroundImage: "url('/apartment-bg.jpg')" }}
        aria-hidden
      />
      <div className="relative z-10 flex flex-col flex-1 min-h-screen">
      <div className="sticky top-0 z-50">
      <nav className="bg-zinc-800/90 backdrop-blur border-b border-zinc-600/60">
        <div className="max-w-[1600px] mx-auto px-2 sm:px-4 flex items-center justify-between gap-3">
          <div className="flex overflow-x-auto min-w-0">
            {SHEET_TABS.map((sheet) => (
              <button
                key={sheet.id}
                type="button"
                onClick={() => handleTabChange(sheet.id)}
                className={`px-4 py-2.5 text-sm whitespace-nowrap border-b-2 transition ${
                  tab === sheet.id
                    ? "border-emerald-400 text-emerald-300 bg-zinc-700/50"
                    : "border-transparent text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700/40"
                }`}
              >
                {sheet.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {tab !== "dashboard" && tab !== "reports" && rows.length > 0 && (
              <button
                type="button"
                onClick={exportCsv}
                className="text-xs px-3 py-1.5 rounded-lg border border-zinc-600 bg-zinc-700/80 text-zinc-200 hover:bg-zinc-700"
              >
                Export CSV
              </button>
            )}
            <button
              type="button"
              onClick={refresh}
              className="text-xs px-3 py-1.5 rounded-lg border border-zinc-600 bg-zinc-700/80 text-zinc-200 hover:bg-zinc-700"
            >
              Refresh
            </button>
            <Image
              src="/hop2it-logo.png"
              alt="HOP2IT Property Manager"
              width={800}
              height={300}
              className="h-10 sm:h-12 md:h-14 w-auto object-contain drop-shadow-[0_2px_8px_rgba(255,255,255,0.35)]"
              priority
            />
          </div>
        </div>
      </nav>
      </div>

      {message && (
        <div
          className={`mx-4 mt-4 max-w-[1600px] lg:mx-auto px-4 py-2 rounded-lg text-sm ${
            message.type === "success"
              ? "bg-emerald-950/50 border border-emerald-700 text-emerald-300"
              : "bg-red-950/50 border border-red-700 text-red-300"
          }`}
        >
          {message.text}
        </div>
      )}

      <main className="flex-1 min-h-0 max-w-[1600px] w-full mx-auto px-4 sm:px-6 py-6 pb-12">
        {loading ? (
          <div className="text-zinc-400 py-12 text-center">Loading...</div>
        ) : tab === "dashboard" ? (
          <DashboardView summary={summary} />
        ) : tab === "reports" ? (
          <ReportsView
            properties={properties}
            rentPayments={rentPayments}
            expenses={expenseRows}
            maintenance={maintenanceRows}
          />
        ) : (
          <div className="space-y-6">
            {!showArchived && formOpen && (
            <section className="rounded-xl border border-zinc-600/60 bg-zinc-800/90 p-4 sm:p-6">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h2 className="font-semibold text-lg">
                    {editingId ? "Edit Entry" : "New Entry"}
                  </h2>
                  {tab === "rent_ledger" && (
                    <p className="text-xs text-zinc-400 mt-1">
                      Selecting a property auto-fills rent due and tenant from the Properties tab.
                    </p>
                  )}
                  {tab === "investor_payout" && (
                    <p className="text-xs text-zinc-400 mt-1">
                      Selecting a property auto-fills the investor linked on the Investor tab.
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={closeForm}
                  className="text-xs px-3 py-1.5 rounded-lg border border-zinc-600 bg-zinc-700/80 text-zinc-300 hover:bg-zinc-700 shrink-0"
                >
                  Close
                </button>
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
                          className="form-select"
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
                          className="form-select"
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
                      ) : col.type === "investor" ? (
                        <select
                          value={form[col.key] ?? ""}
                          onChange={(e) =>
                            setForm((prev) => ({ ...prev, [col.key]: e.target.value }))
                          }
                          className="form-select"
                        >
                          <option value="">
                            {investors.length
                              ? "Select investor..."
                              : "No investors — add one on the Investor tab"}
                          </option>
                          {investors
                            .filter((investor) => investor.status === "Active")
                            .map((investor) => (
                              <option key={investor.id} value={investor.investor_name}>
                                {investor.investor_name}
                                {investor.property_name ? ` (${investor.property_name})` : ""}
                              </option>
                            ))}
                        </select>
                      ) : col.type === "select" ? (
                        <select
                          value={form[col.key] ?? ""}
                          onChange={(e) =>
                            setForm((prev) => ({ ...prev, [col.key]: e.target.value }))
                          }
                          className="form-select"
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
                          className={`form-field ${
                            tab === "rent_ledger" &&
                            col.key === "tenant_name" &&
                            form.property_name
                              ? "text-zinc-400 cursor-not-allowed bg-zinc-700/50"
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
                  className="mt-4 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium disabled:opacity-50"
                >
                  {saving ? "Saving..." : editingId ? "Update" : "Save"}
                </button>
              </form>
            </section>
            )}

            <section>
              <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                <h2 className="font-semibold text-lg">
                  {showArchived ? "Archive — " : ""}
                  {SHEET_TABS.find((s) => s.id === tab)?.label} ({rows.length})
                </h2>
                <div className="flex items-center gap-2 flex-wrap">
                  {!showArchived && (
                    <button
                      type="button"
                      onClick={openEntryForm}
                      className={`text-xs px-3 py-1.5 rounded-lg border ${
                        formOpen
                          ? "border-emerald-600/60 bg-emerald-950/40 text-emerald-300"
                          : "border-emerald-600/60 bg-emerald-900/30 text-emerald-300 hover:bg-emerald-900/50"
                      }`}
                    >
                      Add Row
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={toggleArchiveView}
                    className={`text-xs px-3 py-1.5 rounded-lg border ${
                      showArchived
                        ? "border-emerald-600/60 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/50"
                        : "border-zinc-600 bg-zinc-700/80 text-zinc-200 hover:bg-zinc-700"
                    }`}
                  >
                    {showArchived ? "Back to Active" : "View Archive"}
                  </button>
                </div>
              </div>
              {tab === "properties" && expandedProperty && (
                <PropertyDetailPanel
                  property={expandedProperty}
                  onCollapse={() => setExpandedProperty(null)}
                  onEdit={() => openEditForm(expandedProperty as unknown as Record<string, unknown>)}
                />
              )}
              <SpreadsheetTable
                columns={columns}
                rows={rows}
                archiveMode={showArchived}
                onArchive={handleArchive}
                onRestore={handleRestore}
                actionId={actionId}
                showProfitability={tab === "properties" && !showArchived}
                onProfitability={(row) => setProfitabilityProperty(row as unknown as Property)}
                showExpand={tab === "properties" && !showArchived}
                onExpand={(row) => setExpandedProperty(row as unknown as Property)}
                showPrintForm={tab === "investor_payout" && !showArchived}
                onPrintForm={handlePrintForm}
                printFormId={printFormId}
                showEdit={!showArchived}
                onEdit={openEditForm}
                editingId={editingId}
              />
            </section>
          </div>
        )}
      </main>

      {profitabilityProperty && profitability && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60"
          onClick={() => setProfitabilityProperty(null)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-zinc-600/60 bg-zinc-800 p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="font-semibold text-lg text-zinc-100">Profitability</h3>
                <p className="text-sm text-zinc-400 mt-0.5">{profitabilityProperty.property_name}</p>
              </div>
              <button
                type="button"
                onClick={() => setProfitabilityProperty(null)}
                className="text-zinc-400 hover:text-zinc-200 text-sm px-2 py-1"
              >
                Close
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-zinc-700/50 p-3">
                  <div className="text-xs text-zinc-400 uppercase tracking-wide">Monthly Rent</div>
                  <div className="text-emerald-400 font-semibold mt-1">
                    {formatCurrency(profitability.monthlyRent)}
                  </div>
                </div>
                <div className="rounded-lg bg-zinc-700/50 p-3">
                  <div className="text-xs text-zinc-400 uppercase tracking-wide">Monthly Expenses</div>
                  <div className="text-red-300 font-semibold mt-1">
                    {formatCurrency(profitability.monthlyExpenses)}
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-zinc-600/60 p-3 space-y-1.5 text-zinc-300">
                <div className="flex justify-between">
                  <span>Mortgage</span>
                  <span>{formatCurrency(profitability.monthlyMortgage)}</span>
                </div>
                <div className="flex justify-between">
                  <span>HOA</span>
                  <span>{formatCurrency(profitability.monthlyHoa)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Property Tax</span>
                  <span>{formatCurrency(profitability.monthlyTax)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Insurance</span>
                  <span>{formatCurrency(profitability.monthlyInsurance)}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-emerald-950/40 border border-emerald-700/50 p-3">
                  <div className="text-xs text-zinc-400 uppercase tracking-wide">Monthly Net</div>
                  <div
                    className={`font-semibold mt-1 ${
                      profitability.monthlyNet >= 0 ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {formatCurrency(profitability.monthlyNet)}
                  </div>
                </div>
                <div className="rounded-lg bg-emerald-950/40 border border-emerald-700/50 p-3">
                  <div className="text-xs text-zinc-400 uppercase tracking-wide">Annual Net</div>
                  <div
                    className={`font-semibold mt-1 ${
                      profitability.annualNet >= 0 ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {formatCurrency(profitability.annualNet)}
                  </div>
                </div>
              </div>
              {(profitability.capRate != null || profitability.cashOnCash != null) && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {profitability.capRate != null && (
                    <div className="rounded-lg bg-zinc-700/50 p-3">
                      <div className="text-xs text-zinc-400 uppercase tracking-wide">Cap Rate</div>
                      <div className="text-zinc-100 font-semibold mt-1">
                        {profitability.capRate.toFixed(1)}%
                      </div>
                    </div>
                  )}
                  {profitability.cashOnCash != null && (
                    <div className="rounded-lg bg-zinc-700/50 p-3">
                      <div className="text-xs text-zinc-400 uppercase tracking-wide">Cash on Cash</div>
                      <div className="text-zinc-100 font-semibold mt-1">
                        {profitability.cashOnCash.toFixed(1)}%
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <footer className="relative z-10 border-t border-zinc-600/60 bg-zinc-800/90 py-4 text-center text-xs text-zinc-500 shrink-0">
        HOP2IT Property Manager — Properties, Tenants, Leases, Rent Ledger, Expenses,
        Maintenance, Investor, Investor Payout, Reports
      </footer>
      </div>
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
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-zinc-600/60 bg-zinc-800/90 p-5"
          >
            <div className="text-xs text-zinc-400 uppercase tracking-wide mb-1">
              {card.label}
            </div>
            <div className="text-2xl font-semibold text-emerald-400">{card.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-zinc-600/60 bg-zinc-800/90 p-6">
        <div className="text-sm text-zinc-400 mb-2">Rent Collection Rate (Month to Date)</div>
        <div className="flex items-end gap-3">
          <div className="text-4xl font-semibold text-emerald-400">{collectionRate}%</div>
          <div className="text-sm text-zinc-500 pb-1">
            {formatCurrency(summary.monthly_rent_collected)} of{" "}
            {formatCurrency(summary.monthly_rent_expected)}
          </div>
        </div>
        <div className="mt-4 h-3 rounded-full bg-zinc-700 overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${Math.min(collectionRate, 100)}%` }}
          />
        </div>
      </div>

    </div>
  );
}