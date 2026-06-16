import { jsonError, jsonOk } from "@/lib/api-helpers";
import {
  appUserToRow,
  createAppUser,
  deactivateAppUser,
  listAppUsers,
  updateAppUser,
} from "@/lib/db";
import { requireAdminOrForbidden } from "@/lib/session";
import type { UserRole } from "@/lib/types";

export const dynamic = "force-dynamic";

function parseRole(role: unknown): UserRole {
  return String(role ?? "").trim().toLowerCase() === "admin" ? "admin" : "standard";
}

export async function GET() {
  const forbidden = await requireAdminOrForbidden();
  if (forbidden) return forbidden;
  const users = await listAppUsers();
  return jsonOk(users.map(appUserToRow));
}

export async function POST(request: Request) {
  const forbidden = await requireAdminOrForbidden();
  if (forbidden) return forbidden;

  try {
    const body = await request.json();
    const username = String(body.username ?? "").trim();
    const password = String(body.password ?? "");
    if (!username) return jsonError("Username is required.", 400);
    if (!password) return jsonError("Password is required.", 400);

    const user = await createAppUser({
      username,
      password,
      role: parseRole(body.role),
      status: String(body.status ?? "Active"),
    });
    return jsonOk(appUserToRow(user), 201);
  } catch (error) {
    return jsonError((error as Error).message, 400);
  }
}

export async function PUT(request: Request) {
  const forbidden = await requireAdminOrForbidden();
  if (forbidden) return forbidden;

  try {
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!id) return jsonError("User id is required.", 400);
    const body = await request.json();
    const username = String(body.username ?? "").trim();
    if (!username) return jsonError("Username is required.", 400);

    const user = await updateAppUser(id, {
      username,
      role: parseRole(body.role),
      status: String(body.status ?? "Active"),
      password: body.password ? String(body.password) : undefined,
    });
    return jsonOk(appUserToRow(user));
  } catch (error) {
    return jsonError((error as Error).message, 400);
  }
}

export async function DELETE(request: Request) {
  const forbidden = await requireAdminOrForbidden();
  if (forbidden) return forbidden;

  try {
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!id) return jsonError("User id is required.", 400);
    await deactivateAppUser(id);
    return jsonOk({ deactivated: true });
  } catch (error) {
    return jsonError((error as Error).message, 400);
  }
}