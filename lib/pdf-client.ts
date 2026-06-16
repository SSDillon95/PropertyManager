import type { ReportKind } from "./reports";

type PdfApiKind = ReportKind | "investor_payout_form";

async function downloadPdfResponse(response: Response): Promise<void> {
  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(message || "Failed to generate PDF.");
  }

  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const filename =
    disposition.match(/filename="([^"]+)"/)?.[1] ??
    disposition.match(/filename=([^;]+)/)?.[1]?.trim() ??
    "hop2it-report.pdf";

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function requestReportPdf(
  kind: PdfApiKind,
  payload: Record<string, unknown>
): Promise<void> {
  const response = await fetch("/api/reports/pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ kind, ...payload }),
  });
  await downloadPdfResponse(response);
}