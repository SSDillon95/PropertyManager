"use client";

import { useState } from "react";
import EmailCommunicationPanel from "@/components/EmailCommunicationPanel";
import SmsCommunicationPanel from "@/components/SmsCommunicationPanel";
import type {
  Investor,
  MaintenanceRecord,
  RentPayment,
  SmsContactType,
  Tenant,
} from "@/lib/types";

type CommunicationChannel = "sms" | "email";

interface CommunicationViewProps {
  contactType: SmsContactType;
  tenants: Tenant[];
  investors: Investor[];
  rentPayments: RentPayment[];
  maintenance: MaintenanceRecord[];
  onNotify: (type: "success" | "error", text: string) => void;
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
  const [channel, setChannel] = useState<CommunicationChannel>("sms");

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">
            {isTenantPortal ? "Tenant Communication" : "Investor Communication"}
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            {isTenantPortal
              ? "Send and receive text messages or emails with tenants for rent reminders and maintenance updates."
              : "Send and receive text messages or emails with investors. Messages here stay separate from tenant conversations."}
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-zinc-600/80 bg-zinc-800/90 p-1">
          <button
            type="button"
            onClick={() => setChannel("sms")}
            className={`text-xs px-3 py-1.5 rounded-md transition ${
              channel === "sms"
                ? "bg-emerald-600 text-white"
                : "text-zinc-300 hover:text-zinc-100 hover:bg-zinc-700/60"
            }`}
          >
            SMS
          </button>
          <button
            type="button"
            onClick={() => setChannel("email")}
            className={`text-xs px-3 py-1.5 rounded-md transition ${
              channel === "email"
                ? "bg-emerald-600 text-white"
                : "text-zinc-300 hover:text-zinc-100 hover:bg-zinc-700/60"
            }`}
          >
            Email
          </button>
        </div>
      </div>

      {channel === "sms" ? (
        <SmsCommunicationPanel
          contactType={contactType}
          tenants={tenants}
          investors={investors}
          rentPayments={rentPayments}
          maintenance={maintenance}
          onNotify={onNotify}
        />
      ) : (
        <EmailCommunicationPanel
          contactType={contactType}
          tenants={tenants}
          investors={investors}
          rentPayments={rentPayments}
          maintenance={maintenance}
          onNotify={onNotify}
        />
      )}
    </div>
  );
}