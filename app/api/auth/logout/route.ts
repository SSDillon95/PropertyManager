import { jsonOk } from "@/lib/api-helpers";
import { SESSION_COOKIE } from "@/lib/auth";

export async function POST() {
  const response = jsonOk({ loggedOut: true });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}