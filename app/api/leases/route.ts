import {
  archiveLease,
  createLease,
  listLeases,
  restoreLease,
  updateLease,
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
  return handleRoute(() => listLeases(archived));
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.lease_id || !body.property_name || !body.tenant_name || !body.lease_start) {
      return jsonError("Lease ID, property, tenant, and start date are required.");
    }
    const lease = await createLease({
      lease_id: String(body.lease_id),
      property_name: String(body.property_name),
      unit: body.unit ?? null,
      tenant_name: String(body.tenant_name),
      lease_start: String(body.lease_start),
      lease_end: body.lease_end ?? null,
      monthly_rent: Number(body.monthly_rent ?? 0),
      security_deposit:
        body.security_deposit != null ? Number(body.security_deposit) : null,
      pet_deposit: body.pet_deposit != null ? Number(body.pet_deposit) : null,
      lease_type: String(body.lease_type ?? "Fixed Term"),
      status: String(body.status ?? "Active"),
      renewal_date: body.renewal_date ?? null,
      notes: body.notes ?? null,
    });
    return jsonOk(lease, 201);
  } catch (error) {
    return jsonError((error as Error).message, 400);
  }
}

export async function PUT(request: Request) {
  try {
    const id = parseIdParam(request);
    if (!id) return jsonError("Lease id is required.");
    const body = await request.json();
    if (!body.lease_id || !body.property_name || !body.tenant_name || !body.lease_start) {
      return jsonError("Lease ID, property, tenant, and start date are required.");
    }
    const lease = await updateLease(id, {
      lease_id: String(body.lease_id),
      property_name: String(body.property_name),
      unit: body.unit ?? null,
      tenant_name: String(body.tenant_name),
      lease_start: String(body.lease_start),
      lease_end: body.lease_end ?? null,
      monthly_rent: Number(body.monthly_rent ?? 0),
      security_deposit:
        body.security_deposit != null ? Number(body.security_deposit) : null,
      pet_deposit: body.pet_deposit != null ? Number(body.pet_deposit) : null,
      lease_type: String(body.lease_type ?? "Fixed Term"),
      status: String(body.status ?? "Active"),
      renewal_date: body.renewal_date ?? null,
      notes: body.notes ?? null,
    });
    return jsonOk(lease);
  } catch (error) {
    return jsonError((error as Error).message, 400);
  }
}

export async function DELETE(request: Request) {
  try {
    const id = parseIdParam(request);
    if (!id) return jsonError("Lease id is required.");
    await archiveLease(id);
    return jsonOk({ archived: true });
  } catch (error) {
    return jsonError((error as Error).message, 400);
  }
}

export async function PATCH(request: Request) {
  try {
    const id = parseIdParam(request);
    if (!id) return jsonError("Lease id is required.");
    await restoreLease(id);
    return jsonOk({ restored: true });
  } catch (error) {
    return jsonError((error as Error).message, 400);
  }
}