"use client";

import { onlyDigits } from "@/lib/cpf";
import { formatTelefoneBrMask } from "@/lib/telefone-br";

type Props = {
  id?: string;
  value: string;
  onChange: (digits: string) => void;
  className?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  maxDigits?: number;
};

/** Campo de telefone BR com máscara — valor interno = só dígitos. */
export function TelefoneInput({
  id,
  value,
  onChange,
  className = "input",
  placeholder = "(11) 99999-9999",
  required,
  disabled,
  maxDigits = 13,
}: Props) {
  return (
    <input
      id={id}
      type="tel"
      inputMode="numeric"
      autoComplete="tel"
      className={className}
      value={formatTelefoneBrMask(value)}
      onChange={(e) => onChange(onlyDigits(e.target.value, maxDigits))}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
    />
  );
}
