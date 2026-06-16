import {
  archiveInvestorPayout,
  createInvestorPayout,
  getInvestorCapitalByCapitalId,
  getNextCapitalId,
  getNextPayoutSequenceForCapital,
  listInvestorPayouts,
  restoreInvestorPayout,
  updateInvestorPayout,
} from "@/lib/db";
import {
  handleRoute,
  jsonError,
  jsonOk,
  parseArchivedParam,
  parseIdParam,
} from "@/lib/api-helpers";
import { loanSummaryFromPayout } from "@/lib/investor-payout-summary";
import { parseRecordKind } from "@/lib/investor-records";
import { requireAdminOrForbidden } from "@/lib/session";
import type { InvestorPayout } from "@/lib/types";

export const dynamic = "force-dynamic";

function parseKindParam(request: Request): "capital" | "payout" | undefined {
  const kind = new URL(request.url).searchParams.get("kind");
  if (kind === "capital" || kind === "payout") return kind;
  return undefined;
}

async function parseCapitalBody(
  body: Record<string, unknown>,
  existing?: InvestorPayout
): Promise<Omit<InvestorPayout, "id" | "created_at">> {
  const loanFields = {
    property_address: body.property_address != null ? String(body.property_address) : null,
    loan_date: body.loan_date != null ? String(body.loan_date) : null,
    sell_estimate_date:
      body.sell_estimate_date != null ? String(body.sell_estimate_date) : null,
    attorney: body.attorney != null ? String(body.attorney) : null,
    amount_loaned:
      body.amount_loaned != null && body.amount_loaned !== ""
        ? Number(body.amount_loaned)
        : null,
    annual_interest_rate:
      body.annual_interest_rate != null && body.annual_interest_rate !== ""
        ? Number(body.annual_interest_rate)
        : null,
    kicker:
      body.kicker != null && body.kicker !== "" ? Number(body.kicker) : null,
    days_in_year:
      body.days_in_year != null && body.days_in_year !== ""
        ? Number(body.days_in_year)
        : 365,
  };

  const loanSummary = loanSummaryFromPayout({
    property_address: loanFields.property_address,
    loan_date: loanFields.loan_date,
    sell_estimate_date: loanFields.sell_estimate_date,
    investor_name: String(body.investor_name),
    attorney: loanFields.attorney,
    amount_loaned: loanFields.amount_loaned,
    annual_interest_rate: loanFields.annual_interest_rate,
    kicker: loanFields.kicker,
    days_in_year: loanFields.days_in_year,
  });

  const payoutId = existing?.payout_id ?? String(await getNextCapitalId());

  return {
    record_kind: "capital",
    capital_id: null,
    payout_seq: null,
    payout_id: payoutId,
    date: String(body.date),
    business_name:
      body.business_name != null && body.business_name !== ""
        ? String(body.business_name)
        : null,
    business_address:
      body.business_address != null && body.business_address !== ""
        ? String(body.business_address)
        : null,
    property_name: String(body.property_name),
    investor_name: String(body.investor_name),
    payout_type: String(body.payout_type ?? "Return of Capital"),
    payout_amount: loanSummary?.total_payout ?? Number(body.payout_amount ?? 0),
    payment_method:
      body.payment_method != null && body.payment_method !== ""
        ? String(body.payment_method)
        : null,
    payment_date:
      body.payment_date != null && body.payment_date !== ""
        ? String(body.payment_date)
        : null,
    tax_year:
      body.tax_year != null && body.tax_year !== "" ? Number(body.tax_year) : null,
    status: body.status != null ? String(body.status) : "Pending",
    notes:
      body.notes != null && body.notes !== "" ? String(body.notes) : null,
    ...loanFields,
  };
}

async function parsePayoutBody(
  body: Record<string, unknown>,
  existing?: InvestorPayout
): Promise<Omit<InvestorPayout, "id" | "created_at">> {
  const capitalId = String(body.capital_id ?? existing?.capital_id ?? "");
  if (!capitalId) {
    throw new Error("Capital ID is required for payout records.");
  }

  const capital = await getInvestorCapitalByCapitalId(capitalId);
  if (!capital) {
    throw new Error("Selected capital record was not found.");
  }

  const payoutSeq =
    existing?.payout_seq ??
    (await getNextPayoutSequenceForCapital(capitalId));

  return {
    record_kind: "payout",
    capital_id: capitalId,
    payout_seq: payoutSeq,
    payout_id: String(payoutSeq),
    date: String(body.date),
    business_name: capital.business_name,
    business_address: capital.business_address,
    property_name: capital.property_name,
    property_address: capital.property_address,
    loan_date: capital.loan_date,
    sell_estimate_date: capital.sell_estimate_date,
    investor_name: capital.investor_name,
    attorney: capital.attorney,
    amount_loaned: capital.amount_loaned,
    annual_interest_rate: capital.annual_interest_rate,
    kicker: capital.kicker,
    days_in_year: capital.days_in_year,
    payout_type: String(body.payout_type),
    payout_amount: Number(body.payout_amount ?? 0),
    payment_method:
      body.payment_method != null && body.payment_method !== ""
        ? String(body.payment_method)
        : null,
    payment_date:
      body.payment_date != null && body.payment_date !== ""
        ? String(body.payment_date)
        : null,
    tax_year:
      body.tax_year != null && body.tax_year !== "" ? Number(body.tax_year) : null,
    status: body.status != null ? String(body.status) : "Pending",
    notes:
      body.notes != null && body.notes !== "" ? String(body.notes) : null,
  };
}

export async function GET(request: Request) {
  const forbidden = await requireAdminOrForbidden();
  if (forbidden) return forbidden;
  const archived = parseArchivedParam(request);
  const kind = parseKindParam(request);
  return handleRoute(() => listInvestorPayouts(archived, kind));
}

export async function POST(request: Request) {
  const forbidden = await requireAdminOrForbidden();
  if (forbidden) return forbidden;
  try {
    const body = await request.json();
    const recordKind = parseRecordKind(body.record_kind);

    if (recordKind === "payout") {
      if (!body.date || !body.capital_id || !body.payout_type) {
        return jsonError("Date, capital ID, and payout type are required.");
      }
      const payout = await createInvestorPayout(await parsePayoutBody(body));
      return jsonOk(payout, 201);
    }

    if (!body.date || !body.business_name || !body.property_name || !body.investor_name) {
      return jsonError("Date, business, property, and investor are required.");
    }
    const payout = await createInvestorPayout(await parseCapitalBody(body));
    return jsonOk(payout, 201);
  } catch (error) {
    return jsonError((error as Error).message, 400);
  }
}

export async function PUT(request: Request) {
  const forbidden = await requireAdminOrForbidden();
  if (forbidden) return forbidden;
  try {
    const id = parseIdParam(request);
    if (!id) return jsonError("Investor payout id is required.");
    const body = await request.json();
    const recordKind = parseRecordKind(body.record_kind);

    if (recordKind === "payout") {
      if (!body.date || !body.capital_id || !body.payout_type) {
        return jsonError("Date, capital ID, and payout type are required.");
      }
      const existing = (await listInvestorPayouts(false, "payout")).find(
        (row) => row.id === id
      );
      const payout = await updateInvestorPayout(
        id,
        await parsePayoutBody(body, existing)
      );
      return jsonOk(payout);
    }

    if (!body.date || !body.business_name || !body.property_name || !body.investor_name) {
      return jsonError("Date, business, property, and investor are required.");
    }
    const existing = (await listInvestorPayouts(false, "capital")).find(
      (row) => row.id === id
    );
    const payout = await updateInvestorPayout(
      id,
      await parseCapitalBody(body, existing)
    );
    return jsonOk(payout);
  } catch (error) {
    return jsonError((error as Error).message, 400);
  }
}

export async function DELETE(request: Request) {
  const forbidden = await requireAdminOrForbidden();
  if (forbidden) return forbidden;
  try {
    const id = parseIdParam(request);
    if (!id) return jsonError("Investor payout id is required.");
    await archiveInvestorPayout(id);
    return jsonOk({ archived: true });
  } catch (error) {
    return jsonError((error as Error).message, 400);
  }
}

export async function PATCH(request: Request) {
  const forbidden = await requireAdminOrForbidden();
  if (forbidden) return forbidden;
  try {
    const id = parseIdParam(request);
    if (!id) return jsonError("Investor payout id is required.");
    await restoreInvestorPayout(id);
    return jsonOk({ restored: true });
  } catch (error) {
    return jsonError((error as Error).message, 400);
  }
}