"use client";

import { formatMoedaBrlInput } from "@/lib/moeda-brl";

type Props = {
  id?: string;
  value: string;
  onChange: (masked: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  "aria-describedby"?: string;
};

export function InputValorBrl({
  id,
  value,
  onChange,
  className = "",
  placeholder = "0,00",
  disabled,
  "aria-describedby": ariaDescribedby,
}: Props) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
        R$
      </span>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        disabled={disabled}
        aria-describedby={ariaDescribedby}
        className={`w-full rounded-md border border-zinc-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 disabled:cursor-not-allowed disabled:bg-zinc-100 ${className}`}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(formatMoedaBrlInput(e.target.value))}
      />
    </div>
  );
}
