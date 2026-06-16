import type { SessionUser, UserRole } from "./types";

export const SESSION_COOKIE = "hop2it_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

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

function encodeUsername(username: string): string {
  const bytes = new TextEncoder().encode(username);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeUsername(encoded: string): string | null {
  try {
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

function sessionPayload(username: string, role: UserRole, expires: number): string {
  return `hop2it:${encodeUsername(username)}:${role}:${expires}`;
}

export async function createSessionToken(username: string, role: UserRole): Promise<string> {
  const expires = Date.now() + SESSION_MAX_AGE * 1000;
  const payload = sessionPayload(username, role, expires);
  const signature = await hmacSha256(getSecret(), payload);
  return `${expires}.${encodeUsername(username)}.${role}.${signature}`;
}

export async function parseSessionToken(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 4) return null;

  const [expiresStr, usernameEncoded, rolePart, signature] = parts;
  const expires = Number(expiresStr);
  if (!Number.isFinite(expires) || Date.now() > expires) return null;
  if (rolePart !== "admin" && rolePart !== "standard") return null;

  const username = decodeUsername(usernameEncoded);
  if (!username) return null;

  const payload = sessionPayload(username, rolePart, expires);
  const expected = await hmacSha256(getSecret(), payload);
  if (!safeEqual(signature, expected)) return null;

  return { username, role: rolePart };
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  return (await parseSessionToken(token)) != null;
}