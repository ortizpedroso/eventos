/**
 * Cenários de uso (não depoimentos inventados) — prova qualitativa no lançamento.
 */
const cenarios = [
  {
    titulo: "Shows e festas",
    texto:
      "Publique o evento, abra lotes e venda no mesmo dia. No dia, a portaria usa QR Code sem planilha.",
  },
  {
    titulo: "Esportes e torneios",
    texto:
      "Inscrições com PIX ou cartão, lista de participantes no painel e entrada organizada na arena.",
  },
  {
    titulo: "Quem só quer comprar",
    texto:
      "Escolhe o evento, paga em minutos e leva o QR no e-mail — sem burocracia para entrar.",
  },
] as const;

export function HomeDepoimentos() {
  return (
    <section className="mx-auto mt-20 max-w-6xl sm:mt-28" aria-labelledby="home-cenarios-titulo">
      <div className="text-center">
        <h2 id="home-cenarios-titulo" className="text-3xl font-extrabold tracking-tight text-zinc-900">
          Feito para quem organiza e quem participa
        </h2>
        <p className="mt-3 text-lg text-zinc-600">
          Do anúncio à entrada — um fluxo só, sem ferramentas espalhadas.
        </p>
      </div>

      <ul className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
        {cenarios.map((c) => (
          <li
            key={c.titulo}
            className="reveal flex h-full flex-col rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
          >
            <h3 className="font-semibold text-emerald-800">{c.titulo}</h3>
            <p className="mt-3 flex-1 text-sm leading-relaxed text-zinc-700">{c.texto}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
