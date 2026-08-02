import Link from "next/link";

const perguntas = [
  {
    q: "Preciso pagar para criar um evento?",
    a: "Você pode começar grátis. A taxa EventosBR é aplicada por ingresso vendido — veja os simuladores em Planos.",
  },
  {
    q: "Como recebo o dinheiro das vendas?",
    a: "O repasse vai para sua conta de recebimento configurada no Financeiro. PIX e cartão são processados com segurança; o extrato fica no painel.",
  },
  {
    q: "O comprador precisa criar conta?",
    a: "Não obrigatoriamente. A compra pode ser rápida com e-mail e CPF; depois o ingresso aparece em Minha conta.",
  },
  {
    q: "É seguro comprar ingresso aqui?",
    a: "Sim. Pagamentos via PIX e cartão, ingresso com QR Code único e política de reembolso dentro do prazo legal.",
  },
  {
    q: "Posso usar minha marca no evento?",
    a: "Sim. Whitelabel com logo, cores e domínio personalizado na página pública do evento.",
  },
] as const;

export function HomeFaq() {
  return (
    <section
      className="reveal mx-auto mt-20 max-w-3xl sm:mt-28"
      aria-labelledby="home-faq-titulo"
    >
      <h2 id="home-faq-titulo" className="text-center text-2xl font-bold text-zinc-900 sm:text-3xl">
        Perguntas frequentes
      </h2>
      <p className="mt-3 text-center text-sm text-zinc-600">
        Dúvidas comuns de organizadores e participantes.{" "}
        <Link href="/contato" className="font-medium text-emerald-700 underline-offset-2 hover:underline">
          Fale conosco
        </Link>{" "}
        se precisar de algo específico.
      </p>
      <dl className="mt-10 space-y-6">
        {perguntas.map((item) => (
          <div key={item.q} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <dt className="font-semibold text-zinc-900">{item.q}</dt>
            <dd className="mt-2 text-sm leading-relaxed text-zinc-600">{item.a}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
