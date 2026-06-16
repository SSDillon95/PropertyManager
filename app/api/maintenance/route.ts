import {
  createMaintenance,
  deleteMaintenance,
  listMaintenance,
} from "@/lib/db";
import { handleRoute, jsonError, jsonOk } from "@/lib/api-helpers";

export async function GET() {
  return handleRoute(() => listMaintenance());
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.date_reported || !body.property_name || !body.category || !body.description) {
      return jsonError("Date reported, property, category, and description are required.");
    }
    const record = await createMaintenance({
      date_reported: String(body.date_reported),
      property_name: String(body.property_name),
      unit: body.unit ?? null,
      category: String(body.category),
      description: String(body.description),
      priority: String(body.priority ?? "Medium"),
      status: String(body.status ?? "Open"),
      vendor: body.vendor ?? null,
      estimated_cost:
        body.estimated_cost != null ? Number(body.estimated_cost) : null,
      actual_cost: body.actual_cost != null ? Number(body.actual_cost) : null,
      date_completed: body.date_completed ?? null,
      notes: body.notes ?? null,
    });
    return jsonOk(record, 201);
  } catch (error) {
    return jsonError((error as Error).message, 400);
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get("id"));
    if (!id) return jsonError("Maintenance id is required.");
    await deleteMaintenance(id);
    return jsonOk({ deleted: true });
  } catch (error) {
    return jsonError((error as Error).message, 400);
  }
}