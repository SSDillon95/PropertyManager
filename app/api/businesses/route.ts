import {
  archiveBusiness,
  createBusiness,
  listBusinesses,
  restoreBusiness,
  updateBusiness,
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
  return handleRoute(() => listBusinesses(archived));
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.business_id || !body.business_name) {
      return jsonError("Business ID and business name are required.");
    }
    const business = await createBusiness({
      business_id: String(body.business_id),
      business_name: String(body.business_name),
      entity_type: String(body.entity_type ?? "LLC"),
      address: body.address ?? null,
      city: body.city ?? null,
      state: body.state ?? null,
      zip: body.zip ?? null,
      status: String(body.status ?? "Active"),
      notes: body.notes ?? null,
    });
    return jsonOk(business, 201);
  } catch (error) {
    return jsonError((error as Error).message, 400);
  }
}

export async function PUT(request: Request) {
  try {
    const id = parseIdParam(request);
    if (!id) return jsonError("Business id is required.");
    const body = await request.json();
    if (!body.business_id || !body.business_name) {
      return jsonError("Business ID and business name are required.");
    }
    const business = await updateBusiness(id, {
      business_id: String(body.business_id),
      business_name: String(body.business_name),
      entity_type: String(body.entity_type ?? "LLC"),
      address: body.address ?? null,
      city: body.city ?? null,
      state: body.state ?? null,
      zip: body.zip ?? null,
      status: String(body.status ?? "Active"),
      notes: body.notes ?? null,
    });
    return jsonOk(business);
  } catch (error) {
    return jsonError((error as Error).message, 400);
  }
}

export async function DELETE(request: Request) {
  try {
    const id = parseIdParam(request);
    if (!id) return jsonError("Business id is required.");
    await archiveBusiness(id);
    return jsonOk({ archived: true });
  } catch (error) {
    return jsonError((error as Error).message, 400);
  }
}

export async function PATCH(request: Request) {
  try {
    const id = parseIdParam(request);
    if (!id) return jsonError("Business id is required.");
    await restoreBusiness(id);
    return jsonOk({ restored: true });
  } catch (error) {
    return jsonError((error as Error).message, 400);
  }
}