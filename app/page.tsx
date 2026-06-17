"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import InvestorPayoutSummaryPanel from "@/components/InvestorPayoutSummaryPanel";
import CommunicationView from "@/components/CommunicationView";
import PropertyDetailPanel from "@/components/PropertyDetailPanel";
import ReportsView from "@/components/ReportsView";
import SpreadsheetTable from "@/components/SpreadsheetTable";
import { loanSummaryFromPayout } from "@/lib/investor-payout-summary";
import {
  capitalOptionLabel,
  formatBusinessAddress,
  isCapitalRecord,
  nextCapitalId,
  nextPayoutSequence,
} from "@/lib/investor-records";
import { normalizeEntryCode } from "@/lib/property-entry-code";
import {
  getColumnsForTab,
  getInvestorFormSections,
  getPropertyFormSections,
  isInvestorTab,
  isManagementTab,
  isSettingsTab,
  MANAGEMENT_TABS,
  NAV_TABS_BEFORE_MANAGEMENT,
  SHEET_TABS,
  type ColumnDef,
} from "@/lib/columns";
import {
  canAccessTab,
  investorTabsForRole,
  navTabsAfterManagementForRole,
  settingsTabsForRole,
} from "@/lib/permissions";
import { formatCurrency, todayIso } from "@/lib/format";
import { requestReportPdf } from "@/lib/pdf-client";
import { propertyProfitability } from "@/lib/profitability";
import { rentDetailsForProperty, tenantDisplayName } from "@/lib/rent-ledger";
import type {
  Business,
  DashboardSummary,
  Expense,
  Investor,
  InvestorPayout,
  Lease,
  MaintenanceRecord,
  Property,
  RentPayment,
  SessionUser,
  SheetTab,
  Tenant,
} from "@/lib/types";

function apiFetch(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(input, { cache: "no-store", ...init });
}

type DataTab = Exclude<SheetTab, "dashboard" | "reports" | "communication">;

const API_MAP: Record<DataTab, string> = {
  businesses: "/api/businesses",
  properties: "/api/properties",
  tenants: "/api/tenants",
  leases: "/api/leases",
  rent_ledger: "/api/rent-payments",
  expenses: "/api/expenses",
  maintenance: "/api/maintenance",
  investors: "/api/investors",
  investor_capital: "/api/investor-payouts",
  investor_payout: "/api/investor-payouts",
  users: "/api/users",
};

function isInvestorRecordTab(tab: SheetTab): boolean {
  return tab === "investor_capital" || tab === "investor_payout";
}

function buildInvestorRecordPayload(
  tab: SheetTab,
  form: Record<string, string>,
  columns: ColumnDef[],
  editingId: number | null,
  rows: Record<string, unknown>[]
): Record<string, unknown> {
  const partial = payloadFromForm(form, columns);
  if (tab === "investor_capital") {
    if (editingId != null) {
      const existing = rows.find((row) => Number(row.id) === editingId);
      if (existing) return { record_kind: "capital", ...existing, ...partial };
    }
    return {
      record_kind: "capital",
      payout_type: "Return of Capital",
      payout_amount: 0,
      status: "Pending",
      ...partial,
    };
  }
  if (tab === "investor_payout") {
    if (editingId != null) {
      const existing = rows.find((row) => Number(row.id) === editingId);
      if (existing) return { record_kind: "payout", ...existing, ...partial };
    }
    return { record_kind: "payout", ...partial };
  }
  return partial;
}

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
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyBusinessFilter, setPropertyBusinessFilter] = useState("");
  const [capitalBusinessFilter, setCapitalBusinessFilter] = useState("");
  const [capitalBusinessConfirm, setCapitalBusinessConfirm] = useState<{
    businessName: string;
  } | null>(null);
  const [managementMenuOpen, setManagementMenuOpen] = useState(false);
  const [managementMenuPosition, setManagementMenuPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const managementButtonRef = useRef<HTMLButtonElement>(null);
  const managementDropdownRef = useRef<HTMLDivElement>(null);
  const [investorMenuOpen, setInvestorMenuOpen] = useState(false);
  const [investorMenuPosition, setInvestorMenuPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const investorButtonRef = useRef<HTMLButtonElement>(null);
  const investorDropdownRef = useRef<HTMLDivElement>(null);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const [settingsMenuPosition, setSettingsMenuPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const settingsDropdownRef = useRef<HTMLDivElement>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [rentPayments, setRentPayments] = useState<RentPayment[]>([]);
  const [expenseRows, setExpenseRows] = useState<Expense[]>([]);
  const [maintenanceRows, setMaintenanceRows] = useState<MaintenanceRecord[]>([]);
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [investorPayoutRows, setInvestorPayoutRows] = useState<InvestorPayout[]>([]);
  const [investorCapitalRows, setInvestorCapitalRows] = useState<InvestorPayout[]>([]);
  const [profitabilityProperty, setProfitabilityProperty] = useState<Property | null>(null);
  const [expandedProperty, setExpandedProperty] = useState<Property | null>(null);
  const [entryCodeModal, setEntryCodeModal] = useState<{
    property: Property;
    draft: string;
  } | null>(null);
  const [entryCodeSaving, setEntryCodeSaving] = useState(false);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);

  const userRole = sessionUser?.role ?? "standard";
  const visibleSettingsTabs = useMemo(
    () => settingsTabsForRole(userRole),
    [userRole]
  );
  const visibleNavAfterManagement = useMemo(
    () => navTabsAfterManagementForRole(userRole),
    [userRole]
  );
  const visibleInvestorTabs = useMemo(
    () => investorTabsForRole(userRole),
    [userRole]
  );

  const columns = useMemo(() => getColumnsForTab(tab), [tab]);
  const investorFormSections = useMemo(() => {
    if (tab === "investor_capital" || tab === "investor_payout") {
      return getInvestorFormSections(tab);
    }
    return null;
  }, [tab]);
  const propertyFormSections = useMemo(() => {
    if (tab === "properties") {
      return getPropertyFormSections();
    }
    return null;
  }, [tab]);
  const investorPayoutFormSummary = useMemo(() => {
    if (tab !== "investor_capital" || !formOpen) return null;
    return {
      property_address: form.property_address || null,
      loan_date: form.loan_date || null,
      sell_estimate_date: form.sell_estimate_date || null,
      investor_name: form.investor_name || null,
      attorney: form.attorney || null,
      amount_loaned: form.amount_loaned ? Number(form.amount_loaned) : null,
      annual_interest_rate: form.annual_interest_rate
        ? Number(form.annual_interest_rate)
        : null,
      kicker: form.kicker ? Number(form.kicker) : null,
      days_in_year: form.days_in_year ? Number(form.days_in_year) : 365,
    };
  }, [tab, formOpen, form]);
  const displayRows = useMemo(() => {
    if (tab === "properties" && propertyBusinessFilter) {
      return rows.filter((row) => row.business_name === propertyBusinessFilter);
    }
    if (tab === "investor_capital" && capitalBusinessFilter) {
      return rows.filter((row) => row.business_name === capitalBusinessFilter);
    }
    return rows;
  }, [tab, rows, propertyBusinessFilter, capitalBusinessFilter]);
  const capitalFormProperties = useMemo(() => {
    if (tab !== "investor_capital" || !form.business_name?.trim()) return properties;
    return properties.filter(
      (property) => property.business_name === form.business_name
    );
  }, [tab, form.business_name, properties]);
  const businessFilterOptions = useMemo(
    () =>
      businesses
        .filter((business) => business.status === "Active")
        .map((business) => business.business_name)
        .sort((a, b) => a.localeCompare(b)),
    [businesses]
  );
  const nextCapitalIdPreview = useMemo(() => {
    if (tab !== "investor_capital" || editingId != null) return "";
    return String(nextCapitalId(rows.map((row) => row as unknown as InvestorPayout)));
  }, [tab, editingId, rows]);

  const propertyBusinessOptions = useMemo(() => {
    const names = new Set<string>();
    for (const business of businesses) {
      if (business.status === "Active") names.add(business.business_name);
    }
    for (const property of properties) {
      if (property.business_name) names.add(property.business_name);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [businesses, properties]);

  const investorCapitalSource = useMemo(() => {
    if (tab === "investor_capital") {
      return rows.map((row) => row as unknown as InvestorPayout);
    }
    return investorPayoutRows.filter((payout) => isCapitalRecord(payout));
  }, [tab, rows, investorPayoutRows]);
  const investorPayoutTableSummaries = useMemo(
    () =>
      investorCapitalSource
        .map((payout) => ({
          payout,
          summary: loanSummaryFromPayout(payout),
        }))
        .filter((entry) => entry.summary != null),
    [investorCapitalSource]
  );
  const nextPayoutIdPreview = useMemo(() => {
    if (tab !== "investor_payout" || !form.capital_id?.trim()) return "";
    return String(
      nextPayoutSequence(
        form.capital_id,
        editingId != null
          ? rows.map((row) => row as unknown as InvestorPayout)
          : [...rows, ...investorCapitalRows].map((row) => row as unknown as InvestorPayout)
      )
    );
  }, [tab, form.capital_id, editingId, rows, investorCapitalRows]);
  const profitability = useMemo(
    () => (profitabilityProperty ? propertyProfitability(profitabilityProperty) : null),
    [profitabilityProperty]
  );

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const loadSession = useCallback(async () => {
    const res = await apiFetch("/api/auth/me");
    const json = await res.json();
    if (json.success) setSessionUser(json.data);
  }, []);

  const loadDashboard = useCallback(async () => {
    const res = await apiFetch("/api/summary");
    const json = await res.json();
    if (json.success) setSummary(json.data);
  }, []);

  const loadBusinesses = useCallback(async () => {
    const res = await apiFetch("/api/businesses");
    const json = await res.json();
    if (json.success) setBusinesses(json.data);
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

  const loadInvestorPayoutRows = useCallback(async () => {
    const res = await apiFetch("/api/investor-payouts");
    const json = await res.json();
    if (json.success) setInvestorPayoutRows(json.data);
  }, []);

  const loadInvestorCapitalRows = useCallback(async (archived = false) => {
    const url = archived
      ? "/api/investor-payouts?kind=capital&archived=1"
      : "/api/investor-payouts?kind=capital";
    const res = await apiFetch(url);
    const json = await res.json();
    if (json.success) setInvestorCapitalRows(json.data);
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
          loadInvestors(),
          loadInvestorPayoutRows(),
        ]);
        setRows([]);
        return;
      }
      if (activeTab === "communication") {
        await Promise.all([loadTenants(), loadRentPayments(), loadMaintenanceRows()]);
        setRows([]);
        return;
      }
      if (activeTab === "properties") {
        await loadBusinesses();
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
        isInvestorRecordTab(activeTab)
      ) {
        await Promise.all([
          loadProperties(),
          activeTab === "investor_capital" ? loadBusinesses() : Promise.resolve(),
        ]);
      }
      if (isInvestorRecordTab(activeTab)) {
        await loadInvestors();
      }
      if (activeTab === "investor_payout") {
        await loadInvestorCapitalRows(archived);
      }
      const endpoint = API_MAP[activeTab];
      const kind = activeTab === "investor_capital"
        ? "capital"
        : activeTab === "investor_payout"
          ? "payout"
          : null;
      const params = new URLSearchParams();
      if (archived) params.set("archived", "1");
      if (kind) params.set("kind", kind);
      const url = params.size > 0 ? `${endpoint}?${params.toString()}` : endpoint;
      const res = await apiFetch(url);
      const json = await res.json();
      if (json.success) setRows(json.data);
    },
    [
      loadDashboard,
      loadBusinesses,
      loadProperties,
      loadTenants,
      loadLeases,
      loadRentPayments,
      loadExpenseRows,
      loadMaintenanceRows,
      loadInvestors,
      loadInvestorPayoutRows,
      loadInvestorCapitalRows,
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
    if (tab === "investor_capital" && fieldKey === "property_name") {
      if (!propertyName) {
        setForm((prev) => ({
          ...prev,
          property_name: "",
          property_address: "",
          investor_name: "",
        }));
        return;
      }
      const property = properties.find((item) => item.property_name === propertyName);
      const propertyAddress = property
        ? [property.address, property.city, property.state, property.zip]
            .filter(Boolean)
            .join(", ")
        : "";
      const linkedBusiness = property?.business_name
        ? businesses.find((business) => business.business_name === property.business_name)
        : undefined;
      const linkedInvestor = investors.find(
        (investor) =>
          investor.property_name === propertyName && investor.status === "Active"
      );
      setForm((prev) => ({
        ...prev,
        property_name: propertyName,
        property_address: propertyAddress || prev.property_address,
        business_name: property?.business_name ?? prev.business_name,
        business_address: linkedBusiness
          ? formatBusinessAddress(linkedBusiness)
          : prev.business_address,
        investor_name: linkedInvestor?.investor_name ?? prev.investor_name,
      }));
      return;
    }
    setForm((prev) => ({ ...prev, [fieldKey]: propertyName }));
  };

  const applyCapitalBusinessSelection = (businessName: string) => {
    if (!businessName) {
      setForm((prev) => ({
        ...prev,
        business_name: "",
        business_address: "",
        property_name: "",
        property_address: "",
        investor_name: "",
      }));
      return;
    }
    const business = businesses.find((item) => item.business_name === businessName);
    setForm((prev) => ({
      ...prev,
      business_name: businessName,
      business_address: business ? formatBusinessAddress(business) : "",
      property_name: "",
      property_address: "",
      investor_name: "",
    }));
  };

  const handleBusinessSelect = (businessName: string) => {
    if (tab !== "investor_capital") {
      setForm((prev) => ({ ...prev, business_name: businessName }));
      return;
    }
    const previousBusiness = form.business_name;
    const hasSelectedProperty = Boolean(form.property_name?.trim());
    const isBusinessChange = businessName !== previousBusiness;

    if (hasSelectedProperty && isBusinessChange) {
      setCapitalBusinessConfirm({ businessName });
      return;
    }

    applyCapitalBusinessSelection(businessName);
  };

  const confirmCapitalBusinessChange = () => {
    if (!capitalBusinessConfirm) return;
    applyCapitalBusinessSelection(capitalBusinessConfirm.businessName);
    setCapitalBusinessConfirm(null);
  };

  const cancelCapitalBusinessChange = () => {
    setCapitalBusinessConfirm(null);
  };

  const handleCapitalSelect = (capitalId: string) => {
    if (tab !== "investor_payout") return;
    if (!capitalId) {
      setForm((prev) => ({
        ...prev,
        capital_id: "",
        property_name: "",
        investor_name: "",
        property_address: "",
        payout_id: "",
      }));
      return;
    }
    const capital = investorCapitalRows.find((row) => row.payout_id === capitalId);
    const payoutRows = rows.map((row) => row as unknown as InvestorPayout);
    const nextId = String(nextPayoutSequence(capitalId, payoutRows));
    setForm((prev) => ({
      ...prev,
      capital_id: capitalId,
      property_name: capital?.property_name ?? "",
      investor_name: capital?.investor_name ?? "",
      property_address: capital?.property_address ?? "",
      payout_id: editingId != null ? prev.payout_id : nextId,
    }));
  };

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await loadSession();
      await Promise.all([loadDashboard(), loadTabData(tab, showArchived)]);
    } catch {
      showMessage("error", "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, [loadDashboard, loadSession, loadTabData, tab, showArchived]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!sessionUser) return;
    if (!canAccessTab(sessionUser.role, tab)) {
      setTab("dashboard");
      setLoading(true);
      loadTabData("dashboard", false)
        .then(() => loadDashboard())
        .finally(() => setLoading(false));
    }
  }, [sessionUser, tab, loadDashboard, loadTabData]);

  const updateManagementMenuPosition = useCallback(() => {
    if (!managementButtonRef.current) return;
    const rect = managementButtonRef.current.getBoundingClientRect();
    setManagementMenuPosition({
      top: rect.bottom + 4,
      left: rect.left,
    });
  }, []);

  const closeManagementMenu = useCallback(() => {
    setManagementMenuOpen(false);
    setManagementMenuPosition(null);
  }, []);

  const updateInvestorMenuPosition = useCallback(() => {
    if (!investorButtonRef.current) return;
    const rect = investorButtonRef.current.getBoundingClientRect();
    setInvestorMenuPosition({
      top: rect.bottom + 4,
      left: rect.left,
    });
  }, []);

  const closeInvestorMenu = useCallback(() => {
    setInvestorMenuOpen(false);
    setInvestorMenuPosition(null);
  }, []);

  const toggleInvestorMenu = useCallback(() => {
    if (investorMenuOpen) {
      closeInvestorMenu();
      return;
    }
    setSettingsMenuOpen(false);
    setSettingsMenuPosition(null);
    closeManagementMenu();
    updateInvestorMenuPosition();
    setInvestorMenuOpen(true);
  }, [
    closeInvestorMenu,
    closeManagementMenu,
    investorMenuOpen,
    updateInvestorMenuPosition,
  ]);

  const toggleManagementMenu = useCallback(() => {
    if (managementMenuOpen) {
      closeManagementMenu();
      return;
    }
    setSettingsMenuOpen(false);
    setSettingsMenuPosition(null);
    closeInvestorMenu();
    updateManagementMenuPosition();
    setManagementMenuOpen(true);
  }, [
    closeInvestorMenu,
    closeManagementMenu,
    managementMenuOpen,
    updateManagementMenuPosition,
  ]);

  const updateSettingsMenuPosition = useCallback(() => {
    if (!settingsButtonRef.current) return;
    const rect = settingsButtonRef.current.getBoundingClientRect();
    setSettingsMenuPosition({
      top: rect.bottom + 4,
      left: rect.left,
    });
  }, []);

  const closeSettingsMenu = useCallback(() => {
    setSettingsMenuOpen(false);
    setSettingsMenuPosition(null);
  }, []);

  const toggleSettingsMenu = useCallback(() => {
    if (settingsMenuOpen) {
      closeSettingsMenu();
      return;
    }
    closeManagementMenu();
    closeInvestorMenu();
    updateSettingsMenuPosition();
    setSettingsMenuOpen(true);
  }, [
    closeInvestorMenu,
    closeManagementMenu,
    closeSettingsMenu,
    settingsMenuOpen,
    updateSettingsMenuPosition,
  ]);

  useEffect(() => {
    if (!managementMenuOpen) return;
    updateManagementMenuPosition();
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        managementButtonRef.current?.contains(target) ||
        managementDropdownRef.current?.contains(target)
      ) {
        return;
      }
      closeManagementMenu();
    };
    const handleReposition = () => updateManagementMenuPosition();
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [
    closeManagementMenu,
    managementMenuOpen,
    updateManagementMenuPosition,
  ]);

  useEffect(() => {
    if (!investorMenuOpen) return;
    updateInvestorMenuPosition();
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        investorButtonRef.current?.contains(target) ||
        investorDropdownRef.current?.contains(target)
      ) {
        return;
      }
      closeInvestorMenu();
    };
    const handleReposition = () => updateInvestorMenuPosition();
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [closeInvestorMenu, investorMenuOpen, updateInvestorMenuPosition]);

  useEffect(() => {
    if (!settingsMenuOpen) return;
    updateSettingsMenuPosition();
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        settingsButtonRef.current?.contains(target) ||
        settingsDropdownRef.current?.contains(target)
      ) {
        return;
      }
      closeSettingsMenu();
    };
    const handleReposition = () => updateSettingsMenuPosition();
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [closeSettingsMenu, settingsMenuOpen, updateSettingsMenuPosition]);

  useEffect(() => {
    if (tab !== "dashboard" && tab !== "reports" && tab !== "communication") {
      setForm(emptyForm(columns));
      setFormOpen(false);
      setEditingId(null);
    }
  }, [tab, columns]);

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setCapitalBusinessConfirm(null);
    setForm(emptyForm(columns));
  };

  const openEntryForm = () => {
    setEditingId(null);
    const nextForm = emptyForm(columns);
    if (tab === "investor_capital" || tab === "investor_payout") nextForm.days_in_year = "365";
    if (tab === "investor_capital" && capitalBusinessFilter) {
      const business = businesses.find(
        (item) => item.business_name === capitalBusinessFilter
      );
      nextForm.business_name = capitalBusinessFilter;
      nextForm.business_address = business ? formatBusinessAddress(business) : "";
    }
    if (tab === "users") nextForm.password = "";
    setForm(nextForm);
    setFormOpen(true);
  };

  const openEditForm = (row: Record<string, unknown>) => {
    setEditingId(Number(row.id));
    const nextForm = rowToForm(row, columns);
    if (tab === "investor_capital" && nextForm.business_name && !nextForm.business_address) {
      const business = businesses.find(
        (item) => item.business_name === nextForm.business_name
      );
      if (business) nextForm.business_address = formatBusinessAddress(business);
    }
    if (tab === "users") nextForm.password = "";
    setForm(nextForm);
    setFormOpen(true);
    setExpandedProperty(null);
  };

  const applyPropertyUpdate = (property: Property) => {
    const saved = property as unknown as Record<string, unknown>;
    setRows((prev) => prev.map((row) => (Number(row.id) === property.id ? saved : row)));
    setProperties((prev) => prev.map((item) => (item.id === property.id ? property : item)));
    if (expandedProperty?.id === property.id) {
      setExpandedProperty(property);
    }
    if (entryCodeModal?.property.id === property.id) {
      setEntryCodeModal((prev) =>
        prev ? { ...prev, property, draft: property.entry_code ?? "" } : prev
      );
    }
  };

  const openEntryCodeModal = (row: Record<string, unknown>) => {
    const property = row as unknown as Property;
    setEntryCodeModal({
      property,
      draft: property.entry_code ?? "",
    });
  };

  const closeEntryCodeModal = () => {
    if (entryCodeSaving) return;
    setEntryCodeModal(null);
  };

  const saveEntryCode = async () => {
    if (!entryCodeModal) return;
    let entryCode: string | null;
    try {
      entryCode = normalizeEntryCode(entryCodeModal.draft);
    } catch (error) {
      showMessage("error", (error as Error).message);
      return;
    }

    setEntryCodeSaving(true);
    try {
      const res = await apiFetch(`/api/properties?id=${entryCodeModal.property.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entry_code: entryCode }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Save failed");
      applyPropertyUpdate(json.data as Property);
      showMessage("success", entryCode ? "Entry code saved." : "Entry code cleared.");
      setEntryCodeModal(null);
    } catch (error) {
      showMessage("error", (error as Error).message);
    } finally {
      setEntryCodeSaving(false);
    }
  };

  const handleTabChange = async (next: SheetTab) => {
    if (!canAccessTab(userRole, next)) {
      showMessage("error", "You do not have access to that section.");
      return;
    }
    setShowArchived(false);
    setFormOpen(false);
    setExpandedProperty(null);
    setEntryCodeModal(null);
    setCapitalBusinessConfirm(null);
    closeManagementMenu();
    closeInvestorMenu();
    closeSettingsMenu();
    if (next !== "properties") setPropertyBusinessFilter("");
    if (next !== "investor_capital") setCapitalBusinessFilter("");
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
    if (tab === "dashboard" || tab === "reports" || tab === "communication") return;

    const missing = columns.find((c) => {
      if (
        tab === "investor_payout" &&
        (c.key === "payout_id" || c.key === "property_name" || c.key === "investor_name")
      ) {
        return false;
      }
      if (
        tab === "investor_capital" &&
        (c.key === "payout_id" || c.key === "business_address")
      ) {
        return false;
      }
      return c.required && !form[c.key]?.trim();
    });
    if (missing) {
      showMessage("error", `${missing.label} is required.`);
      return;
    }
    if (tab === "investor_payout" && !form.capital_id?.trim()) {
      showMessage("error", "Capital ID is required.");
      return;
    }

    setSaving(true);
    try {
      const endpoint = API_MAP[tab];
      const isEdit = editingId != null;
      const url = isEdit ? `${endpoint}?id=${editingId}` : endpoint;
      let payload: Record<string, unknown> = isInvestorRecordTab(tab)
        ? buildInvestorRecordPayload(tab, form, columns, editingId, rows)
        : payloadFromForm(form, columns);
      if (tab === "users") {
        if (!isEdit && !form.password?.trim()) {
          showMessage("error", "Password is required for new users.");
          setSaving(false);
          return;
        }
        if (form.password?.trim()) payload.password = form.password.trim();
      }
      const res = await apiFetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
    if (tab === "dashboard" || tab === "reports" || tab === "communication") return;
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
      await requestReportPdf("investor_payout_form", {
        payout: {
          payout_id: payout.payout_id,
          date: payout.date,
          property_name: payout.property_name,
          property_address: payout.property_address,
          loan_date: payout.loan_date,
          sell_estimate_date: payout.sell_estimate_date,
          investor_name: payout.investor_name,
          attorney: payout.attorney,
          amount_loaned: payout.amount_loaned,
          annual_interest_rate: payout.annual_interest_rate,
          kicker: payout.kicker,
          days_in_year: payout.days_in_year,
          payout_type: payout.payout_type,
          payout_amount: payout.payout_amount,
          payment_method: payout.payment_method,
          payment_date: payout.payment_date,
          tax_year: payout.tax_year,
          status: payout.status,
          notes: payout.notes,
        },
      });
    } catch (error) {
      showMessage("error", (error as Error).message);
    } finally {
      setPrintFormId(null);
    }
  };

  const handleRestore = async (id: number) => {
    if (tab === "dashboard" || tab === "reports" || tab === "communication") return;
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

  const handleLogout = async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/login";
    } catch (error) {
      showMessage("error", (error as Error).message);
    }
  };

  const tableRows =
    tab === "properties" || tab === "investor_capital" ? displayRows : rows;

  const exportCsv = () => {
    if (tab === "dashboard" || tab === "reports" || tab === "communication" || tableRows.length === 0)
      return;
    const headers = columns.map((c) => c.label);
    const lines = [
      headers.join(","),
      ...tableRows.map((row) =>
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

  const navTabClass = (active: boolean) =>
    `h-11 px-4 text-sm whitespace-nowrap border-b-2 transition inline-flex items-center gap-1.5 shrink-0 ${
      active
        ? "border-emerald-400 text-emerald-300 bg-zinc-700/50"
        : "border-transparent text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700/40"
    }`;

  const navGearClass = (active: boolean) =>
    `h-11 px-2 sm:px-3 border-b-2 transition inline-flex items-center justify-center shrink-0 ${
      active
        ? "border-emerald-400 text-emerald-300 bg-zinc-700/50"
        : "border-transparent text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700/40"
    }`;

  const formGridClass =
    "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3";

  const renderFormField = (col: ColumnDef) => (
    <label key={col.key} className="block">
      <span className="text-xs font-semibold uppercase tracking-wide text-amber-400 mb-1 block">
        {col.label}
        {col.required ? " *" : ""}
      </span>
      {col.type === "property" ? (
        <select
          value={form[col.key] ?? ""}
          onChange={(e) => handlePropertySelect(e.target.value, col.key)}
          disabled={
            tab === "investor_payout" ||
            (tab === "investor_capital" &&
              (editingId != null || Boolean(form.property_name)))
          }
          className={`form-select ${
            tab === "investor_payout" ||
            (tab === "investor_capital" &&
              (editingId != null || Boolean(form.property_name)))
              ? "text-zinc-400 cursor-not-allowed bg-zinc-700/50"
              : ""
          }`}
        >
          <option value="">
            {tab === "investor_capital" && !form.business_name
              ? "Select business first..."
              : (tab === "investor_capital" ? capitalFormProperties : properties).length
                ? "Select property..."
                : "No properties — add one in Properties tab"}
          </option>
          {(tab === "investor_capital" ? capitalFormProperties : properties).map((property) => (
            <option key={property.id} value={property.property_name}>
              {property.property_name}
            </option>
          ))}
        </select>
      ) : col.type === "tenant" ? (
        <select
          value={form[col.key] ?? ""}
          onChange={(e) => setForm((prev) => ({ ...prev, [col.key]: e.target.value }))}
          className="form-select"
        >
          <option value="">
            {tenants.length ? "Select tenant..." : "No tenants — add one in Tenants tab"}
          </option>
          {tenants.map((tenant) => (
            <option key={tenant.id} value={tenantDisplayName(tenant)}>
              {tenantDisplayName(tenant)}
              {tenant.property_name ? ` (${tenant.property_name})` : ""}
            </option>
          ))}
        </select>
      ) : col.type === "capital" ? (
        <select
          value={form[col.key] ?? ""}
          onChange={(e) => handleCapitalSelect(e.target.value)}
          className="form-select"
        >
          <option value="">
            {investorCapitalRows.length
              ? "Select capital..."
              : "No capital records — add one on the Capital tab"}
          </option>
          {investorCapitalRows.map((capital) => (
            <option key={capital.id} value={capital.payout_id}>
              {capitalOptionLabel(capital)}
            </option>
          ))}
        </select>
      ) : col.type === "investor" ? (
        <select
          value={form[col.key] ?? ""}
          onChange={(e) => setForm((prev) => ({ ...prev, [col.key]: e.target.value }))}
          disabled={tab === "investor_payout"}
          className={`form-select ${
            tab === "investor_payout" ? "text-zinc-400 cursor-not-allowed bg-zinc-700/50" : ""
          }`}
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
      ) : col.type === "business" ? (
        <select
          value={form[col.key] ?? ""}
          onChange={(e) => handleBusinessSelect(e.target.value)}
          className="form-select"
        >
          <option value="">
            {businesses.length
              ? "Select business..."
              : "No businesses — add one on the Business tab"}
          </option>
          {businesses
            .filter((business) => business.status === "Active")
            .map((business) => (
              <option key={business.id} value={business.business_name}>
                {business.business_name}
              </option>
            ))}
        </select>
      ) : col.type === "select" ? (
        <select
          value={form[col.key] ?? ""}
          onChange={(e) => setForm((prev) => ({ ...prev, [col.key]: e.target.value }))}
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
          value={
            tab === "investor_payout" && col.key === "payout_id" && !editingId
              ? nextPayoutIdPreview || form[col.key] || ""
              : tab === "investor_capital" && col.key === "payout_id" && !editingId
                ? nextCapitalIdPreview || form[col.key] || ""
                : (form[col.key] ?? "")
          }
          readOnly={
            (tab === "rent_ledger" &&
              col.key === "tenant_name" &&
              Boolean(form.property_name)) ||
            (tab === "investor_payout" && col.key === "payout_id") ||
            (tab === "investor_capital" && col.key === "payout_id") ||
            (tab === "investor_capital" &&
              (col.key === "business_address" || col.key === "property_address")) ||
            (tab === "investor_payout" &&
              col.key === "property_name" &&
              Boolean(form.capital_id))
          }
          onChange={(e) => setForm((prev) => ({ ...prev, [col.key]: e.target.value }))}
          placeholder={
            (tab === "investor_payout" || tab === "investor_capital") &&
            col.key === "payout_id" &&
            !editingId
              ? "Auto-assigned"
              : undefined
          }
          className={`form-field ${
            (tab === "rent_ledger" && col.key === "tenant_name" && form.property_name) ||
            (tab === "investor_payout" &&
              (col.key === "payout_id" ||
                (col.key === "property_name" && form.capital_id))) ||
            (tab === "investor_capital" &&
              (col.key === "payout_id" ||
                col.key === "business_address" ||
                col.key === "property_address"))
              ? "text-zinc-400 cursor-not-allowed bg-zinc-700/50"
              : ""
          }`}
        />
      )}
    </label>
  );

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
        <div className="flex items-stretch w-full">
          <div className="shrink-0 flex items-stretch pl-2 sm:pl-4">
            <button
              ref={settingsButtonRef}
              type="button"
              onClick={toggleSettingsMenu}
              aria-label="Settings"
              aria-expanded={settingsMenuOpen}
              aria-haspopup="menu"
              title="Settings"
              className={navGearClass(isSettingsTab(tab) || settingsMenuOpen)}
            >
              <svg
                className="w-8 h-8"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>
          </div>
          <div className="flex items-stretch min-w-0 flex-1 overflow-x-auto overflow-y-visible">
            {NAV_TABS_BEFORE_MANAGEMENT.map((sheet) => (
              <button
                key={sheet.id}
                type="button"
                onClick={() => handleTabChange(sheet.id)}
                className={navTabClass(tab === sheet.id)}
              >
                {sheet.label}
              </button>
            ))}
            <button
              ref={managementButtonRef}
              type="button"
              onClick={toggleManagementMenu}
              className={navTabClass(isManagementTab(tab) || managementMenuOpen)}
              aria-expanded={managementMenuOpen}
              aria-haspopup="menu"
            >
              Management
              <span
                className={`text-[10px] leading-none transition-transform ${
                  managementMenuOpen ? "rotate-180" : ""
                }`}
                aria-hidden
              >
                ▼
              </span>
            </button>
            {visibleInvestorTabs.length > 0 && (
              <button
                ref={investorButtonRef}
                type="button"
                onClick={toggleInvestorMenu}
                className={navTabClass(isInvestorTab(tab) || investorMenuOpen)}
                aria-expanded={investorMenuOpen}
                aria-haspopup="menu"
              >
                Investor
                <span
                  className={`text-[10px] leading-none transition-transform ${
                    investorMenuOpen ? "rotate-180" : ""
                  }`}
                  aria-hidden
                >
                  ▼
                </span>
              </button>
            )}
            {visibleNavAfterManagement.map((sheet) => (
              <button
                key={sheet.id}
                type="button"
                onClick={() => handleTabChange(sheet.id)}
                className={navTabClass(tab === sheet.id)}
              >
                {sheet.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 pr-2 sm:pr-4 pl-3">
            {tab !== "dashboard" &&
              tab !== "reports" &&
              tab !== "communication" &&
              tableRows.length > 0 && (
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
            <button
              type="button"
              onClick={handleLogout}
              className="text-xs px-3 py-1.5 rounded-lg border border-zinc-600 bg-zinc-700/80 text-zinc-200 hover:bg-zinc-700"
            >
              Logout
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
      {investorMenuOpen && investorMenuPosition && (
        <div
          ref={investorDropdownRef}
          role="menu"
          className="fixed z-[100] min-w-[11rem] rounded-lg border border-zinc-600/80 bg-zinc-800 py-1 shadow-2xl"
          style={{
            top: investorMenuPosition.top,
            left: investorMenuPosition.left,
          }}
        >
          {visibleInvestorTabs.map((sheet) => (
            <button
              key={sheet.id}
              type="button"
              role="menuitem"
              onClick={() => handleTabChange(sheet.id)}
              className={`block w-full px-4 py-2.5 text-left text-sm transition ${
                tab === sheet.id
                  ? "bg-emerald-950/50 text-emerald-300"
                  : "text-zinc-200 hover:bg-zinc-700/80 hover:text-zinc-100"
              }`}
            >
              {sheet.label}
            </button>
          ))}
        </div>
      )}
      {managementMenuOpen && managementMenuPosition && (
        <div
          ref={managementDropdownRef}
          role="menu"
          className="fixed z-[100] min-w-[11rem] rounded-lg border border-zinc-600/80 bg-zinc-800 py-1 shadow-2xl"
          style={{
            top: managementMenuPosition.top,
            left: managementMenuPosition.left,
          }}
        >
          {MANAGEMENT_TABS.map((sheet) => (
            <button
              key={sheet.id}
              type="button"
              role="menuitem"
              onClick={() => handleTabChange(sheet.id)}
              className={`block w-full px-4 py-2.5 text-left text-sm transition ${
                tab === sheet.id
                  ? "bg-emerald-950/50 text-emerald-300"
                  : "text-zinc-200 hover:bg-zinc-700/80 hover:text-zinc-100"
              }`}
            >
              {sheet.label}
            </button>
          ))}
        </div>
      )}
      {settingsMenuOpen && settingsMenuPosition && (
        <div
          ref={settingsDropdownRef}
          role="menu"
          className="fixed z-[100] min-w-[11rem] rounded-lg border border-zinc-600/80 bg-zinc-800 py-1 shadow-2xl"
          style={{
            top: settingsMenuPosition.top,
            left: settingsMenuPosition.left,
          }}
        >
          {visibleSettingsTabs.map((sheet) => (
            <button
              key={sheet.id}
              type="button"
              role="menuitem"
              onClick={() => handleTabChange(sheet.id)}
              className={`block w-full px-4 py-2.5 text-left text-sm transition ${
                tab === sheet.id
                  ? "bg-emerald-950/50 text-emerald-300"
                  : "text-zinc-200 hover:bg-zinc-700/80 hover:text-zinc-100"
              }`}
            >
              {sheet.label}
            </button>
          ))}
        </div>
      )}
      </div>

      {entryCodeModal && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="entry-code-modal-title"
        >
          <div className="w-full max-w-md rounded-xl border-2 border-red-600 bg-zinc-900 shadow-2xl overflow-hidden">
            <div className="bg-red-950 px-5 py-4 border-b border-red-700">
              <h3 id="entry-code-modal-title" className="text-lg font-semibold text-red-300">
                Entry Code
              </h3>
              <p className="text-sm text-red-200/80 mt-1">{entryCodeModal.property.property_name}</p>
            </div>
            <div className="px-5 py-4 space-y-3">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-amber-400 mb-1 block">
                  Numeric Code
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={entryCodeModal.draft}
                  onChange={(e) =>
                    setEntryCodeModal((prev) =>
                      prev ? { ...prev, draft: e.target.value.replace(/\D/g, "") } : prev
                    )
                  }
                  className="form-field"
                  placeholder="Enter numeric entry code"
                  autoFocus
                />
              </label>
              <p className="text-xs text-zinc-400">
                Leave blank and save to clear the entry code for this property.
              </p>
            </div>
            <div className="flex justify-end gap-2 px-5 pb-5">
              <button
                type="button"
                onClick={closeEntryCodeModal}
                disabled={entryCodeSaving}
                className="px-4 py-2 rounded-lg border border-zinc-600 bg-zinc-800 text-zinc-200 text-sm hover:bg-zinc-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEntryCode}
                disabled={entryCodeSaving}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium disabled:opacity-50"
              >
                {entryCodeSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {capitalBusinessConfirm && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="capital-business-confirm-title"
        >
          <div className="w-full max-w-md rounded-xl border-2 border-red-600 bg-zinc-900 shadow-2xl overflow-hidden">
            <div className="bg-red-950 px-5 py-4 border-b border-red-700">
              <h3
                id="capital-business-confirm-title"
                className="text-lg font-semibold text-red-300"
              >
                Please confirm this selection
              </h3>
            </div>
            <p className="px-5 py-4 text-sm text-zinc-200 leading-relaxed">
              Changing the business will clear the selected property so you can choose one for the
              new business.
            </p>
            <div className="flex justify-end gap-2 px-5 pb-5">
              <button
                type="button"
                onClick={cancelCapitalBusinessChange}
                className="px-4 py-2 rounded-lg border border-zinc-600 bg-zinc-800 text-zinc-200 text-sm hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmCapitalBusinessChange}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

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
            investorPayouts={investorPayoutRows}
            investors={investors}
          />
        ) : tab === "communication" ? (
          <CommunicationView
            tenants={tenants}
            rentPayments={rentPayments}
            maintenance={maintenanceRows}
            onNotify={showMessage}
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
                  {tab === "properties" && (
                    <p className="text-xs text-zinc-400 mt-1">
                      Assign each property to a business using the Business dropdown. Add
                      businesses on the Business tab first.
                    </p>
                  )}
                  {tab === "investor_capital" && (
                    <p className="text-xs text-zinc-400 mt-1">
                      Select the business and property for this capital investment. Capital ID is
                      assigned automatically. Property and addresses are populated from your
                      selections and cannot be edited here.
                    </p>
                  )}
                  {tab === "investor_payout" && (
                    <p className="text-xs text-zinc-400 mt-1">
                      Select a capital record first. Payout ID is assigned automatically (1, 2, 3…)
                      per capital.
                    </p>
                  )}
                  {tab === "users" && (
                    <p className="text-xs text-zinc-400 mt-1">
                      Create admin or standard users. Standard users cannot access Investor,
                      Investor Payout, or Reports.
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
                {investorFormSections ? (
                  <div className="space-y-5">
                    <div className="rounded-xl border-2 border-emerald-700/50 bg-zinc-900/40 p-4 sm:p-5">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-300 mb-4">
                        Entry Details
                      </h3>
                      <div className={formGridClass}>
                        {investorFormSections.inputColumns.map((col) => renderFormField(col))}
                      </div>
                    </div>
                    <div className="rounded-xl border border-zinc-600/70 bg-zinc-800/50 p-4 sm:p-5">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-4">
                        Auto-Assigned
                      </h3>
                      <div className={formGridClass}>
                        {investorFormSections.autoColumns.map((col) => renderFormField(col))}
                      </div>
                    </div>
                  </div>
                ) : propertyFormSections ? (
                  <div className="space-y-5">
                    <div className="rounded-xl border-2 border-emerald-700/50 bg-zinc-900/40 p-4 sm:p-5">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-300 mb-4">
                        Property Information
                      </h3>
                      <div className={formGridClass}>
                        {propertyFormSections.informationColumns.map((col) => renderFormField(col))}
                      </div>
                    </div>
                    <div className="rounded-xl border border-zinc-600/70 bg-zinc-800/50 p-4 sm:p-5">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-4">
                        Property Cost
                      </h3>
                      <div className={formGridClass}>
                        {propertyFormSections.costColumns.map((col) => renderFormField(col))}
                      </div>
                    </div>
                    <div className="rounded-xl border border-zinc-600/70 bg-zinc-800/50 p-4 sm:p-5">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-4">
                        Financial
                      </h3>
                      <div className={formGridClass}>
                        {propertyFormSections.financialColumns.map((col) => renderFormField(col))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={formGridClass}>
                    {columns.map((col) => renderFormField(col))}
                  </div>
                )}
                {tab === "users" && (
                  <label className="block mt-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-amber-400 mb-1 block">
                      Password{editingId ? "" : " *"}
                    </span>
                    <input
                      type="password"
                      value={form.password ?? ""}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, password: e.target.value }))
                      }
                      className="form-field"
                      placeholder={editingId ? "Leave blank to keep current password" : "Enter password"}
                      required={!editingId}
                      autoComplete="new-password"
                    />
                  </label>
                )}
                <button
                  type="submit"
                  disabled={saving}
                  className="mt-4 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium disabled:opacity-50"
                >
                  {saving ? "Saving..." : editingId ? "Update" : "Save"}
                </button>
              </form>
              {tab === "investor_capital" && investorPayoutFormSummary && (
                <div className="mt-5">
                  <InvestorPayoutSummaryPanel
                    input={investorPayoutFormSummary}
                    title="Capital Payout Calculator"
                  />
                </div>
              )}
            </section>
            )}

            <section>
              <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                <h2 className="font-semibold text-lg">
                  {showArchived ? "Archive — " : ""}
                  {SHEET_TABS.find((s) => s.id === tab)?.label} ({tableRows.length}
                  {((tab === "properties" && propertyBusinessFilter) ||
                    (tab === "investor_capital" && capitalBusinessFilter)) &&
                  rows.length !== tableRows.length
                    ? ` of ${rows.length}`
                    : ""}
                  )
                </h2>
                <div className="flex items-center gap-2 flex-wrap">
                  {tab === "properties" && !showArchived && (
                    <label className="flex items-center gap-2 text-xs text-zinc-300">
                      <span className="whitespace-nowrap">Filter by business</span>
                      <select
                        value={propertyBusinessFilter}
                        onChange={(e) => setPropertyBusinessFilter(e.target.value)}
                        className="form-select py-1.5 min-w-[10rem]"
                      >
                        <option value="">All businesses</option>
                        {propertyBusinessOptions.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {tab === "investor_capital" && !showArchived && (
                    <label className="flex items-center gap-2 text-xs text-zinc-300">
                      <span className="whitespace-nowrap">Filter by business</span>
                      <select
                        value={capitalBusinessFilter}
                        onChange={(e) => setCapitalBusinessFilter(e.target.value)}
                        className="form-select py-1.5 min-w-[10rem]"
                      >
                        <option value="">All businesses</option>
                        {businessFilterOptions.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
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
                      {tab === "users"
                        ? "Add User"
                        : tab === "tenants"
                          ? "Add Tenants"
                          : tab === "businesses"
                            ? "Add Business"
                            : tab === "investors"
                              ? "Add Investor"
                              : tab === "properties"
                                ? "Add Property"
                                : tab === "investor_capital"
                                  ? "Add Capital Investment"
                                  : tab === "investor_payout"
                                    ? "Add Payout"
                                    : "Add Row"}
                    </button>
                  )}
                  {tab !== "users" && (
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
                  )}
                </div>
              </div>
              {tab === "properties" && expandedProperty && (
                <PropertyDetailPanel
                  property={expandedProperty}
                  onCollapse={() => setExpandedProperty(null)}
                  onEdit={() => openEditForm(expandedProperty as unknown as Record<string, unknown>)}
                  onEntryCode={() => openEntryCodeModal(expandedProperty as unknown as Record<string, unknown>)}
                />
              )}
              <SpreadsheetTable
                columns={columns}
                rows={tableRows}
                archiveMode={showArchived}
                onArchive={handleArchive}
                onRestore={handleRestore}
                actionId={actionId}
                showProfitability={tab === "properties" && !showArchived}
                onProfitability={(row) => setProfitabilityProperty(row as unknown as Property)}
                showExpand={tab === "properties" && !showArchived}
                onExpand={(row) => setExpandedProperty(row as unknown as Property)}
                showPrintForm={tab === "investor_capital" && !showArchived}
                onPrintForm={handlePrintForm}
                printFormId={printFormId}
                showEdit={!showArchived}
                onEdit={openEditForm}
                editingId={editingId}
                showEntryCode={tab === "properties" && !showArchived}
                onEntryCode={openEntryCodeModal}
                entryCodeActionId={entryCodeSaving ? entryCodeModal?.property.id ?? null : null}
              />
              {tab === "investor_capital" && !showArchived && investorPayoutTableSummaries.length > 0 && (
                <div className="mt-5 space-y-3">
                  <h3 className="text-sm font-semibold text-emerald-300">
                    Payout Calculator Summary
                  </h3>
                  {investorPayoutTableSummaries.map(({ payout, summary }) => (
                    <InvestorPayoutSummaryPanel
                      key={payout.id}
                      input={{
                        property_address: summary?.property_address,
                        loan_date: summary?.loan_date,
                        sell_estimate_date: summary?.sell_estimate_date,
                        investor_name: summary?.investor_name,
                        attorney: summary?.attorney,
                        amount_loaned: summary?.amount_loaned,
                        annual_interest_rate: summary?.annual_interest_rate,
                        kicker: summary?.kicker,
                        days_in_year: summary?.days_in_year,
                      }}
                      title={`${payout.payout_id} · ${payout.investor_name}`}
                    />
                  ))}
                </div>
              )}
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