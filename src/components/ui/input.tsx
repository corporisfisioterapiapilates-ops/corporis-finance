import type * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "w-full rounded-lg border border-line bg-surface px-md py-[10px] text-body font-sans text-ink",
        "placeholder:text-ink-tertiary",
        "transition-colors duration-150",
        "hover:border-line-strong",
        "focus:border-orange focus:shadow-focus-orange focus:outline-none",
        "disabled:cursor-not-allowed disabled:bg-sunken",
        "aria-invalid:border-danger aria-invalid:shadow-none",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
