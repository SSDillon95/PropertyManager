import {
  archiveInvestorPayout,
  createInvestorPayout,
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
import type { InvestorPayout } from "@/lib/types";

export const dynamic = "force-dynamic";

function parsePayoutBody(
  body: Record<string, unknown>
): Omit<InvestorPayout, "id" | "created_at"> {
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

  const payoutAmount =
    loanSummary?.total_payout ??
    Number(body.payout_amount ?? 0);

  return {
    payout_id: String(body.payout_id),
    date: String(body.date),
    property_name: String(body.property_name),
    investor_name: String(body.investor_name),
    payout_type: String(body.payout_type),
    payout_amount: payoutAmount,
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

export async function GET(request: Request) {
  const archived = parseArchivedParam(request);
  return handleRoute(() => listInvestorPayouts(archived));
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.payout_id || !body.date || !body.property_name || !body.investor_name || !body.payout_type) {
      return jsonError("Payout ID, date, property, investor, and payout type are required.");
    }
    const payout = await createInvestorPayout(parsePayoutBody(body));
    return jsonOk(payout, 201);
  } catch (error) {
    return jsonError((error as Error).message, 400);
  }
}

export async function PUT(request: Request) {
  try {
    const id = parseIdParam(request);
    if (!id) return jsonError("Investor payout id is required.");
    const body = await request.json();
    if (!body.payout_id || !body.date || !body.property_name || !body.investor_name || !body.payout_type) {
      return jsonError("Payout ID, date, property, investor, and payout type are required.");
    }
    const payout = await updateInvestorPayout(id, parsePayoutBody(body));
    return jsonOk(payout);
  } catch (error) {
    return jsonError((error as Error).message, 400);
  }
}

export async function DELETE(request: Request) {
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
  try {
    const id = parseIdParam(request);
    if (!id) return jsonError("Investor payout id is required.");
    await restoreInvestorPayout(id);
    return jsonOk({ restored: true });
  } catch (error) {
    return jsonError((error as Error).message, 400);
  }
}