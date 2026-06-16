import {
  archiveTenant,
  createTenant,
  listTenants,
  restoreTenant,
  updateTenant,
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
  return handleRoute(() => listTenants(archived));
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

export async function PUT(request: Request) {
  try {
    const id = parseIdParam(request);
    if (!id) return jsonError("Tenant id is required.");
    const body = await request.json();
    if (!body.tenant_id || !body.first_name || !body.last_name) {
      return jsonError("Tenant ID, first name, and last name are required.");
    }
    const tenant = await updateTenant(id, {
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
    return jsonOk(tenant);
  } catch (error) {
    return jsonError((error as Error).message, 400);
  }
}

export async function DELETE(request: Request) {
  try {
    const id = parseIdParam(request);
    if (!id) return jsonError("Tenant id is required.");
    await archiveTenant(id);
    return jsonOk({ archived: true });
  } catch (error) {
    return jsonError((error as Error).message, 400);
  }
}

export async function PATCH(request: Request) {
  try {
    const id = parseIdParam(request);
    if (!id) return jsonError("Tenant id is required.");
    await restoreTenant(id);
    return jsonOk({ restored: true });
  } catch (error) {
    return jsonError((error as Error).message, 400);
  }
}