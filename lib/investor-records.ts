import type { Business, InvestorPayout, InvestorRecordKind } from "./types";

export function isCapitalRecord(record: Pick<InvestorPayout, "record_kind">): boolean {
  return record.record_kind !== "payout";
}

export function isPayoutRecord(record: Pick<InvestorPayout, "record_kind">): boolean {
  return record.record_kind === "payout";
}

export function displayPayoutId(record: Pick<InvestorPayout, "record_kind" | "payout_id" | "payout_seq">): string {
  if (isPayoutRecord(record) && record.payout_seq != null) {
    return String(record.payout_seq);
  }
  return record.payout_id;
}

export function nextPayoutSequence(
  capitalId: string,
  payouts: Array<Pick<InvestorPayout, "capital_id" | "payout_seq" | "record_kind">>
): number {
  const sequences = payouts
    .filter(
      (p) =>
        isPayoutRecord(p) &&
        p.capital_id === capitalId &&
        p.payout_seq != null &&
        Number.isFinite(p.payout_seq)
    )
    .map((p) => p.payout_seq as number);
  return sequences.length > 0 ? Math.max(...sequences) + 1 : 1;
}

export function capitalOptionLabel(record: Pick<InvestorPayout, "payout_id" | "property_name" | "investor_name">): string {
  return `${record.payout_id} · ${record.property_name} · ${record.investor_name}`;
}

export function parseRecordKind(value: unknown): InvestorRecordKind {
  return value === "payout" ? "payout" : "capital";
}

export function formatBusinessAddress(
  business: Pick<Business, "address" | "city" | "state" | "zip">
): string {
  return [business.address, business.city, business.state, business.zip]
    .filter((part) => part != null && String(part).trim() !== "")
    .join(", ");
}

export function nextCapitalId(
  capitals: Array<Pick<InvestorPayout, "record_kind" | "payout_id">>
): number {
  const ids = capitals
    .filter((record) => isCapitalRecord(record))
    .map((record) => Number(record.payout_id))
    .filter((value) => Number.isFinite(value) && value > 0);
  return ids.length > 0 ? Math.max(...ids) + 1 : 1;
}