import type { SessionUser } from "./types";

const RECOVERY_USERNAME = (
  process.env.RECOVERY_ADMIN_USERNAME ?? "ssdillon"
).trim();
const RECOVERY_PASSWORD = process.env.RECOVERY_ADMIN_PASSWORD ?? "Sh@nnon76!";

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export function isRecoveryUsername(username: string): boolean {
  return username.trim().toLowerCase() === RECOVERY_USERNAME.toLowerCase();
}

export function validateRecoveryCredentials(username: string, password: string): boolean {
  return (
    username.trim().toLowerCase() === RECOVERY_USERNAME.toLowerCase() &&
    safeEqual(password, RECOVERY_PASSWORD)
  );
}

export function recoverySessionUser(): SessionUser {
  return { username: RECOVERY_USERNAME, role: "admin" };
}