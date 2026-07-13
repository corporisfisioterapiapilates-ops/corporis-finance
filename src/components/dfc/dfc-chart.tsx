"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { DFCResult } from "@/lib/dfc";
import { formatBRL } from "@/lib/money";
import { cn } from "@/lib/utils";

export function DfcChart({ result, expanded = false }: { result: DFCResult; expanded?: boolean }) {
  const chartData = result.months.map((month) => {
    const flow = result.monthlyCashFlow[month.key];
    return {
      month: month.label,
      income: Number(flow?.income ?? 0),
      expense: Number(flow?.expense ?? 0),
      result: Number(flow?.result ?? 0),
    };
  });

  return (
    <section
      className={cn(
        "rounded-xl border border-line bg-surface p-lg shadow-sm-warm",
        expanded && "border-none p-0 shadow-none",
      )}
    >
      <div className="mb-lg flex flex-wrap items-center justify-between gap-md">
        <div>
          <h2 className="font-display text-h3 lowercase text-ink">evolução mensal</h2>
          <p className="mt-xs text-meta text-ink-tertiary">
            Entradas realizadas x saídas realizadas x resultado
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-md text-meta text-ink-tertiary">
          <ChartLegend color="#ACC095" label="Entradas" />
          <ChartLegend color="rgba(200,90,62,.55)" label="Saídas" />
          <ChartLegend color="#F08353" label="Resultado" line />
        </div>
      </div>
      <div className={expanded ? "h-[420px]" : "h-[220px]"}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#E8E5DF" vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#9A9189", fontSize: 11 }}
            />
            <YAxis
              yAxisId="left"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#9A9189", fontSize: 11 }}
              tickFormatter={(value) => `R$ ${Math.round(Number(value) / 1000)}k`}
              width={52}
            />
            <YAxis yAxisId="right" orientation="right" hide />
            <Tooltip content={<DfcTooltip />} />
            <Bar yAxisId="left" dataKey="income" fill="#ACC095" radius={[4, 4, 4, 4]} />
            <Bar
              yAxisId="left"
              dataKey="expense"
              fill="rgba(200,90,62,.55)"
              radius={[4, 4, 4, 4]}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="result"
              stroke="#F08353"
              strokeWidth={2.5}
              dot={{ r: 4, fill: "#fff", stroke: "#F08353", strokeWidth: 2 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function ChartLegend({
  color,
  label,
  line = false,
}: {
  color: string;
  label: string;
  line?: boolean;
}) {
  return (
    <div className="flex items-center gap-xs">
      <span
        className={cn(line ? "h-[3px] w-3 rounded-full" : "size-3 rounded-[2px]")}
        style={{ background: color }}
      />
      {label}
    </div>
  );
}

function DfcTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="space-y-xs rounded-md bg-ink px-sm py-xs text-meta text-surface shadow-md-warm">
      {payload.map((item) => (
        <div key={String(item.dataKey)}>
          {labelForDataKey(String(item.dataKey))}: {formatBRL(Number(item.value ?? 0))}
        </div>
      ))}
    </div>
  );
}

function labelForDataKey(dataKey: string): string {
  const labels: Record<string, string> = {
    income: "Entradas",
    expense: "Saídas",
    result: "Resultado",
  };
  return labels[dataKey] ?? dataKey;
}

type TooltipPayload = {
  value?: string | number;
  dataKey?: string | number;
};

type TooltipProps = {
  active?: boolean;
  payload?: TooltipPayload[];
};
