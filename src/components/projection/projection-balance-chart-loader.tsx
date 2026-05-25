"use client";

import dynamic from "next/dynamic";

import type { ProjectionSummary } from "@/lib/dfc/projection";

type ProjectionBalanceChartProps = {
  chart: ProjectionSummary["chart"];
  minimumBalance: number;
};

const LazyProjectionBalanceChart = dynamic<ProjectionBalanceChartProps>(
  () => import("./projection-balance-chart").then((mod) => mod.ProjectionBalanceChart),
  {
    ssr: false,
    loading: () => <ProjectionBalanceChartSkeleton />,
  },
);

export function ProjectionBalanceChartLoader(props: ProjectionBalanceChartProps) {
  return <LazyProjectionBalanceChart {...props} />;
}

function ProjectionBalanceChartSkeleton() {
  return <div className="h-[320px] animate-pulse rounded-lg bg-sunken" />;
}
