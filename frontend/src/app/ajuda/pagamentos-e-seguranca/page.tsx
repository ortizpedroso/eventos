import type { Metadata } from "next";
import { AjudaArticle } from "@/components/ajuda-article";

export const metadata: Metadata = {
  title: "Pagamentos e segurança | Ajuda EventosBR",
  description:
    "Como a EventosBR trata pagamentos com a Asaas (autorizada pelo Banco Central) e o que esperar em picos de inscrição.",
};

export default function AjudaPagamentosSegurancaPage() {
  return (
    <AjudaArticle title="Pagamentos e segurança" current="/ajuda/pagamentos-e-seguranca">
      <h2>Quem processa o pagamento?</h2>
      <p>
        PIX, cartão e boleto são processados pela{" "}
        <strong>Asaas (Asaas Gestão Financeira Instituição de Pagamento S.A.)</strong>, instituição
        de pagamento <strong>autorizada pelo Banco Central do Brasil</strong>. A EventosBR
        orquestra a compra (ingresso, lote, status) e recebe da Asaas a confirmação da transação e
        os valores — <strong>não armazenamos o número completo do cartão</strong> nos nossos
        servidores.
      </p>
      <p>
        Nenhum site pode prometer segurança absoluta. Usamos HTTPS em todo o site, boas práticas de
        proteção da conta e a infraestrutura antifraude da Asaas nas cobranças. Para detalhes de
        dados pessoais, veja a <a href="/privacidade">Política de privacidade</a>.
      </p>

      <h2>O que a EventosBR guarda?</h2>
      <ul>
        <li>Dados da conta e do evento (nome, e-mail, configuração do evento, etc.).</li>
        <li>Dados necessários para emitir o ingresso (participante, status do pagamento, IDs da transação).</li>
        <li>Registros técnicos mínimos para operar e proteger o serviço (ex.: logs).</li>
      </ul>

      <h2>E se houver pico de inscrições?</h2>
      <p>
        O sistema controla o estoque de ingressos no banco de dados (reserva por lote, com tempo
        limitado para concluir o pagamento) e aplica limite de requisições no checkout para evitar
        abuso. Assim, duas pessoas não “levam” o mesmo lugar no mesmo instante.
      </p>
      <p>
        Em picos extremos a experiência pode ficar mais lenta — como em qualquer plataforma online.
        Não há fila virtual (waiting room) neste momento; seguimos melhorando a capacidade conforme o
        uso real. Se um pagamento for confirmado pela Asaas, o ingresso correspondente é atualizado
        pelo fluxo de confirmação da plataforma.
      </p>
    </AjudaArticle>
  );
}
