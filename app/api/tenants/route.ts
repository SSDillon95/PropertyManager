import { createTenant, deleteTenant, listTenants } from "@/lib/db";
import { handleRoute, jsonError, jsonOk } from "@/lib/api-helpers";

export async function GET() {
  return handleRoute(() => listTenants());
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.tenant_id || !body.first_name || !body.last_name) {
      return jsonError("Tenant ID, first name, and last name are required.");
    }
    const tenant = await createTenant({
      tenant_id: String(body.tenant_id),
      first_name: String(body.first_name),
      last_name: String(body.last_name),
      email: body.email ?? null,
      phone: body.phone ?? null,
      emergency_contact: body.emergency_contact ?? null,
      emergency_phone: body.emergency_phone ?? null,
      property_name: body.property_name ?? null,
      unit: body.unit ?? null,
      move_in_date: body.move_in_date ?? null,
      move_out_date: body.move_out_date ?? null,
      status: String(body.status ?? "Active"),
      notes: body.notes ?? null,
    });
    return jsonOk(tenant, 201);
  } catch (error) {
    return jsonError((error as Error).message, 400);
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get("id"));
    if (!id) return jsonError("Tenant id is required.");
    await deleteTenant(id);
    return jsonOk({ deleted: true });
  } catch (error) {
    return jsonError((error as Error).message, 400);
  }
}