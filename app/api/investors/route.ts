import {
  archiveInvestor,
  createInvestor,
  listInvestors,
  restoreInvestor,
  updateInvestor,
} from "@/lib/db";
import {
  handleRoute,
  jsonError,
  jsonOk,
  parseArchivedParam,
  parseIdParam,
} from "@/lib/api-helpers";
import { requireAdminOrForbidden } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const forbidden = await requireAdminOrForbidden();
  if (forbidden) return forbidden;
  const archived = parseArchivedParam(request);
  return handleRoute(() => listInvestors(archived));
}

export async function POST(request: Request) {
  const forbidden = await requireAdminOrForbidden();
  if (forbidden) return forbidden;
  try {
    const body = await request.json();
    if (!body.investor_id || !body.investor_name) {
      return jsonError("Investor ID and investor name are required.");
    }
    const investor = await createInvestor({
      investor_id: String(body.investor_id),
      investor_name: String(body.investor_name),
      email: body.email ?? null,
      phone: body.phone ?? null,
      entity_type: String(body.entity_type ?? "Individual"),
      tax_id: body.tax_id ?? null,
      address: body.address ?? null,
      city: body.city ?? null,
      state: body.state ?? null,
      zip: body.zip ?? null,
      property_name: body.property_name ?? null,
      ownership_pct:
        body.ownership_pct != null && body.ownership_pct !== ""
          ? Number(body.ownership_pct)
          : null,
      status: String(body.status ?? "Active"),
      notes: body.notes ?? null,
    });
    return jsonOk(investor, 201);
  } catch (error) {
    return jsonError((error as Error).message, 400);
  }
}

export async function PUT(request: Request) {
  const forbidden = await requireAdminOrForbidden();
  if (forbidden) return forbidden;
  try {
    const id = parseIdParam(request);
    if (!id) return jsonError("Investor id is required.");
    const body = await request.json();
    if (!body.investor_id || !body.investor_name) {
      return jsonError("Investor ID and investor name are required.");
    }
    const investor = await updateInvestor(id, {
      investor_id: String(body.investor_id),
      investor_name: String(body.investor_name),
      email: body.email ?? null,
      phone: body.phone ?? null,
      entity_type: String(body.entity_type ?? "Individual"),
      tax_id: body.tax_id ?? null,
      address: body.address ?? null,
      city: body.city ?? null,
      state: body.state ?? null,
      zip: body.zip ?? null,
      property_name: body.property_name ?? null,
      ownership_pct:
        body.ownership_pct != null && body.ownership_pct !== ""
          ? Number(body.ownership_pct)
          : null,
      status: String(body.status ?? "Active"),
      notes: body.notes ?? null,
    });
    return jsonOk(investor);
  } catch (error) {
    return jsonError((error as Error).message, 400);
  }
}

export async function DELETE(request: Request) {
  const forbidden = await requireAdminOrForbidden();
  if (forbidden) return forbidden;
  try {
    const id = parseIdParam(request);
    if (!id) return jsonError("Investor id is required.");
    await archiveInvestor(id);
    return jsonOk({ archived: true });
  } catch (error) {
    return jsonError((error as Error).message, 400);
  }
}

export async function PATCH(request: Request) {
  const forbidden = await requireAdminOrForbidden();
  if (forbidden) return forbidden;
  try {
    const id = parseIdParam(request);
    if (!id) return jsonError("Investor id is required.");
    await restoreInvestor(id);
    return jsonOk({ restored: true });
  } catch (error) {
    return jsonError((error as Error).message, 400);
  }
}