"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatCurrency } from "@/lib/format";
import { tenantDisplayName } from "@/lib/rent-ledger";
import {
  buildMaintenanceMessage,
  buildRentReminderMessage,
  findInvestorByPhone,
  formatPhoneDisplay,
  groupMessagesByPhone,
  investorSmsName,
  normalizePhoneNumber,
} from "@/lib/sms-utils";
import type {
  Investor,
  MaintenanceRecord,
  RentPayment,
  SmsContactType,
  SmsMessage,
  Tenant,
} from "@/lib/types";

interface CommunicationViewProps {
  contactType: SmsContactType;
  tenants: Tenant[];
  investors: Investor[];
  rentPayments: RentPayment[];
  maintenance: MaintenanceRecord[];
  onNotify: (type: "success" | "error", text: string) => void;
}

interface SmsConfig {
  configured: boolean;
  fromNumber: string | null;
  source?: "database" | "environment" | "none";
}

interface ThreadView {
  phone: string;
  thread: SmsMessage[];
  last: SmsMessage | null;
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

function tenantForPhone(tenants: Tenant[], phone: string): Tenant | null {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) return null;
  const targetDigits = normalized.replace(/\D/g, "");
  return (
    tenants.find((tenant) => {
      if (!tenant.phone) return false;
      const tenantDigits = normalizePhoneNumber(tenant.phone)?.replace(/\D/g, "");
      return tenantDigits === targetDigits;
    }) ?? null
  );
}

function investorForPhone(investors: Investor[], phone: string): Investor | null {
  return findInvestorByPhone(investors, phone);
}

export default function CommunicationView({
  contactType,
  tenants,
  investors,
  rentPayments,
  maintenance,
  onNotify,
}: CommunicationViewProps) {
  const isTenantPortal = contactType === "tenant";
  const [messages, setMessages] = useState<SmsMessage[]>([]);
  const [config, setConfig] = useState<SmsConfig>({ configured: false, fromNumber: null });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [composeText, setComposeText] = useState("");
  const [sending, setSending] = useState(false);
  const [newContactId, setNewContactId] = useState("");
  const [actionId, setActionId] = useState<number | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [threadActionPhone, setThreadActionPhone] = useState<string | null>(null);

  const loadMessages = useCallback(
    async (silent = false, archived = showArchived) => {
      if (!silent) setRefreshing(true);
      try {
        const params = new URLSearchParams({ contact_type: contactType });
        if (archived) params.set("archived", "1");
        const res = await fetch(`/api/sms?${params.toString()}`, { cache: "no-store" });
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
    setSelectedPhone(null);
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
    setSelectedPhone(null);
    setComposeText("");
    await loadMessages(false, next);
  };

  const handleThreadArchiveToggle = async (archived: boolean) => {
    if (!selectedThread?.phone) return;
    setThreadActionPhone(selectedThread.phone);
    try {
      const res = await fetch("/api/sms/threads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: selectedThread.phone,
          contact_type: contactType,
          archived,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to update conversation.");
      setSelectedPhone(null);
      await loadMessages(true, showArchived);
      onNotify("success", archived ? "Conversation archived." : "Conversation restored.");
    } catch (error) {
      onNotify("error", (error as Error).message);
    } finally {
      setThreadActionPhone(null);
    }
  };

  const threads = useMemo(() => {
    const grouped = groupMessagesByPhone(messages);
    return [...grouped.entries()]
      .map(([phone, thread]) => {
        const last = thread[thread.length - 1];
        const tenant = isTenantPortal ? tenantForPhone(tenants, phone) : null;
        const investor = !isTenantPortal ? investorForPhone(investors, phone) : null;
        const displayName = isTenantPortal
          ? (last.tenant_name ??
            (tenant ? tenantDisplayName(tenant) : formatPhoneDisplay(phone)))
          : (last.investor_name ??
            (investor ? investorSmsName(investor) : formatPhoneDisplay(phone)));
        return {
          phone,
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
    const existing = threads.find((thread) => thread.phone === selectedPhone);
    if (existing) return existing;
    if (!selectedPhone) return null;

    const tenant = isTenantPortal ? tenantForPhone(tenants, selectedPhone) : null;
    const investor = !isTenantPortal ? investorForPhone(investors, selectedPhone) : null;
    return {
      phone: selectedPhone,
      thread: [],
      last: null,
      tenant,
      investor,
      displayName: isTenantPortal
        ? tenant
          ? tenantDisplayName(tenant)
          : formatPhoneDisplay(selectedPhone)
        : investor
          ? investorSmsName(investor)
          : formatPhoneDisplay(selectedPhone),
      propertyName: tenant?.property_name ?? investor?.property_name ?? null,
      unread: false,
    };
  }, [threads, selectedPhone, tenants, investors, isTenantPortal]);

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

  const activeContactsWithPhone = useMemo(() => {
    if (isTenantPortal) {
      return tenants.filter((tenant) => tenant.status === "Active" && tenant.phone?.trim());
    }
    return investors.filter((investor) => investor.status === "Active" && investor.phone?.trim());
  }, [isTenantPortal, tenants, investors]);

  const sendToPhone = async (
    phone: string,
    body: string,
    extras?: {
      tenantId?: number;
      tenantName?: string;
      investorId?: number;
      investorName?: string;
      propertyName?: string;
      messageType?: "general" | "rent_reminder" | "maintenance";
      relatedId?: number;
      relatedType?: "rent_payment" | "maintenance";
    }
  ) => {
    setSending(true);
    try {
      const res = await fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          message: body,
          contact_type: contactType,
          tenantId: extras?.tenantId,
          tenantName: extras?.tenantName,
          investorId: extras?.investorId,
          investorName: extras?.investorName,
          propertyName: extras?.propertyName,
          messageType: extras?.messageType,
          relatedId: extras?.relatedId,
          relatedType: extras?.relatedType,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to send message");
      await loadMessages(true, showArchived);
      setSelectedPhone(phone);
      onNotify("success", "Text message sent.");
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
      const ok = await sendToPhone(selectedThread.phone, body, {
        tenantId: tenant?.id,
        tenantName: tenant ? tenantDisplayName(tenant) : selectedThread.displayName,
        propertyName: tenant?.property_name ?? selectedThread.propertyName ?? undefined,
      });
      if (ok) setComposeText("");
      return;
    }

    const investor = selectedThread.investor;
    const ok = await sendToPhone(selectedThread.phone, body, {
      investorId: investor?.id,
      investorName: investor ? investorSmsName(investor) : selectedThread.displayName,
      propertyName: investor?.property_name ?? selectedThread.propertyName ?? undefined,
    });
    if (ok) setComposeText("");
  };

  const handleStartConversation = () => {
    if (isTenantPortal) {
      const tenant = activeContactsWithPhone.find(
        (contact) => String(contact.id) === newContactId
      ) as Tenant | undefined;
      if (!tenant?.phone) {
        onNotify("error", "Select a tenant with a phone number.");
        return;
      }
      const phone = normalizePhoneNumber(tenant.phone);
      if (!phone) {
        onNotify("error", "Tenant phone number is invalid.");
        return;
      }
      setSelectedPhone(phone);
      setNewContactId("");
      return;
    }

    const investor = activeContactsWithPhone.find(
      (contact) => String(contact.id) === newContactId
    ) as Investor | undefined;
    if (!investor?.phone) {
      onNotify("error", "Select an investor with a phone number.");
      return;
    }
    const phone = normalizePhoneNumber(investor.phone);
    if (!phone) {
      onNotify("error", "Investor phone number is invalid.");
      return;
    }
    setSelectedPhone(phone);
    setNewContactId("");
  };

  const handleRentReminder = async (paymentId?: number) => {
    setActionId(paymentId ?? -1);
    try {
      const res = await fetch("/api/sms/remind-rent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paymentId != null ? { rentPaymentId: paymentId } : {}),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to send reminders");
      await loadMessages(true, showArchived);
      const { sent, failed } = json.data;
      onNotify(
        failed > 0 ? "error" : "success",
        `Rent reminders sent: ${sent}${failed > 0 ? `, failed: ${failed}` : ""}.`
      );
    } catch (error) {
      onNotify("error", (error as Error).message);
    } finally {
      setActionId(null);
    }
  };

  const handleMaintenanceNotify = async (maintenanceId: number) => {
    setActionId(maintenanceId);
    try {
      const res = await fetch("/api/sms/notify-maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maintenanceId }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to send update");
      await loadMessages(true, showArchived);
      const phone = json.data.message?.phone_number;
      if (phone) setSelectedPhone(phone);
      onNotify("success", "Maintenance update sent.");
    } catch (error) {
      onNotify("error", (error as Error).message);
    } finally {
      setActionId(null);
    }
  };

  const handlePreviewRentReminder = (payment: RentPayment) => {
    const tenant = tenants.find((t) => tenantDisplayName(t) === payment.tenant_name);
    if (!tenant) return;
    setComposeText(buildRentReminderMessage(tenant, payment));
    if (tenant.phone) {
      const phone = normalizePhoneNumber(tenant.phone);
      if (phone) setSelectedPhone(phone);
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
    setComposeText(buildMaintenanceMessage(tenant, item));
    if (tenant.phone) {
      const phone = normalizePhoneNumber(tenant.phone);
      if (phone) setSelectedPhone(phone);
    }
  };

  if (loading) {
    return (
      <div className="text-zinc-400 py-12 text-center">
        Loading {isTenantPortal ? "tenant" : "investor"} communication...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">
            {isTenantPortal ? "Tenant Communication" : "Investor Communication"}
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            {isTenantPortal
              ? "Send and receive text messages with tenants for rent reminders and maintenance updates."
              : "Send and receive text messages with investors. Messages here stay separate from tenant conversations."}
          </p>
        </div>
        <div className="flex items-center gap-2">
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
            {refreshing ? "Refreshing..." : "Refresh messages"}
          </button>
        </div>
      </div>

      {!config.configured && (
        <div className="rounded-xl border border-amber-700/60 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
          SMS is not configured. Open <span className="text-amber-100">SMS Setup</span> from the
          gear menu and add your Twilio Account SID, Auth Token, and phone number. Outbound texts
          will be logged but not delivered until configured. Inbound replies require the Twilio
          webhook URL shown in SMS Setup.
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
                  ? `Archived ${isTenantPortal ? "Tenant" : "Investor"} Conversations`
                  : `${isTenantPortal ? "Tenant" : "Investor"} Conversations`}
              </h2>
              {!showArchived && unreadCount > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-600/30 text-emerald-300 border border-emerald-600/40">
                  {unreadCount} new
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              {config.fromNumber
                ? `Sending from ${formatPhoneDisplay(config.fromNumber)}`
                : `Two-way ${isTenantPortal ? "tenant" : "investor"} texting`}
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
                  ? (activeContactsWithPhone as Tenant[]).map((tenant) => (
                      <option key={tenant.id} value={tenant.id}>
                        {tenantDisplayName(tenant)}
                        {tenant.property_name ? ` · ${tenant.property_name}` : ""}
                      </option>
                    ))
                  : (activeContactsWithPhone as Investor[]).map((investor) => (
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
                  ? "No archived conversations."
                  : isTenantPortal
                    ? "No tenant conversations yet. Select a tenant above or send a rent reminder to get started."
                    : "No investor conversations yet. Select an investor above to get started."}
              </p>
            ) : (
              threads.map((thread) => (
                <button
                  key={thread.phone}
                  type="button"
                  onClick={() => setSelectedPhone(thread.phone)}
                  className={`w-full text-left px-4 py-3 border-b border-zinc-700/50 transition ${
                    selectedPhone === thread.phone
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
                      <div className="text-xs text-zinc-400 truncate mt-1">{thread.last.body}</div>
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
                      {formatPhoneDisplay(selectedThread.phone)}
                      {selectedThread.propertyName ? ` · ${selectedThread.propertyName}` : ""}
                    </p>
                  </div>
                  {selectedThread.thread.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleThreadArchiveToggle(!showArchived)}
                      disabled={threadActionPhone === selectedThread.phone}
                      className={`text-xs px-2.5 py-1.5 rounded-lg border whitespace-nowrap disabled:opacity-50 ${
                        showArchived
                          ? "border-emerald-600/60 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/50"
                          : "border-amber-600/60 bg-amber-950/40 text-amber-300 hover:bg-amber-900/50"
                      }`}
                    >
                      {threadActionPhone === selectedThread.phone
                        ? "..."
                        : showArchived
                          ? "Restore"
                          : "Archive"}
                    </button>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {selectedThread.thread.length === 0 ? (
                  <p className="text-xs text-zinc-500 text-center py-8">
                    No messages in this conversation yet. Type below to send the first text.
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
                <div className="p-3 border-t border-zinc-600/60 flex gap-2">
                  <textarea
                    value={composeText}
                    onChange={(e) => setComposeText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void handleComposeSend();
                      }
                    }}
                    rows={2}
                    placeholder="Type a text message..."
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
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm px-6 text-center">
              Select a conversation or start a new one to send and receive text messages.
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
                      {actionId === -1 ? "Sending..." : "Remind all"}
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