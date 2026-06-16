import { createExpense, deleteExpense, listExpenses } from "@/lib/db";
import { handleRoute, jsonError, jsonOk } from "@/lib/api-helpers";

export async function GET() {
  return handleRoute(() => listExpenses());
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.date || !body.property_name || !body.category) {
      return jsonError("Date, property, and category are required.");
    }
    const expense = await createExpense({
      date: String(body.date),
      property_name: String(body.property_name),
      category: String(body.category),
      vendor: body.vendor ?? null,
      description: body.description ?? null,
      amount: Number(body.amount ?? 0),
      payment_method: body.payment_method ?? null,
      receipt_number: body.receipt_number ?? null,
      notes: body.notes ?? null,
    });
    return jsonOk(expense, 201);
  } catch (error) {
    return jsonError((error as Error).message, 400);
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get("id"));
    if (!id) return jsonError("Expense id is required.");
    await deleteExpense(id);
    return jsonOk({ deleted: true });
  } catch (error) {
    return jsonError((error as Error).message, 400);
  }
}