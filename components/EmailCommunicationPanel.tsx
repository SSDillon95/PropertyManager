"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  findInvestorByEmail,
  findTenantByEmail,
  groupMessagesByEmail,
  normalizeEmailAddress,
} from "@/lib/email-utils";
import { formatCurrency } from "@/lib/format";
import { tenantDisplayName } from "@/lib/rent-ledger";
import {
  buildMaintenanceMessage,
  buildRentReminderMessage,
  investorSmsName,
} from "@/lib/sms-utils";
import type {
  EmailMessage,
  Investor,
  MaintenanceRecord,
  RentPayment,
  SmsContactType,
  Tenant,
} from "@/lib/types";

interface EmailCommunicationPanelProps {
  contactType: SmsContactType;
  tenants: Tenant[];
  investors: Investor[];
  rentPayments: RentPayment[];
  maintenance: MaintenanceRecord[];
  onNotify: (type: "success" | "error", text: string) => void;
}

interface EmailConfig {
  configured: boolean;
  fromAddress: string | null;
  source?: "database" | "environment" | "none";
}

interface ThreadView {
  email: string;
  thread: EmailMessage[];
  last: EmailMessage | null;
  tenant: Tenant | null;
  investor: Investor | null;
  displayName: string;
  propertyName: string | null;
  unread: boolean;
}

const POLL_INTERVAL_MS = 20_000;

function formatMessageTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function EmailCommunicationPanel({
  contactType,
  tenants,
  investors,
  rentPayments,
  maintenance,
  onNotify,
}: EmailCommunicationPanelProps) {
  const isTenantPortal = contactType === "tenant";
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [config, setConfig] = useState<EmailConfig>({ configured: false, fromAddress: null });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [composeSubject, setComposeSubject] = useState("");
  const [composeText, setComposeText] = useState("");
  const [sending, setSending] = useState(false);
  const [newContactId, setNewContactId] = useState("");
  const [actionId, setActionId] = useState<number | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [threadActionEmail, setThreadActionEmail] = useState<string | null>(null);

  const loadMessages = useCallback(
    async (silent = false, archived = showArchived) => {
      if (!silent) setRefreshing(true);
      try {
        const params = new URLSearchParams({ contact_type: contactType });
        if (archived) params.set("archived", "1");
        const res = await fetch(`/api/email?${params.toString()}`, { cache: "no-store" });
        const json = await res.json();
        if (json.success) {
          setMessages(json.data.messages);
          setConfig(json.data.config);
        }
      } finally {
        if (!silent) setRefreshing(false);
      }
    },
    [contactType, showArchived]
  );

  useEffect(() => {
    setLoading(true);
    setSelectedEmail(null);
    setComposeSubject("");
    setComposeText("");
    setShowArchived(false);
    loadMessages(false, false).finally(() => setLoading(false));
  }, [contactType, loadMessages]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      loadMessages(true, showArchived);
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [loadMessages, showArchived]);

  const toggleArchiveView = async () => {
    const next = !showArchived;
    setShowArchived(next);
    setSelectedEmail(null);
    setComposeSubject("");
    setComposeText("");
    await loadMessages(false, next);
  };

  const handleThreadArchiveToggle = async (archived: boolean) => {
    if (!selectedThread?.email) return;
    setThreadActionEmail(selectedThread.email);
    try {
      const res = await fetch("/api/email/threads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: selectedThread.email,
          contact_type: contactType,
          archived,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to update conversation.");
      setSelectedEmail(null);
      await loadMessages(true, showArchived);
      onNotify("success", archived ? "Conversation archived." : "Conversation restored.");
    } catch (error) {
      onNotify("error", (error as Error).message);
    } finally {
      setThreadActionEmail(null);
    }
  };

  const threads = useMemo(() => {
    const grouped = groupMessagesByEmail(messages);
    return [...grouped.entries()]
      .map(([email, thread]) => {
        const last = thread[thread.length - 1];
        const tenant = isTenantPortal ? findTenantByEmail(tenants, email) : null;
        const investor = !isTenantPortal ? findInvestorByEmail(investors, email) : null;
        const displayName = isTenantPortal
          ? (last.tenant_name ??
            (tenant ? tenantDisplayName(tenant) : email))
          : (last.investor_name ?? (investor ? investorSmsName(investor) : email));
        return {
          email,
          thread,
          last,
          tenant,
          investor,
          displayName,
          propertyName:
            last.property_name ?? tenant?.property_name ?? investor?.property_name ?? null,
          unread: last.direction === "inbound",
        } satisfies ThreadView;
      })
      .sort((a, b) => {
        const aTime = a.last?.created_at ?? "";
        const bTime = b.last?.created_at ?? "";
        return bTime.localeCompare(aTime);
      });
  }, [messages, tenants, investors, isTenantPortal]);

  const unreadCount = useMemo(
    () => threads.filter((thread) => thread.unread).length,
    [threads]
  );

  const selectedThread = useMemo((): ThreadView | null => {
    const existing = threads.find((thread) => thread.email === selectedEmail);
    if (existing) return existing;
    if (!selectedEmail) return null;

    const tenant = isTenantPortal ? findTenantByEmail(tenants, selectedEmail) : null;
    const investor = !isTenantPortal ? findInvestorByEmail(investors, selectedEmail) : null;
    return {
      email: selectedEmail,
      thread: [],
      last: null,
      tenant,
      investor,
      displayName: isTenantPortal
        ? tenant
          ? tenantDisplayName(tenant)
          : selectedEmail
        : investor
          ? investorSmsName(investor)
          : selectedEmail,
      propertyName: tenant?.property_name ?? investor?.property_name ?? null,
      unread: false,
    };
  }, [threads, selectedEmail, tenants, investors, isTenantPortal]);

  const outstandingRent = useMemo(
    () =>
      rentPayments.filter((payment) => {
        const status = payment.status.toLowerCase();
        return status !== "paid" && status !== "received";
      }),
    [rentPayments]
  );

  const openMaintenance = useMemo(
    () => maintenance.filter((item) => item.status.toLowerCase() !== "completed"),
    [maintenance]
  );

  const activeContactsWithEmail = useMemo(() => {
    if (isTenantPortal) {
      return tenants.filter((tenant) => tenant.status === "Active" && tenant.email?.trim());
    }
    return investors.filter((investor) => investor.status === "Active" && investor.email?.trim());
  }, [isTenantPortal, tenants, investors]);

  const sendToEmail = async (
    email: string,
    subject: string,
    body: string,
    extras?: {
      tenantId?: number;
      tenantName?: string;
      investorId?: number;
      investorName?: string;
      propertyName?: string;
      messageType?: string;
    }
  ) => {
    setSending(true);
    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          subject,
          message: body,
          contact_type: contactType,
          tenantId: extras?.tenantId,
          tenantName: extras?.tenantName,
          investorId: extras?.investorId,
          investorName: extras?.investorName,
          propertyName: extras?.propertyName,
          messageType: extras?.messageType,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to send email");
      await loadMessages(true, showArchived);
      setSelectedEmail(email);
      onNotify("success", "Email sent.");
      return true;
    } catch (error) {
      onNotify("error", (error as Error).message);
      return false;
    } finally {
      setSending(false);
    }
  };

  const handleComposeSend = async () => {
    const body = composeText.trim();
    if (!body || !selectedThread) return;

    if (isTenantPortal) {
      const tenant = selectedThread.tenant;
      const ok = await sendToEmail(
        selectedThread.email,
        composeSubject.trim() || "Message from HOP2IT Property Management",
        body,
        {
          tenantId: tenant?.id,
          tenantName: tenant ? tenantDisplayName(tenant) : selectedThread.displayName,
          propertyName: tenant?.property_name ?? selectedThread.propertyName ?? undefined,
        }
      );
      if (ok) {
        setComposeSubject("");
        setComposeText("");
      }
      return;
    }

    const investor = selectedThread.investor;
    const ok = await sendToEmail(
      selectedThread.email,
      composeSubject.trim() || "Message from HOP2IT Property Management",
      body,
      {
        investorId: investor?.id,
        investorName: investor ? investorSmsName(investor) : selectedThread.displayName,
        propertyName: investor?.property_name ?? selectedThread.propertyName ?? undefined,
      }
    );
    if (ok) {
      setComposeSubject("");
      setComposeText("");
    }
  };

  const handleStartConversation = () => {
    if (isTenantPortal) {
      const tenant = activeContactsWithEmail.find(
        (contact) => String(contact.id) === newContactId
      ) as Tenant | undefined;
      if (!tenant?.email) {
        onNotify("error", "Select a tenant with an email address.");
        return;
      }
      const email = normalizeEmailAddress(tenant.email);
      if (!email) {
        onNotify("error", "Tenant email address is invalid.");
        return;
      }
      setSelectedEmail(email);
      setNewContactId("");
      return;
    }

    const investor = activeContactsWithEmail.find(
      (contact) => String(contact.id) === newContactId
    ) as Investor | undefined;
    if (!investor?.email) {
      onNotify("error", "Select an investor with an email address.");
      return;
    }
    const email = normalizeEmailAddress(investor.email);
    if (!email) {
      onNotify("error", "Investor email address is invalid.");
      return;
    }
    setSelectedEmail(email);
    setNewContactId("");
  };

  const handleRentReminder = async (paymentId?: number) => {
    const payments =
      paymentId != null
        ? outstandingRent.filter((payment) => payment.id === paymentId)
        : outstandingRent;
    if (payments.length === 0) return;

    setActionId(paymentId ?? -1);
    setSending(true);
    let sent = 0;
    let failed = 0;
    try {
      for (const payment of payments) {
        const tenant = tenants.find((t) => tenantDisplayName(t) === payment.tenant_name);
        const email = tenant?.email ? normalizeEmailAddress(tenant.email) : null;
        if (!tenant || !email) {
          failed += 1;
          continue;
        }
        try {
          const res = await fetch("/api/email/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email,
              subject: `Rent reminder: ${payment.property_name}`,
              message: buildRentReminderMessage(tenant, payment),
              contact_type: contactType,
              tenantId: tenant.id,
              tenantName: tenantDisplayName(tenant),
              propertyName: tenant.property_name ?? payment.property_name,
              messageType: "rent_reminder",
            }),
          });
          const json = await res.json();
          if (!json.success) throw new Error(json.error || "Failed to send email");
          sent += 1;
        } catch {
          failed += 1;
        }
      }
      await loadMessages(true, showArchived);
      onNotify(
        failed > 0 ? "error" : "success",
        `Rent reminder emails sent: ${sent}${failed > 0 ? `, failed: ${failed}` : ""}.`
      );
    } finally {
      setActionId(null);
      setSending(false);
    }
  };

  const handleMaintenanceNotify = async (maintenanceId: number) => {
    setActionId(maintenanceId);
    try {
      const item = maintenance.find((record) => record.id === maintenanceId);
      if (!item) throw new Error("Maintenance record not found.");
      const tenant = tenants.find(
        (t) =>
          t.status === "Active" &&
          t.property_name === item.property_name &&
          (item.unit ? t.unit === item.unit : true)
      );
      const email = tenant?.email ? normalizeEmailAddress(tenant.email) : null;
      if (!tenant || !email) throw new Error("No active tenant with email for this property.");

      const ok = await sendToEmail(
        email,
        `Maintenance update: ${item.property_name}`,
        buildMaintenanceMessage(tenant, item),
        {
          tenantId: tenant.id,
          tenantName: tenantDisplayName(tenant),
          propertyName: tenant.property_name ?? item.property_name,
          messageType: "maintenance",
        }
      );
      if (!ok) throw new Error("Failed to send maintenance email.");
      setSelectedEmail(email);
      onNotify("success", "Maintenance update emailed.");
    } catch (error) {
      onNotify("error", (error as Error).message);
    } finally {
      setActionId(null);
    }
  };

  const handlePreviewRentReminder = (payment: RentPayment) => {
    const tenant = tenants.find((t) => tenantDisplayName(t) === payment.tenant_name);
    if (!tenant) return;
    setComposeSubject(`Rent reminder: ${payment.property_name}`);
    setComposeText(buildRentReminderMessage(tenant, payment));
    if (tenant.email) {
      const email = normalizeEmailAddress(tenant.email);
      if (email) setSelectedEmail(email);
    }
  };

  const handlePreviewMaintenance = (item: MaintenanceRecord) => {
    const tenant = tenants.find(
      (t) =>
        t.status === "Active" &&
        t.property_name === item.property_name &&
        (item.unit ? t.unit === item.unit : true)
    );
    if (!tenant) return;
    setComposeSubject(`Maintenance update: ${item.property_name}`);
    setComposeText(buildMaintenanceMessage(tenant, item));
    if (tenant.email) {
      const email = normalizeEmailAddress(tenant.email);
      if (email) setSelectedEmail(email);
    }
  };

  if (loading) {
    return (
      <div className="text-zinc-400 py-12 text-center">
        Loading {isTenantPortal ? "tenant" : "investor"} email...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
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
        <button
          type="button"
          onClick={() => loadMessages(false, showArchived)}
          disabled={refreshing}
          className="text-xs px-3 py-1.5 rounded-lg border border-zinc-600 bg-zinc-700/80 text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
        >
          {refreshing ? "Syncing..." : "Sync inbox"}
        </button>
      </div>

      {!config.configured && (
        <div className="rounded-xl border border-amber-700/60 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
          Gmail is not configured. Open <span className="text-amber-100">Gmail Setup</span> from the
          gear menu and add your Gmail address and password. Outbound emails will be logged but not
          delivered until configured. Inbound replies are synced from your Gmail inbox when you
          refresh.
        </div>
      )}

      <div
        className={`grid grid-cols-1 gap-4 min-h-[560px] ${
          isTenantPortal ? "xl:grid-cols-[280px_1fr_300px]" : "xl:grid-cols-[280px_1fr]"
        }`}
      >
        <section className="rounded-xl border border-zinc-600/60 bg-zinc-800/90 flex flex-col min-h-[400px] xl:min-h-0">
          <div className="px-4 py-3 border-b border-zinc-600/60">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold text-sm text-zinc-100">
                {showArchived
                  ? `Archived ${isTenantPortal ? "Tenant" : "Investor"} Email`
                  : `${isTenantPortal ? "Tenant" : "Investor"} Email`}
              </h2>
              {!showArchived && unreadCount > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-600/30 text-emerald-300 border border-emerald-600/40">
                  {unreadCount} new
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              {config.fromAddress
                ? `Sending from ${config.fromAddress}`
                : `Two-way ${isTenantPortal ? "tenant" : "investor"} email`}
            </p>
          </div>
          {!showArchived && (
            <div className="p-3 border-b border-zinc-600/60 space-y-2">
              <select
                value={newContactId}
                onChange={(e) => setNewContactId(e.target.value)}
                className="form-select text-sm w-full"
              >
                <option value="">Start new conversation...</option>
                {isTenantPortal
                  ? (activeContactsWithEmail as Tenant[]).map((tenant) => (
                      <option key={tenant.id} value={tenant.id}>
                        {tenantDisplayName(tenant)}
                        {tenant.property_name ? ` · ${tenant.property_name}` : ""}
                      </option>
                    ))
                  : (activeContactsWithEmail as Investor[]).map((investor) => (
                      <option key={investor.id} value={investor.id}>
                        {investorSmsName(investor)}
                        {investor.property_name ? ` · ${investor.property_name}` : ""}
                      </option>
                    ))}
              </select>
              <button
                type="button"
                onClick={handleStartConversation}
                disabled={!newContactId}
                className="w-full text-xs px-3 py-2 rounded-lg border border-emerald-600/60 bg-emerald-900/30 text-emerald-300 hover:bg-emerald-900/50 disabled:opacity-50"
              >
                Open conversation
              </button>
            </div>
          )}
          <div className="flex-1 overflow-y-auto">
            {threads.length === 0 ? (
              <p className="text-xs text-zinc-500 px-4 py-6 text-center">
                {showArchived
                  ? "No archived email conversations."
                  : isTenantPortal
                    ? "No tenant email conversations yet. Select a tenant above or send a rent reminder to get started."
                    : "No investor email conversations yet. Select an investor above to get started."}
              </p>
            ) : (
              threads.map((thread) => (
                <button
                  key={thread.email}
                  type="button"
                  onClick={() => setSelectedEmail(thread.email)}
                  className={`w-full text-left px-4 py-3 border-b border-zinc-700/50 transition ${
                    selectedEmail === thread.email
                      ? "bg-emerald-950/40"
                      : "hover:bg-zinc-700/40"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {thread.unread && (
                      <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
                    )}
                    <div className="font-medium text-sm text-zinc-100 truncate flex-1">
                      {thread.displayName}
                    </div>
                  </div>
                  {thread.propertyName && (
                    <div className="text-xs text-zinc-500 truncate">{thread.propertyName}</div>
                  )}
                  {thread.last && (
                    <>
                      <div className="text-xs text-zinc-400 truncate mt-1">
                        {thread.last.subject ? `${thread.last.subject} · ` : ""}
                        {thread.last.body}
                      </div>
                      <div className="text-[10px] text-zinc-500 mt-1">
                        {thread.last.direction === "inbound" ? "Received · " : "Sent · "}
                        {formatMessageTime(thread.last.created_at)}
                      </div>
                    </>
                  )}
                </button>
              ))
            )}
          </div>
        </section>

        <section className="rounded-xl border border-zinc-600/60 bg-zinc-800/90 flex flex-col min-h-[400px] xl:min-h-0">
          {selectedThread ? (
            <>
              <div className="px-4 py-3 border-b border-zinc-600/60">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-semibold text-sm text-zinc-100">
                      {selectedThread.displayName}
                    </h2>
                    <p className="text-xs text-zinc-400">
                      {selectedThread.email}
                      {selectedThread.propertyName ? ` · ${selectedThread.propertyName}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => loadMessages(false, showArchived)}
                      disabled={refreshing}
                      className="text-xs px-2.5 py-1.5 rounded-lg border border-zinc-600 bg-zinc-700/80 text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
                    >
                      {refreshing ? "..." : "Sync"}
                    </button>
                    {selectedThread.thread.length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleThreadArchiveToggle(!showArchived)}
                        disabled={threadActionEmail === selectedThread.email}
                        className={`text-xs px-2.5 py-1.5 rounded-lg border whitespace-nowrap disabled:opacity-50 ${
                          showArchived
                            ? "border-emerald-600/60 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/50"
                            : "border-amber-600/60 bg-amber-950/40 text-amber-300 hover:bg-amber-900/50"
                        }`}
                      >
                        {threadActionEmail === selectedThread.email
                          ? "..."
                          : showArchived
                            ? "Restore"
                            : "Archive"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {selectedThread.thread.length === 0 ? (
                  <p className="text-xs text-zinc-500 text-center py-8">
                    No messages in this conversation yet. Compose below to send the first email.
                  </p>
                ) : (
                  selectedThread.thread.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${
                        message.direction === "outbound" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                          message.direction === "outbound"
                            ? "bg-emerald-900/50 border border-emerald-700/50 text-emerald-50"
                            : "bg-zinc-700/80 border border-zinc-600/60 text-zinc-100"
                        }`}
                      >
                        <p className="text-[10px] uppercase tracking-wide opacity-60 mb-1">
                          {message.direction === "inbound" ? "Received" : "Sent"}
                          {message.subject ? ` · ${message.subject}` : ""}
                        </p>
                        <p className="whitespace-pre-wrap break-words">{message.body}</p>
                        <div className="flex items-center gap-2 mt-1 text-[10px] opacity-70">
                          <span>{formatMessageTime(message.created_at)}</span>
                          {message.message_type !== "general" && (
                            <span className="uppercase tracking-wide">
                              {message.message_type.replace("_", " ")}
                            </span>
                          )}
                          {message.status === "failed" && (
                            <span className="text-red-300">Failed</span>
                          )}
                        </div>
                        {message.error_message && (
                          <p className="text-[10px] text-red-300 mt-1">{message.error_message}</p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
              {!showArchived && (
                <div className="p-3 border-t border-zinc-600/60 space-y-2">
                  <input
                    type="text"
                    value={composeSubject}
                    onChange={(e) => setComposeSubject(e.target.value)}
                    placeholder="Subject"
                    className="form-input text-sm w-full"
                  />
                  <div className="flex gap-2">
                    <textarea
                      value={composeText}
                      onChange={(e) => setComposeText(e.target.value)}
                      rows={2}
                      placeholder="Type an email message..."
                      className="form-input flex-1 resize-none text-sm"
                    />
                    <button
                      type="button"
                      onClick={handleComposeSend}
                      disabled={sending || !composeText.trim()}
                      className="self-end px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium disabled:opacity-50"
                    >
                      {sending ? "..." : "Send"}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm px-6 text-center">
              Select a conversation or start a new one to send and receive emails.
            </div>
          )}
        </section>

        {isTenantPortal && (
          <section className="rounded-xl border border-zinc-600/60 bg-zinc-800/90 flex flex-col min-h-[300px] xl:min-h-0">
            <div className="px-4 py-3 border-b border-zinc-600/60">
              <h2 className="font-semibold text-sm text-zinc-100">Quick actions</h2>
              <p className="text-xs text-zinc-400 mt-1">Rent reminders and maintenance updates</p>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-400">
                    Rent reminders
                  </h3>
                  {outstandingRent.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleRentReminder()}
                      disabled={actionId === -1}
                      className="text-[10px] px-2 py-1 rounded border border-emerald-600/60 text-emerald-300 hover:bg-emerald-900/30 disabled:opacity-50"
                    >
                      {actionId === -1 ? "Sending..." : "Email all"}
                    </button>
                  )}
                </div>
                {outstandingRent.length === 0 ? (
                  <p className="text-xs text-zinc-500">No outstanding rent payments.</p>
                ) : (
                  <ul className="space-y-2">
                    {outstandingRent.slice(0, 8).map((payment) => (
                      <li
                        key={payment.id}
                        className="rounded-lg border border-zinc-700/60 bg-zinc-900/40 p-2 text-xs"
                      >
                        <div className="font-medium text-zinc-200">{payment.tenant_name}</div>
                        <div className="text-zinc-400">
                          {payment.property_name} · {formatCurrency(payment.rent_due)} ·{" "}
                          {payment.status}
                        </div>
                        <div className="flex gap-2 mt-2">
                          <button
                            type="button"
                            onClick={() => handlePreviewRentReminder(payment)}
                            className="text-[10px] px-2 py-1 rounded border border-zinc-600 text-zinc-300 hover:bg-zinc-700/60"
                          >
                            Preview
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRentReminder(payment.id)}
                            disabled={actionId === payment.id}
                            className="text-[10px] px-2 py-1 rounded border border-emerald-600/60 text-emerald-300 hover:bg-emerald-900/30 disabled:opacity-50"
                          >
                            {actionId === payment.id ? "Sending..." : "Send"}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-400 mb-2">
                  Maintenance updates
                </h3>
                {openMaintenance.length === 0 ? (
                  <p className="text-xs text-zinc-500">No open maintenance requests.</p>
                ) : (
                  <ul className="space-y-2">
                    {openMaintenance.slice(0, 8).map((item) => (
                      <li
                        key={item.id}
                        className="rounded-lg border border-zinc-700/60 bg-zinc-900/40 p-2 text-xs"
                      >
                        <div className="font-medium text-zinc-200">{item.property_name}</div>
                        <div className="text-zinc-400 truncate">{item.description}</div>
                        <div className="text-zinc-500">{item.status}</div>
                        <div className="flex gap-2 mt-2">
                          <button
                            type="button"
                            onClick={() => handlePreviewMaintenance(item)}
                            className="text-[10px] px-2 py-1 rounded border border-zinc-600 text-zinc-300 hover:bg-zinc-700/60"
                          >
                            Preview
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMaintenanceNotify(item.id)}
                            disabled={actionId === item.id}
                            className="text-[10px] px-2 py-1 rounded border border-emerald-600/60 text-emerald-300 hover:bg-emerald-900/30 disabled:opacity-50"
                          >
                            {actionId === item.id ? "Sending..." : "Notify"}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}