import { NextResponse } from "next/server";
import type { SmsContactType } from "./types";

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function handleRoute<T>(
  fn: () => Promise<T>,
  status = 200
) {
  try {
    const data = await fn();
    return jsonOk(data, status);
  } catch (error) {
    return jsonError((error as Error).message, 500);
  }
}

export function parseArchivedParam(request: Request): boolean {
  return new URL(request.url).searchParams.get("archived") === "1";
}

export function parseContactTypeParam(request: Request): SmsContactType | null {
  const value = new URL(request.url).searchParams.get("contact_type");
  if (value === "tenant" || value === "investor") return value;
  return null;
}

export function parseIdParam(request: Request): number {
  return Number(new URL(request.url).searchParams.get("id"));
}