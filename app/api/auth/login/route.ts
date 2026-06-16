import { jsonError, jsonOk } from "@/lib/api-helpers";
import {
  createSessionToken,
  MASTER_USERNAME,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  validateCredentials,
} from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { username?: string; password?: string };
    const username = body.username?.trim() ?? "";
    const password = body.password ?? "";

    if (!username || !password) {
      return jsonError("Username and password are required.", 400);
    }

    if (!validateCredentials(username, password)) {
      return jsonError("Invalid username or password.", 401);
    }

    const token = await createSessionToken();
    const response = jsonOk({ username: MASTER_USERNAME });
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