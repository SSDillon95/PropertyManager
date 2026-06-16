import {
  archiveInvestorPayout,
  createInvestorPayout,
  listInvestorPayouts,
  restoreInvestorPayout,
} from "@/lib/db";
import {
  handleRoute,
  jsonError,
  jsonOk,
  parseArchivedParam,
  parseIdParam,
} from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

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
    const payout = await createInvestorPayout({
      payout_id: String(body.payout_id),
      date: String(body.date),
      property_name: String(body.property_name),
      investor_name: String(body.investor_name),
      payout_type: String(body.payout_type),
      payout_amount: Number(body.payout_amount ?? 0),
      payment_method: body.payment_method ?? null,
      payment_date: body.payment_date ?? null,
      tax_year: body.tax_year != null && body.tax_year !== "" ? Number(body.tax_year) : null,
      status: body.status ?? "Pending",
      notes: body.notes ?? null,
    });
    return jsonOk(payout, 201);
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