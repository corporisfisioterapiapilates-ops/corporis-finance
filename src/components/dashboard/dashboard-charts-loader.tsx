"use client";

import dynamic from "next/dynamic";

import type { BalancePoint, ExpenseGroup, MonthlyFlow } from "@/lib/dashboard/calculate";

type DashboardChartsProps = {
  monthlyFlow: MonthlyFlow[];
  balanceEvolution: BalancePoint[];
  expensesByGroup: ExpenseGroup[];
  periodLabel: string;
};

const LazyDashboardCharts = dynamic<DashboardChartsProps>(
  () => import("./dashboard-charts").then((mod) => mod.DashboardCharts),
  {
    ssr: false,
    loading: () => <DashboardChartsSkeleton />,
  },
);

export function DashboardChartsLoader(props: DashboardChartsProps) {
  return <LazyDashboardCharts {...props} />;
}

function DashboardChartsSkeleton() {
  return (
    <div className="grid gap-md xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_340px]">
      {[0, 1, 2].map((item) => (
        <section
          key={item}
          className="h-[290px] animate-pulse rounded-xl border border-line bg-surface p-lg shadow-sm-warm"
        >
          <div className="h-5 w-36 rounded bg-sunken" />
          <div className="mt-sm h-3 w-24 rounded bg-sunken" />
          <div className="mt-lg h-[180px] rounded-lg bg-sunken" />
        </section>
      ))}
    </div>
  );
}
