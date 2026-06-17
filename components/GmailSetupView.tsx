"use client";

import { useCallback, useEffect, useState } from "react";
import type { GmailSetupStatus, SmsConfigSource } from "@/lib/types";

interface GmailSetupViewProps {
  onNotify: (type: "success" | "error", text: string) => void;
}

const PASSWORD_PLACEHOLDER = "Leave blank to keep the current password";

function sourceLabel(source: SmsConfigSource): string {
  switch (source) {
    case "database":
      return "Saved in Gmail Setup";
    case "environment":
      return "Environment variables";
    default:
      return "Not configured";
  }
}

export default function GmailSetupView({ onNotify }: GmailSetupViewProps) {
  const [status, setStatus] = useState<GmailSetupStatus | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSetup = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/gmail/setup", { cache: "no-store" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to load Gmail setup.");
      const data = json.data as GmailSetupStatus;
      setStatus(data);
      setUsername(data.username);
      setPassword("");
    } catch (error) {
      onNotify("error", (error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => {
    loadSetup();
  }, [loadSetup]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/gmail/setup", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to save Gmail setup.");
      const data = json.data as GmailSetupStatus;
      setStatus(data);
      setPassword("");
      onNotify("success", "Gmail setup saved and verified.");
    } catch (error) {
      onNotify("error", (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-zinc-400 py-12 text-center">Loading Gmail setup...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tighter mb-2">Gmail Setup</h1>
        <p className="text-sm text-zinc-400">
          Enter your Gmail address and password. SMTP and IMAP settings are configured automatically
          for Gmail.
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
            <h2 className="font-semibold text-lg text-zinc-100 mb-1">Gmail Account</h2>
            <p className="text-sm text-zinc-400 mb-4">
              Use your full Gmail address. If you have 2-Step Verification enabled, use a Google App
              Password instead of your regular password.
            </p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-amber-400 mb-1 block">
                  Gmail Address
                </span>
                <input
                  type="email"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="form-field"
                  placeholder="you@gmail.com"
                  required
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-amber-400 mb-1 block">
                  Password / App Password
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="form-field"
                  placeholder={
                    status?.hasPassword ? PASSWORD_PLACEHOLDER : "Enter your Gmail password"
                  }
                  required={!status?.hasPassword}
                  autoComplete="new-password"
                />
              </label>
            </div>
          </div>

          {status?.configured && (
            <div className="rounded-xl border border-sky-700/40 bg-sky-950/20 p-4 sm:p-5">
              <h2 className="font-semibold text-lg text-sky-200 mb-1">Auto-Configured Settings</h2>
              <p className="text-sm text-zinc-400 mb-4">
                These values are derived from your Gmail address and used for sending and receiving
                email in the Communication tab.
              </p>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-zinc-500">SMTP</dt>
                  <dd className="text-zinc-200">
                    {status.smtpHost}:{status.smtpPort}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-zinc-500">IMAP</dt>
                  <dd className="text-zinc-200">
                    {status.imapHost}:{status.imapPort}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs uppercase tracking-wide text-zinc-500">From Address</dt>
                  <dd className="text-zinc-200">{status.fromAddress}</dd>
                </div>
              </dl>
            </div>
          )}

          <div className="rounded-xl border border-zinc-600/70 bg-zinc-900/40 p-4 text-sm text-zinc-400">
            <p className="font-medium text-zinc-300 mb-2">Environment fallback</p>
            <p>
              If Gmail Setup is blank, the app will still use{" "}
              <code className="text-amber-100">GMAIL_USERNAME</code> and{" "}
              <code className="text-amber-100">GMAIL_PASSWORD</code> from the server environment.
            </p>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Verifying..." : "Save Gmail Setup"}
          </button>
        </form>
      </section>
    </div>
  );
}