import { getDashboardSummary } from "@/lib/db";
import { handleRoute } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET() {
  return handleRoute(() => getDashboardSummary());
}