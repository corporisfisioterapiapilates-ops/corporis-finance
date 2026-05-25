import { cn } from "@/lib/utils";

// Mapeamento DLS: grupo do plano de contas (1-8) -> cor da badge.
const GROUP_STYLES: Record<string, string> = {
  "1": "bg-success-soft text-success", // Receita Bruta
  "2": "bg-warning-soft text-warning", // Impostos
  "3": "bg-danger-soft text-danger", // Custos
  "4": "bg-danger-soft text-danger", // Despesas Operacionais
  "5": "bg-[#F0EEE9] text-ink-secondary", // Rec/Desp Financeira
  "6": "bg-beige-soft text-beige", // Não Operacional
  "7": "bg-beige-soft text-beige", // Investimento
  "8": "bg-orange-soft text-orange", // Financeiro
};

type CategoryBadgeProps = {
  /** Código do plano de contas, ex: "4.01.01". Primeiro segmento define o grupo. */
  code: string;
  name: string;
  className?: string;
};

export function CategoryBadge({ code, name, className }: CategoryBadgeProps) {
  const group = code.split(".")[0] ?? "";
  const style = GROUP_STYLES[group] ?? GROUP_STYLES["5"];
  return (
    <span
      data-slot="category-badge"
      className={cn(
        "inline-flex items-center rounded-sm px-sm py-xs font-sans text-label font-medium uppercase tracking-widest",
        style,
        className,
      )}
    >
      {name}
    </span>
  );
}
