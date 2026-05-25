"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { ProjectionSummary } from "@/lib/dfc/projection";
import { formatBRL } from "@/lib/money";

type ProjectionBalanceChartProps = {
  chart: ProjectionSummary["chart"];
  minimumBalance: number;
};

export function ProjectionBalanceChart({ chart, minimumBalance }: ProjectionBalanceChartProps) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={chart} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#E8E5DF" vertical={false} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={{ fill: "#9A9189", fontSize: 11 }}
          minTickGap={18}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fill: "#9A9189", fontSize: 11 }}
          tickFormatter={(value) => `R$ ${Math.round(Number(value) / 1000)}k`}
          width={58}
        />
        <Tooltip content={<ProjectionTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12, color: "#6B635B" }} />
        <ReferenceLine y={minimumBalance} stroke="#D2B06E" strokeDasharray="4 4" />
        <Line
          type="monotone"
          dataKey="actualBalance"
          name="Realizado"
          stroke="#F08353"
          strokeWidth={2.5}
          dot={false}
          connectNulls={false}
        />
        <Line
          type="monotone"
          dataKey="projectedBalance"
          name="Projetado"
          stroke="#ACC095"
          strokeWidth={2.5}
          strokeDasharray="6 4"
          dot={false}
          connectNulls={false}
        />
        <Line
          type="monotone"
          dataKey="conservativeBalance"
          name="Conservador"
          stroke="#C85A3E"
          strokeWidth={1.5}
          strokeDasharray="2 5"
          dot={false}
          connectNulls={false}
        />
        <Line
          type="monotone"
          dataKey="optimisticBalance"
          name="Otimista"
          stroke="#D2B06E"
          strokeWidth={1.5}
          strokeDasharray="2 5"
          dot={false}
          connectNulls={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function ProjectionTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="space-y-xs rounded-md bg-ink px-sm py-xs text-meta text-surface shadow-md-warm">
      <div className="font-medium">{label}</div>
      {payload
        .filter((item) => item.value !== null && item.value !== undefined)
        .map((item) => (
          <div key={String(item.dataKey)}>
            {item.name}: {formatBRL(Number(item.value ?? 0))}
          </div>
        ))}
    </div>
  );
}

type TooltipPayload = {
  name?: string;
  value?: string | number | null;
  dataKey?: string | number;
};

type TooltipProps = {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
};
