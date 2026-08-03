import Link from "next/link";

const itens = [
  {
    titulo: "Compra em minutos",
    descricao: "PIX ou cartão no celular, sem cadastro completo obrigatório.",
    href: "/ajuda/como-comprar",
  },
  {
    titulo: "Reembolso claro",
    descricao: "Pedido dentro do prazo legal direto em Minha conta.",
    href: "/ajuda/reembolsos",
  },
  {
    titulo: "QR na entrada",
    descricao: "Ingresso no e-mail e check-in rápido na portaria.",
    href: "/funcionalidades",
  },
] as const;

export function HomeDiferenciais() {
  return (
    <section className="mx-auto mt-20 max-w-6xl" aria-labelledby="diferenciais-heading">
      <h2 id="diferenciais-heading" className="text-center text-2xl font-bold text-zinc-900 sm:text-3xl">
        Por que comprar no EventosBR
      </h2>
      <div className="mt-10 grid gap-6 sm:grid-cols-3">
        {itens.map((item) => (
          <Link
            key={item.titulo}
            href={item.href}
            className="reveal rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:border-emerald-300 hover:shadow-md"
          >
            <h3 className="font-semibold text-emerald-700">{item.titulo}</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">{item.descricao}</p>
            <span className="mt-3 inline-block text-sm font-medium text-emerald-700">Saiba mais →</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
