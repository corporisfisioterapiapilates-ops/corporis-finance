// Resumo tipado do plano de contas Corporis para PREVIEW no onboarding.
// Fonte de verdade do seed real: migration `seed_corporis_chart` (SQL).
// Mantenha em sincronia com a migration se o plano mudar.

export type PlanGroupPreview = {
  code: string;
  name: string;
  swatch: string; // cor do quadradinho (DLS por grupo)
  count: number; // nº de contas-folha
  nature: "income" | "expense";
  sample: { code: string; name: string }[];
};

export const CORPORIS_PLAN_PREVIEW: PlanGroupPreview[] = [
  {
    code: "1",
    name: "Receita Bruta",
    swatch: "#7A9264",
    count: 6,
    nature: "income",
    sample: [
      { code: "1.01", name: "Pilates" },
      { code: "1.02", name: "Fisioterapia" },
      { code: "1.03", name: "Fisio Pélvica" },
    ],
  },
  {
    code: "2",
    name: "Impostos sobre a Receita",
    swatch: "#B8914E",
    count: 2,
    nature: "expense",
    sample: [
      { code: "2.01", name: "Simples Nacional" },
      { code: "2.02", name: "DARF" },
    ],
  },
  {
    code: "3",
    name: "Custos",
    swatch: "#C85A3E",
    count: 3,
    nature: "expense",
    sample: [
      { code: "3.02", name: "Lavanderia" },
      { code: "3.03", name: "Materiais Fisio" },
    ],
  },
  {
    code: "4",
    name: "Despesas Operacionais",
    swatch: "#C85A3E",
    count: 41,
    nature: "expense",
    sample: [
      { code: "4.01.01", name: "Salário" },
      { code: "4.02.01", name: "Aluguel e Condomínio" },
      { code: "4.03.07", name: "Assessoria de Marketing" },
    ],
  },
  {
    code: "5",
    name: "Receita / Despesa Financeira",
    swatch: "#6B635B",
    count: 2,
    nature: "expense",
    sample: [
      { code: "5.01", name: "Receita Financeira" },
      { code: "5.02", name: "Despesa Financeira" },
    ],
  },
  {
    code: "6",
    name: "Resultado Não Operacional",
    swatch: "#D2B06E",
    count: 2,
    nature: "expense",
    sample: [
      { code: "6.01", name: "Receitas Não Operacionais" },
      { code: "6.02", name: "Despesas Não Operacionais" },
    ],
  },
  {
    code: "7",
    name: "Investimento",
    swatch: "#D2B06E",
    count: 7,
    nature: "expense",
    sample: [
      { code: "7.02", name: "Compra Máquinas e Equipamentos" },
      { code: "7.06", name: "Investimento em Software" },
    ],
  },
  {
    code: "8",
    name: "Financeiro",
    swatch: "#F08353",
    count: 4,
    nature: "expense",
    sample: [
      { code: "8.03", name: "Aporte Sócios" },
      { code: "8.04", name: "Pagamento Dividendos" },
    ],
  },
];

export const CORPORIS_PLAN_TOTAL = CORPORIS_PLAN_PREVIEW.reduce((n, g) => n + g.count, 0);
