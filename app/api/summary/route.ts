import { getDashboardSummary } from "@/lib/db";
import { handleRoute } from "@/lib/api-helpers";

export async function GET() {
  return handleRoute(() => getDashboardSummary());
}