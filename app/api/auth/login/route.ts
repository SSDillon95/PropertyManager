import { jsonError, jsonOk } from "@/lib/api-helpers";
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth";
import { authenticateAppUser, ensureDefaultAdmin } from "@/lib/db";
import {
  recoverySessionUser,
  validateRecoveryCredentials,
} from "@/lib/recovery-auth";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { username?: string; password?: string };
    const username = body.username?.trim() ?? "";
    const password = body.password ?? "";

    if (!username || !password) {
      return jsonError("Username and password are required.", 400);
    }

    await ensureDefaultAdmin();
    const dbUser = await authenticateAppUser(username, password);
    const recoveryUser = validateRecoveryCredentials(username, password)
      ? recoverySessionUser()
      : null;
    const user = dbUser ?? recoveryUser;

    if (!user) {
      return jsonError("Invalid username or password.", 401);
    }

    const token = await createSessionToken(user.username, user.role);
    const response = jsonOk({
      username: user.username,
      role: user.role,
    });
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
    return response;
  } catch {
    return jsonError("Login failed.", 500);
  }
}