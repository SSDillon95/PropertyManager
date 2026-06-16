import { cookies } from "next/headers";
import { parseSessionToken, SESSION_COOKIE } from "./auth";
import type { SessionUser } from "./types";
import { jsonError } from "./api-helpers";

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  return parseSessionToken(token);
}

export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  return session;
}

export async function requireAdmin(): Promise<SessionUser> {
  const session = await requireSession();
  if (session.role !== "admin") throw new Error("Forbidden");
  return session;
}

export async function requireAdminOrForbidden() {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);
  if (session.role !== "admin") return jsonError("Forbidden", 403);
  return null;
}