"use client";

import { useCallback, useEffect, useState } from "react";
import { formatPhoneDisplay } from "@/lib/sms-utils";
import type { SmsConfigSource, SmsSetupStatus } from "@/lib/types";

interface SmsSetupViewProps {
  onNotify: (type: "success" | "error", text: string) => void;
}

const AUTH_TOKEN_PLACEHOLDER = "Leave blank to keep the current token";

function sourceLabel(source: SmsConfigSource): string {
  switch (source) {
    case "database":
      return "Saved in SMS Setup";
    case "environment":
      return "Environment variables";
    default:
      return "Not configured";
  }
}

export default function SmsSetupView({ onNotify }: SmsSetupViewProps) {
  const [status, setStatus] = useState<SmsSetupStatus | null>(null);
  const [accountSid, setAccountSid] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSetup = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sms/setup", { cache: "no-store" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to load SMS setup.");
      const data = json.data as SmsSetupStatus;
      setStatus(data);
      setAccountSid(data.accountSid);
      setPhoneNumber(data.phoneNumber);
      setAuthToken("");
    } catch (error) {
      onNotify("error", (error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => {
    loadSetup();
  }, [loadSetup]);

  const handleCopyWebhook = async () => {
    if (!status?.webhookUrl) return;
    try {
      await navigator.clipboard.writeText(status.webhookUrl);
      onNotify("success", "Webhook URL copied.");
    } catch {
      onNotify("error", "Could not copy the webhook URL.");
    }
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/sms/setup", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_sid: accountSid,
          auth_token: authToken,
          phone_number: phoneNumber,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to save SMS setup.");
      const data = json.data as SmsSetupStatus;
      setStatus(data);
      setAuthToken("");
      onNotify("success", "SMS setup saved.");
    } catch (error) {
      onNotify("error", (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-zinc-400 py-12 text-center">Loading SMS setup...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tighter mb-2">SMS Setup</h1>
        <p className="text-sm text-zinc-400">
          Configure Twilio credentials and the inbound webhook used by the Communication tab.
        </p>
      </div>

      <section className="rounded-xl border border-zinc-600/60 bg-zinc-800/90 p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <span
            className={`text-xs px-3 py-1 rounded-full border ${
              status?.configured
                ? "border-emerald-600/50 bg-emerald-950/40 text-emerald-300"
                : "border-amber-600/50 bg-amber-950/40 text-amber-300"
            }`}
          >
            {status?.configured ? "Configured" : "Not Configured"}
          </span>
          <span className="text-xs text-zinc-400">
            Active source: {sourceLabel(status?.configSource ?? "none")}
          </span>
          {status?.updatedAt && (
            <span className="text-xs text-zinc-500">
              Last saved {new Date(status.updatedAt).toLocaleString()}
            </span>
          )}
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          <div>
            <h2 className="font-semibold text-lg text-zinc-100 mb-1">Twilio Credentials</h2>
            <p className="text-sm text-zinc-400 mb-4">
              These values power outbound rent reminders, maintenance texts, and manual messages.
            </p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-amber-400 mb-1 block">
                  Account SID
                </span>
                <input
                  type="text"
                  value={accountSid}
                  onChange={(e) => setAccountSid(e.target.value)}
                  className="form-field"
                  placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  required
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-amber-400 mb-1 block">
                  Twilio Phone Number
                </span>
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="form-field"
                  placeholder="+15551234567"
                  required
                />
              </label>
              <label className="block lg:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-amber-400 mb-1 block">
                  Auth Token
                </span>
                <input
                  type="password"
                  value={authToken}
                  onChange={(e) => setAuthToken(e.target.value)}
                  className="form-field"
                  placeholder={
                    status?.hasAuthToken ? AUTH_TOKEN_PLACEHOLDER : "Enter your Twilio auth token"
                  }
                  required={!status?.hasAuthToken}
                  autoComplete="new-password"
                />
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-sky-700/40 bg-sky-950/20 p-4 sm:p-5">
            <h2 className="font-semibold text-lg text-sky-200 mb-1">Inbound Webhook</h2>
            <p className="text-sm text-zinc-400 mb-4">
              Point your Twilio phone number&apos;s incoming message webhook here so tenant replies
              appear in Communication.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                readOnly
                value={status?.webhookUrl ?? ""}
                className="form-field flex-1"
              />
              <button
                type="button"
                onClick={handleCopyWebhook}
                className="text-sm px-4 py-2 rounded-lg border border-sky-600/60 bg-sky-950/40 text-sky-300 hover:bg-sky-900/50 whitespace-nowrap"
              >
                Copy URL
              </button>
            </div>
            <ol className="mt-4 space-y-2 text-sm text-zinc-300 list-decimal list-inside">
              <li>Open the Twilio Console and select your sending phone number.</li>
              <li>Under Messaging, set &quot;A message comes in&quot; to Webhook.</li>
              <li>Paste the URL above, choose HTTP POST, and save.</li>
              <li>
                Send a test text to{" "}
                {status?.phoneNumber
                  ? formatPhoneDisplay(status.phoneNumber)
                  : "your Twilio number"}{" "}
                and confirm it appears on the Communication tab.
              </li>
            </ol>
          </div>

          <div className="rounded-xl border border-zinc-600/70 bg-zinc-900/40 p-4 text-sm text-zinc-400">
            <p className="font-medium text-zinc-300 mb-2">Environment fallback</p>
            <p>
              If SMS Setup is blank, the app will still use{" "}
              <code className="text-amber-100">TWILIO_ACCOUNT_SID</code>,{" "}
              <code className="text-amber-100">TWILIO_AUTH_TOKEN</code>, and{" "}
              <code className="text-amber-100">TWILIO_PHONE_NUMBER</code> from the server
              environment.
            </p>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save SMS Setup"}
          </button>
        </form>
      </section>
    </div>
  );
}