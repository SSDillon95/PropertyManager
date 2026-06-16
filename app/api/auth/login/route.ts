import { jsonError, jsonOk } from "@/lib/api-helpers";
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth";
import { authenticateAppUser } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { username?: string; password?: string };
    const username = body.username?.trim() ?? "";
    const password = body.password ?? "";

    if (!username || !password) {
      return jsonError("Username and password are required.", 400);
    }

    const user = await authenticateAppUser(username, password);
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