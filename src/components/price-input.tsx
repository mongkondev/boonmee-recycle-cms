"use client";

import { forwardRef } from "react";
import { cn } from "./ui";

/** Keep digits and a single decimal point (max 2 decimals). No thousands separators while typing. */
export function sanitizePriceInput(raw: string) {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const dot = cleaned.indexOf(".");
  if (dot === -1) return cleaned;
  return `${cleaned.slice(0, dot)}.${cleaned.slice(dot + 1).replace(/\./g, "").slice(0, 2)}`;
}

export const toPriceInput = (n: number) => String(n);

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: string;
  onValueChange: (value: string) => void;
};

/** Numbers-only price field: any other character typed or pasted is dropped. */
export const PriceInput = forwardRef<HTMLInputElement, Props>(function PriceInput({ value, onValueChange, className, ...props }, ref) {
  return (
    <input
      ref={ref}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={value}
      onChange={(e) => onValueChange(sanitizePriceInput(e.target.value))}
      className={cn("tabular-nums", className)}
      {...props}
    />
  );
});
