export const SESSION_COOKIE = "hop2it_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;
export const MASTER_USERNAME = "Hop2it";
export const MASTER_PASSWORD = "legroom";

function getSecret(): string {
  return process.env.AUTH_SECRET ?? "hop2it-dev-session-secret";
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

async function hmacSha256(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function validateCredentials(username: string, password: string): boolean {
  return (
    username.trim().toLowerCase() === MASTER_USERNAME.toLowerCase() &&
    password === MASTER_PASSWORD
  );
}

export async function createSessionToken(): Promise<string> {
  const expires = Date.now() + SESSION_MAX_AGE * 1000;
  const payload = `hop2it:${expires}`;
  const signature = await hmacSha256(getSecret(), payload);
  return `${expires}.${signature}`;
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;

  const [expiresStr, signature] = token.split(".");
  if (!expiresStr || !signature) return false;

  const expires = Number(expiresStr);
  if (!Number.isFinite(expires) || Date.now() > expires) return false;

  const payload = `hop2it:${expires}`;
  const expected = await hmacSha256(getSecret(), payload);
  return safeEqual(signature, expected);
}