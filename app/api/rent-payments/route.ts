import {
  archiveRentPayment,
  createRentPayment,
  listRentPayments,
  restoreRentPayment,
  updateRentPayment,
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
  return handleRoute(() => listRentPayments(archived));
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.date || !body.property_name || !body.tenant_name) {
      return jsonError("Date, property, and tenant are required.");
    }
    const payment = await createRentPayment({
      date: String(body.date),
      property_name: String(body.property_name),
      unit: body.unit ?? null,
      tenant_name: String(body.tenant_name),
      rent_due: Number(body.rent_due ?? 0),
      amount_paid: Number(body.amount_paid ?? 0),
      payment_date: body.payment_date ?? null,
      payment_method: body.payment_method ?? null,
      late_fee: body.late_fee != null ? Number(body.late_fee) : null,
      balance: body.balance != null ? Number(body.balance) : null,
      status: String(body.status ?? "Pending"),
      notes: body.notes ?? null,
    });
    return jsonOk(payment, 201);
  } catch (error) {
    return jsonError((error as Error).message, 400);
  }
}

export async function PUT(request: Request) {
  try {
    const id = parseIdParam(request);
    if (!id) return jsonError("Payment id is required.");
    const body = await request.json();
    if (!body.date || !body.property_name || !body.tenant_name) {
      return jsonError("Date, property, and tenant are required.");
    }
    const payment = await updateRentPayment(id, {
      date: String(body.date),
      property_name: String(body.property_name),
      unit: body.unit ?? null,
      tenant_name: String(body.tenant_name),
      rent_due: Number(body.rent_due ?? 0),
      amount_paid: Number(body.amount_paid ?? 0),
      payment_date: body.payment_date ?? null,
      payment_method: body.payment_method ?? null,
      late_fee: body.late_fee != null ? Number(body.late_fee) : null,
      balance: body.balance != null ? Number(body.balance) : null,
      status: String(body.status ?? "Pending"),
      notes: body.notes ?? null,
    });
    return jsonOk(payment);
  } catch (error) {
    return jsonError((error as Error).message, 400);
  }
}

export async function DELETE(request: Request) {
  try {
    const id = parseIdParam(request);
    if (!id) return jsonError("Payment id is required.");
    await archiveRentPayment(id);
    return jsonOk({ archived: true });
  } catch (error) {
    return jsonError((error as Error).message, 400);
  }
}

export async function PATCH(request: Request) {
  try {
    const id = parseIdParam(request);
    if (!id) return jsonError("Payment id is required.");
    await restoreRentPayment(id);
    return jsonOk({ restored: true });
  } catch (error) {
    return jsonError((error as Error).message, 400);
  }
}