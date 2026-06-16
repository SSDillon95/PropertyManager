import {
  createRentPayment,
  deleteRentPayment,
  listRentPayments,
} from "@/lib/db";
import { handleRoute, jsonError, jsonOk } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET() {
  return handleRoute(() => listRentPayments());
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

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get("id"));
    if (!id) return jsonError("Payment id is required.");
    await deleteRentPayment(id);
    return jsonOk({ deleted: true });
  } catch (error) {
    return jsonError((error as Error).message, 400);
  }
}