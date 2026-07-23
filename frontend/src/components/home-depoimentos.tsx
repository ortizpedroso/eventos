const depoimentos = [
  {
    nome: "Mariana Costa",
    papel: "Produtora de shows · São Paulo",
    texto:
      "Publicamos o evento em uma tarde e já estávamos vendendo no mesmo dia. O painel de vendas em tempo real facilita muito a operação.",
  },
  {
    nome: "Rafael Mendes",
    papel: "Organizador de beach tennis · Florianópolis",
    texto:
      "PIX, cartão e check-in por QR Code num só lugar. Meu público compra pelo celular e na portaria a fila anda rápido.",
  },
  {
    nome: "Ana Luíza Ferreira",
    papel: "Participante · Belo Horizonte",
    texto:
      "Comprei ingresso para uma palestra, recebi o QR no e-mail na hora e o reembolso ficou claro nas regras do evento.",
  },
] as const;

export function HomeDepoimentos() {
  return (
    <section className="mx-auto mt-20 max-w-6xl sm:mt-28" aria-labelledby="home-depoimentos-titulo" data-mobile-justify>
      <div className="text-center">
        <h2 id="home-depoimentos-titulo" className="text-3xl font-extrabold tracking-tight text-zinc-900">
          Quem usa, recomenda
        </h2>
        <p className="mt-3 text-lg text-zinc-600">
          Organizadores e participantes que buscam simplicidade na venda e na compra de ingressos.
        </p>
      </div>

      <ul className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
        {depoimentos.map((d) => (
          <li
            key={d.nome}
            className="flex h-full flex-col rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
          >
            <blockquote className="flex-1 text-sm leading-relaxed text-zinc-700">
              <span aria-hidden className="text-2xl font-serif text-emerald-600">
                “
              </span>
              {d.texto}
            </blockquote>
            <footer className="mt-5 border-t border-zinc-100 pt-4">
              <p className="font-semibold text-zinc-900">{d.nome}</p>
              <p className="text-xs text-zinc-500">{d.papel}</p>
            </footer>
          </li>
        ))}
      </ul>
    </section>
  );
}
