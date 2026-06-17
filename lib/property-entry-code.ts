export function entryCodeButtonLabel(entryCode: string | null | undefined): string {
  const code = typeof entryCode === "string" ? entryCode.trim() : "";
  return code ? `Entry Code: ${code}` : "Entry Code";
}

export function normalizeEntryCode(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) {
    throw new Error("Entry code must be numeric.");
  }
  return trimmed;
}