import {
  archiveProperty,
  createProperty,
  listProperties,
  restoreProperty,
  updateProperty,
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
  return handleRoute(() => listProperties(archived));
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const legalId = body.legal_id ?? body.property_id;
    if (!legalId || !body.property_name || !body.address) {
      return jsonError("Legal ID, name, and address are required.");
    }
    const property = await createProperty({
      legal_id: String(legalId),
      business_name: body.business_name ?? null,
      property_name: String(body.property_name),
      lien_holder: body.lien_holder ?? null,
      account_number: body.account_number ?? null,
      address: String(body.address),
      city: String(body.city ?? ""),
      state: String(body.state ?? ""),
      zip: String(body.zip ?? ""),
      property_type: String(body.property_type ?? "Single Family"),
      units: Number(body.units ?? 1),
      bedrooms: body.bedrooms != null ? Number(body.bedrooms) : null,
      bathrooms: body.bathrooms != null ? Number(body.bathrooms) : null,
      sq_ft: body.sq_ft != null ? Number(body.sq_ft) : null,
      year_built: body.year_built != null ? Number(body.year_built) : null,
      purchase_date: body.purchase_date ?? null,
      purchase_price: body.purchase_price != null ? Number(body.purchase_price) : null,
      current_value: body.current_value != null ? Number(body.current_value) : null,
      mortgage_balance: body.mortgage_balance != null ? Number(body.mortgage_balance) : null,
      monthly_mortgage: body.monthly_mortgage != null ? Number(body.monthly_mortgage) : null,
      annual_property_tax:
        body.annual_property_tax != null ? Number(body.annual_property_tax) : null,
      annual_insurance:
        body.annual_insurance != null ? Number(body.annual_insurance) : null,
      monthly_hoa: body.monthly_hoa != null ? Number(body.monthly_hoa) : null,
      monthly_rent: body.monthly_rent != null ? Number(body.monthly_rent) : null,
      status: String(body.status ?? "Vacant"),
      notes: body.notes ?? null,
    });
    return jsonOk(property, 201);
  } catch (error) {
    return jsonError((error as Error).message, 400);
  }
}

export async function PUT(request: Request) {
  try {
    const id = parseIdParam(request);
    if (!id) return jsonError("Property id is required.");
    const body = await request.json();
    const legalId = body.legal_id ?? body.property_id;
    if (!legalId || !body.property_name || !body.address) {
      return jsonError("Legal ID, name, and address are required.");
    }
    const property = await updateProperty(id, {
      legal_id: String(legalId),
      business_name: body.business_name ?? null,
      property_name: String(body.property_name),
      lien_holder: body.lien_holder ?? null,
      account_number: body.account_number ?? null,
      address: String(body.address),
      city: String(body.city ?? ""),
      state: String(body.state ?? ""),
      zip: String(body.zip ?? ""),
      property_type: String(body.property_type ?? "Single Family"),
      units: Number(body.units ?? 1),
      bedrooms: body.bedrooms != null ? Number(body.bedrooms) : null,
      bathrooms: body.bathrooms != null ? Number(body.bathrooms) : null,
      sq_ft: body.sq_ft != null ? Number(body.sq_ft) : null,
      year_built: body.year_built != null ? Number(body.year_built) : null,
      purchase_date: body.purchase_date ?? null,
      purchase_price: body.purchase_price != null ? Number(body.purchase_price) : null,
      current_value: body.current_value != null ? Number(body.current_value) : null,
      mortgage_balance: body.mortgage_balance != null ? Number(body.mortgage_balance) : null,
      monthly_mortgage: body.monthly_mortgage != null ? Number(body.monthly_mortgage) : null,
      annual_property_tax:
        body.annual_property_tax != null ? Number(body.annual_property_tax) : null,
      annual_insurance:
        body.annual_insurance != null ? Number(body.annual_insurance) : null,
      monthly_hoa: body.monthly_hoa != null ? Number(body.monthly_hoa) : null,
      monthly_rent: body.monthly_rent != null ? Number(body.monthly_rent) : null,
      status: String(body.status ?? "Vacant"),
      notes: body.notes ?? null,
    });
    return jsonOk(property);
  } catch (error) {
    return jsonError((error as Error).message, 400);
  }
}

export async function DELETE(request: Request) {
  try {
    const id = parseIdParam(request);
    if (!id) return jsonError("Property id is required.");
    await archiveProperty(id);
    return jsonOk({ archived: true });
  } catch (error) {
    return jsonError((error as Error).message, 400);
  }
}

export async function PATCH(request: Request) {
  try {
    const id = parseIdParam(request);
    if (!id) return jsonError("Property id is required.");
    await restoreProperty(id);
    return jsonOk({ restored: true });
  } catch (error) {
    return jsonError((error as Error).message, 400);
  }
}