import { ProjectionManager } from "@/components/projection/projection-manager";
import { calculateCashProjection, type ProjectionScenario } from "@/lib/dfc/projection";
import { createClient } from "@/lib/supabase/server";

const SCENARIOS: ProjectionScenario[] = ["conservative", "realistic", "optimistic"];

export default async function ProjecaoPage() {
  const supabase = await createClient();
  const today = new Date();
  const historyStart = new Date(today);
  historyStart.setDate(historyStart.getDate() - 120);
  const horizonEnd = new Date(today);
  horizonEnd.setDate(horizonEnd.getDate() + 90);

  const [{ data: accounts, error: accountsError }, { data: transactions, error: txError }] =
    await Promise.all([
      supabase.from("accounts").select("id,type,opening_balance,is_active").eq("is_active", true),
      supabase
        .from("transactions")
        .select(
          "id,account_id,category_id,amount,cash_date,description,status,transfer_direction,type",
        )
        .gte("cash_date", toDateOnly(historyStart))
        .lte("cash_date", toDateOnly(horizonEnd)),
    ]);

  const projections = Object.fromEntries(
    SCENARIOS.map((scenario) => [
      scenario,
      calculateCashProjection({
        accounts: accounts ?? [],
        transactions: transactions ?? [],
        today,
        scenario,
      }),
    ]),
  ) as Record<ProjectionScenario, ReturnType<typeof calculateCashProjection>>;

  return (
    <>
      {accountsError || txError ? (
        <div className="mb-md rounded-lg border border-danger/30 bg-danger-soft px-md py-sm text-body-sm text-danger">
          Não foi possível carregar a projeção agora. Tente novamente em instantes.
        </div>
      ) : null}
      <ProjectionManager projections={projections} />
    </>
  );
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}
