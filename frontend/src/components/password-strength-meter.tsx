"use client";

/** Heurística simples de força de senha — feedback visual, não é validação de segurança. */
export function calcularForcaSenha(senha: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  if (!senha) return { score: 0, label: "" };

  let score = 0;
  if (senha.length >= 8) score += 1;
  if (senha.length >= 12) score += 1;
  if (/[A-Z]/.test(senha) && /[a-z]/.test(senha)) score += 1;
  if (/\d/.test(senha)) score += 1;
  if (/[^A-Za-z0-9]/.test(senha)) score += 1;

  const clamped = Math.min(score, 4) as 0 | 1 | 2 | 3 | 4;
  const labels = ["Muito fraca", "Fraca", "Razoável", "Boa", "Forte"];
  return { score: clamped, label: labels[clamped] };
}

const CORES = ["bg-red-500", "bg-orange-500", "bg-amber-500", "bg-emerald-500", "bg-emerald-600"];
const CORES_TEXTO = ["text-red-700", "text-orange-700", "text-amber-700", "text-emerald-700", "text-emerald-700"];

export function PasswordStrengthMeter({ senha }: { senha: string }) {
  if (!senha) return null;
  const { score, label } = calcularForcaSenha(senha);

  return (
    <div className="mt-1.5" aria-live="polite">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full ${i <= score - 1 ? CORES[score] : "bg-zinc-200"}`}
          />
        ))}
      </div>
      <p className={`mt-1 text-xs font-medium ${CORES_TEXTO[score]}`}>{label}</p>
    </div>
  );
}
