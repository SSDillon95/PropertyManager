import {
  archiveExpense,
  createExpense,
  listExpenses,
  restoreExpense,
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
  return handleRoute(() => listExpenses(archived));
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
    const id = parseIdParam(request);
    if (!id) return jsonError("Expense id is required.");
    await archiveExpense(id);
    return jsonOk({ archived: true });
  } catch (error) {
    return jsonError((error as Error).message, 400);
  }
}

export async function PATCH(request: Request) {
  try {
    const id = parseIdParam(request);
    if (!id) return jsonError("Expense id is required.");
    await restoreExpense(id);
    return jsonOk({ restored: true });
  } catch (error) {
    return jsonError((error as Error).message, 400);
  }
}