/** Textos de apoio (transparência / responsabilidade) junto à escolha Publicar vs Pausar. */
export function EventoVisibilidadeAvisosLegais() {
  return (
    <div className="mt-4 border-t border-emerald-200/80 pt-4 text-xs leading-relaxed text-zinc-700 sm:text-sm">
      <p className="font-semibold text-zinc-900">Antes de guardar, tenha em conta:</p>
      <ul className="mt-2 list-outside list-disc space-y-2 pl-4 marker:text-emerald-700">
        <li>
          <strong className="text-zinc-800">Publicar</strong> coloca o evento na vitrine pública: qualquer pessoa
          pode ver nome, datas, local, preço, imagem e descrição. Confirme que os dados estão corretos e que tem
          direito de usar textos e imagens (incluindo direitos de imagem de terceiros).
        </li>
        <li>
          <strong className="text-zinc-800">Pausar</strong> retira o evento da listagem pública e impede novas
          compras de ingresso até voltar a publicar. O link direto do evento deixa de ser utilizável para compra
          por visitantes (o organizador autenticado pode continuar a rever ou editar, conforme as regras da
          plataforma).
        </li>
        <li>
          Pagamentos e dados de cartão são tratados pelo prestador de pagamentos integrado; cancelamentos,
          reembolsos e prazos seguem as políticas indicadas na plataforma e no próprio evento.
        </li>
        <li>
          Ao submeter o formulário, declara que as informações prestadas são verdadeiras na medida do seu
          conhecimento e que cumprirá a legislação aplicável (incluindo oferta ao público e proteção de dados
          pessoais dos participantes).
        </li>
      </ul>
    </div>
  );
}
