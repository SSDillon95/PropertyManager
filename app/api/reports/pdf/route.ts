import {
  buildExpensePdf,
  buildIncomePdf,
  buildInvestorPayoutPdf,
  buildInvestorPayoutReportPdf,
  buildPLPdf,
  buildVendorPayoutPdf,
} from "@/lib/pdf-reports";
import type {
  ExpenseReport,
  IncomeReport,
  InvestorPayoutReportSummary,
  PLReport,
  ReportKind,
  VendorPayoutReport,
} from "@/lib/reports";
import type { InvestorPayout } from "@/lib/types";

export const dynamic = "force-dynamic";

type PdfRequest =
  | { kind: "income"; report: IncomeReport }
  | { kind: "expense"; report: ExpenseReport }
  | { kind: "pl"; report: PLReport }
  | { kind: "vendor_payout"; report: VendorPayoutReport }
  | { kind: "investor_payout"; report: InvestorPayoutReportSummary }
  | {
      kind: "investor_payout_form";
      payout: Pick<
        InvestorPayout,
        | "payout_id"
        | "date"
        | "property_name"
        | "investor_name"
        | "payout_type"
        | "payout_amount"
        | "payment_method"
        | "payment_date"
        | "tax_year"
        | "status"
        | "notes"
      >;
    };

const BUILDERS: Record<
  ReportKind | "investor_payout_form",
  (body: PdfRequest) => Promise<{ buffer: ArrayBuffer; filename: string }>
> = {
  income: (body) => buildIncomePdf((body as Extract<PdfRequest, { kind: "income" }>).report),
  expense: (body) => buildExpensePdf((body as Extract<PdfRequest, { kind: "expense" }>).report),
  pl: (body) => buildPLPdf((body as Extract<PdfRequest, { kind: "pl" }>).report),
  vendor_payout: (body) =>
    buildVendorPayoutPdf((body as Extract<PdfRequest, { kind: "vendor_payout" }>).report),
  investor_payout: (body) =>
    buildInvestorPayoutReportPdf(
      (body as Extract<PdfRequest, { kind: "investor_payout" }>).report
    ),
  investor_payout_form: (body) =>
    buildInvestorPayoutPdf(
      (body as Extract<PdfRequest, { kind: "investor_payout_form" }>).payout
    ),
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PdfRequest;
    const builder = BUILDERS[body.kind];
    if (!builder) {
      return Response.json({ error: "Unsupported report type." }, { status: 400 });
    }

    const { buffer, filename } = await builder(body);
    return new Response(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    return Response.json(
      { error: (error as Error).message || "PDF generation failed." },
      { status: 500 }
    );
  }
}