type Step = { n: number; label: string };

const STEPS: Step[] = [
  { n: 1, label: "Dados" },
  { n: 2, label: "Pagamento" },
  { n: 3, label: "Confirmação" },
];

export function CheckoutStepper({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className="mb-5 flex items-center gap-1 text-xs sm:gap-2 sm:text-sm" aria-label="Etapas da compra">
      {STEPS.map((s, i) => {
        const done = current > s.n;
        const active = current === s.n;
        return (
          <li key={s.n} className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                active
                  ? "bg-emerald-700 text-white"
                  : done
                    ? "bg-emerald-100 text-emerald-900"
                    : "bg-zinc-200 text-zinc-600"
              }`}
              aria-current={active ? "step" : undefined}
            >
              {done ? "✓" : s.n}
            </span>
            <span
              className={`truncate font-medium ${active ? "text-emerald-900" : done ? "text-zinc-700" : "text-zinc-500"}`}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 ? (
              <span className="mx-0.5 hidden h-px flex-1 bg-zinc-200 sm:block" aria-hidden />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
