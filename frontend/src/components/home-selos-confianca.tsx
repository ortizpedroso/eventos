const selos = [
  { label: "Pagamentos via Asaas", desc: "PIX e cartão com antifraude" },
  { label: "HTTPS em todo o site", desc: "Conexão sempre criptografada" },
  { label: "QR Code na entrada", desc: "Check-in rápido na portaria" },
] as const;

export function HomeSelosConfianca() {
  return (
    <section className="mx-auto mt-6 max-w-4xl" aria-label="Selos de confiança">
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {selos.map((s) => (
          <li
            key={s.label}
            className="rounded-xl border border-zinc-200 bg-white px-4 py-4 text-center shadow-sm"
          >
            <p className="text-sm font-semibold text-zinc-900">{s.label}</p>
            <p className="mt-1 text-xs text-zinc-600">{s.desc}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
