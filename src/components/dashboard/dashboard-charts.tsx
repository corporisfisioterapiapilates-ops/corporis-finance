"use client";

import type * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { BalancePoint, ExpenseGroup, MonthlyFlow } from "@/lib/dashboard/calculate";
import { formatBRL } from "@/lib/money";

type DashboardChartsProps = {
  monthlyFlow: MonthlyFlow[];
  balanceEvolution: BalancePoint[];
  expensesByGroup: ExpenseGroup[];
  periodLabel: string;
};

export function DashboardCharts({
  monthlyFlow,
  balanceEvolution,
  expensesByGroup,
  periodLabel,
}: DashboardChartsProps) {
  return (
    <div className="grid gap-md xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_340px]">
      <ChartPanel title="evolução do saldo" subtitle="últimos 6 meses">
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={balanceEvolution} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="balance-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F08353" stopOpacity={0.18} />
                <stop offset="100%" stopColor="#F08353" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#E8E5DF" vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#9A9189", fontSize: 11 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#9A9189", fontSize: 11 }}
              tickFormatter={(value) => `R$ ${Math.round(Number(value) / 1000)}k`}
              width={48}
            />
            <Tooltip content={<MoneyTooltip label="Saldo" />} />
            <Area
              type="monotone"
              dataKey="balance"
              stroke="#F08353"
              strokeWidth={2.5}
              fill="url(#balance-fill)"
              dot={{ r: 4, fill: "#F08353", strokeWidth: 0 }}
              activeDot={{ r: 6, fill: "#F08353", strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartPanel>

      <ChartPanel
        title="entradas x saídas"
        subtitle="últimos 6 meses"
        aside={
          <div className="flex items-center gap-md">
            <Legend color="#ACC095" label="Entradas" />
            <Legend color="rgba(240,131,83,0.55)" label="Saídas" />
          </div>
        }
      >
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={monthlyFlow} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#E8E5DF" vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#9A9189", fontSize: 11 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#9A9189", fontSize: 11 }}
              tickFormatter={(value) => `R$ ${Math.round(Number(value) / 1000)}k`}
              width={48}
            />
            <Tooltip content={<FlowTooltip />} />
            <Bar dataKey="income" fill="#ACC095" radius={[4, 4, 4, 4]} />
            <Bar dataKey="expense" fill="rgba(240,131,83,0.55)" radius={[4, 4, 4, 4]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartPanel>

      <ChartPanel title="despesas por grupo" subtitle={periodLabel}>
        {expensesByGroup.length > 0 ? (
          <div className="flex flex-col items-center">
            <div className="h-[150px] w-[150px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expensesByGroup}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={52}
                    outerRadius={75}
                    paddingAngle={2}
                  >
                    {expensesByGroup.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-md flex w-full flex-col gap-sm">
              {expensesByGroup.map((group) => (
                <div key={group.name} className="flex items-center justify-between gap-md">
                  <div className="flex min-w-0 items-center gap-sm">
                    <span
                      className="size-[10px] rounded-full"
                      style={{ background: group.color }}
                    />
                    <span className="truncate text-body-sm text-ink-secondary">{group.name}</span>
                  </div>
                  <span className="tnum shrink-0 text-body-sm font-medium text-ink">
                    {formatBRL(group.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex h-[220px] items-center justify-center rounded-lg bg-base text-center text-body-sm text-ink-tertiary">
            Sem despesas realizadas neste período.
          </div>
        )}
      </ChartPanel>
    </div>
  );
}

function ChartPanel({
  title,
  subtitle,
  aside,
  children,
}: {
  title: string;
  subtitle: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-line bg-surface p-lg shadow-sm-warm">
      <div className="mb-lg flex items-center justify-between gap-md">
        <div>
          <h2 className="font-display text-h3 lowercase text-ink">{title}</h2>
          <p className="mt-xs text-meta text-ink-tertiary">{subtitle}</p>
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-xs">
      <span className="size-[10px] rounded-[2px]" style={{ background: color }} />
      <span className="text-meta text-ink-tertiary">{label}</span>
    </div>
  );
}

function MoneyTooltip({ active, payload, label }: TooltipProps & { label: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md bg-ink px-sm py-xs text-meta text-surface shadow-md-warm">
      {label}: {formatBRL(Number(payload[0]?.value ?? 0))}
    </div>
  );
}

function FlowTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const income = payload.find((item) => item.dataKey === "income")?.value ?? 0;
  const expense = payload.find((item) => item.dataKey === "expense")?.value ?? 0;
  return (
    <div className="space-y-xs rounded-md bg-ink px-sm py-xs text-meta text-surface shadow-md-warm">
      <div>Entradas: {formatBRL(Number(income))}</div>
      <div>Saídas: {formatBRL(Number(expense))}</div>
    </div>
  );
}

function PieTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-md bg-ink px-sm py-xs text-meta text-surface shadow-md-warm">
      {item?.name}: {formatBRL(Number(item?.value ?? 0))}
    </div>
  );
}

type TooltipPayload = {
  name?: string;
  value?: string | number;
  dataKey?: string | number;
};

type TooltipProps = {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
};
