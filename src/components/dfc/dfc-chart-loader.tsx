"use client";

import dynamic from "next/dynamic";

import type { DFCResult } from "@/lib/dfc";

type DfcChartProps = {
  result: DFCResult;
  expanded?: boolean;
};

const LazyDfcChart = dynamic<DfcChartProps>(
  () => import("./dfc-chart").then((mod) => mod.DfcChart),
  {
    ssr: false,
    loading: () => <DfcChartSkeleton />,
  },
);

export function DfcChartLoader(props: DfcChartProps) {
  return <LazyDfcChart {...props} />;
}

function DfcChartSkeleton() {
  return (
    <section className="h-[316px] animate-pulse rounded-xl border border-line bg-surface p-lg shadow-sm-warm">
      <div className="h-5 w-40 rounded bg-sunken" />
      <div className="mt-sm h-3 w-56 rounded bg-sunken" />
      <div className="mt-lg h-[220px] rounded-lg bg-sunken" />
    </section>
  );
}
