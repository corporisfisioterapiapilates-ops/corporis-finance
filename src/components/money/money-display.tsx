import { formatBRL, moneySign } from "@/lib/money";
import { cn } from "@/lib/utils";

type MoneyDisplayProps = {
  /** Aceita string do Postgres numeric ou number. */
  value: string | number;
  /** Mostra `+` explícito em positivos. */
  showSign?: boolean;
  /** Colore por sinal (verde positivo / vermelho negativo). Default true. */
  colored?: boolean;
  size?: "sm" | "md" | "lg" | "display";
  className?: string;
};

const SIZE_CLASS: Record<NonNullable<MoneyDisplayProps["size"]>, string> = {
  sm: "text-body-sm",
  md: "text-body",
  lg: "text-h3 font-medium",
  display: "font-display text-display-2 lowercase",
};

export function MoneyDisplay({
  value,
  showSign = false,
  colored = true,
  size = "md",
  className,
}: MoneyDisplayProps) {
  const sign = moneySign(value);
  const formatted = formatBRL(value);
  const text = showSign && sign > 0 ? `+${formatted}` : formatted;

  return (
    <span
      data-slot="money-display"
      className={cn(
        "tabular-nums font-sans",
        SIZE_CLASS[size],
        colored && sign > 0 && "text-success",
        colored && sign < 0 && "text-danger",
        colored && sign === 0 && "text-ink",
        !colored && "text-ink",
        className,
      )}
    >
      {text}
    </span>
  );
}
