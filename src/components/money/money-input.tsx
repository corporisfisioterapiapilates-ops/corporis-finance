"use client";

import type * as React from "react";
import { useEffect, useState } from "react";

import { formatBRL, parseBRL } from "@/lib/money";
import { cn } from "@/lib/utils";

type MoneyInputProps = {
  /** Valor canônico string ("1234.56"). */
  value: string;
  /** Recebe o valor canônico já normalizado. */
  onValueChange: (canonical: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
} & Omit<React.ComponentProps<"input">, "onChange" | "value" | "className" | "placeholder">;

// Input mascarado BRL. Digitação livre; normaliza no blur via parseBRL.
export function MoneyInput({
  value,
  onValueChange,
  placeholder = "R$ 0,00",
  disabled,
  className,
  id,
  name,
  ...props
}: MoneyInputProps) {
  const [draft, setDraft] = useState(() => (value ? formatBRL(value) : ""));

  // Sincroniza quando o valor externo muda (ex: reset de form).
  useEffect(() => {
    setDraft(value ? formatBRL(value) : "");
  }, [value]);

  return (
    <input
      id={id}
      name={name}
      {...props}
      inputMode="decimal"
      data-slot="money-input"
      disabled={disabled}
      placeholder={placeholder}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const canonical = parseBRL(draft);
        onValueChange(canonical);
        setDraft(draft ? formatBRL(canonical) : "");
      }}
      className={cn(
        "w-full rounded-lg border border-line bg-surface px-md py-[10px] text-body font-sans tabular-nums text-ink",
        "placeholder:text-ink-tertiary",
        "transition-colors duration-150",
        "hover:border-line-strong",
        "focus:border-orange focus:shadow-focus-orange focus:outline-none",
        "disabled:cursor-not-allowed disabled:bg-sunken",
        className,
      )}
    />
  );
}
