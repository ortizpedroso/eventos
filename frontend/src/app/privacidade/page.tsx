import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de privacidade | EventosBR",
  description:
    "Como a EventosBR trata dados pessoais, cookies e integrações (ex.: provedores de pagamento), em linha com boas práticas e a LGPD.",
};

export default function PrivacidadePage() {
  return (
    <div className="pb-12 pt-6 sm:pb-16 sm:pt-8">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">Documento legal</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl">
          Política de privacidade
        </h1>
        <p className="mt-3 text-sm text-zinc-500">Última atualização: maio de 2026.</p>

        <div className="mt-10 space-y-6 text-sm leading-relaxed text-zinc-600">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <p className="text-justify">
              Esta política descreve que dados recolhemos, para quê os utilizamos e quais são os seus direitos,
              nos termos da Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD), sem prejuízo de
              ajustes futuros para refletir o encarregado de dados e canais oficiais da empresa em produção.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-lg font-semibold text-zinc-900">1. Quem é responsável</h2>
            <p className="mt-3 text-justify">
              O responsável pelo tratamento dos dados pessoais tratados através deste site e da respetiva API é
              a entidade que opera a marca EventosBR (doravante &quot;nós&quot; ou &quot;plataforma&quot;). Para
              exercer direitos ou dúvidas, utilize o contacto indicado na página{" "}
              <Link href="/sobre" className="font-medium text-emerald-800 underline-offset-2 hover:underline">
                Sobre
              </Link>{" "}
              ou o e-mail público de suporte, quando disponível.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-lg font-semibold text-zinc-900">2. Que dados tratamos</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-justify">
              <li>
                <strong className="text-zinc-800">Conta e autenticação:</strong> nome, e-mail, tipo de
                utilizador (ex.: organizador), identificadores técnicos e registo de sessão quando aplicável.
              </li>
              <li>
                <strong className="text-zinc-800">Eventos:</strong> dados que o organizador insere (nome do
                evento, descrição, datas, local, preço, imagens, mensagens).
              </li>
              <li>
                <strong className="text-zinc-800">Compras e participantes:</strong> dados necessários para
                emitir o ingresso e cumprir obrigações legais (ex.: nome, e-mail, CPF ou telefone quando
                solicitados no fluxo de compra).
              </li>
              <li>
                <strong className="text-zinc-800">Pagamento:</strong> dados de cartão e transação são
                tratados por <strong className="text-zinc-800">gateways de pagamento parceiros e certificados</strong>. 
                A plataforma recebe atualizações de status da transação e valores, mas jamais armazena 
                o número completo do seu cartão nos próprios servidores.
              </li>
              <li>
                <strong className="text-zinc-800">Registos técnicos:</strong> endereço IP, tipo de navegador e
                logs de segurança, na medida necessária para operar e proteger o serviço.
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-lg font-semibold text-zinc-900">3. Finalidades e bases legais (LGPD)</h2>
            <p className="mt-3 text-justify">
              Tratamos dados para executar o contrato ou procedimentos precontratuais (criar conta, publicar
              evento, processar compra), para cumprir obrigações legais, para fins legítimos (segurança,
              prevenção de fraude, melhoria do serviço) e, quando exigido, com base no consentimento (ex.:
              comunicações opcionais).
            </p>
            <p className="mt-3 text-justify">
              <strong className="text-zinc-800">Comunicações de marketing da EventosBR</strong> (novidades,
              eventos na plataforma, dicas) só são enviadas por e-mail ou WhatsApp se você marcar a opção no
              cadastro ou no perfil. Pode revogar a qualquer momento. Isso é independente dos e-mails
              transacionais (ingresso, confirmação) e dos avisos que o organizador envia aos participantes do
              próprio evento.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-lg font-semibold text-zinc-900">4. Partilha com terceiros</h2>
            <p className="mt-3 text-justify">
              Partilhamos dados com prestadores estritamente necessários à operação do serviço, em especial o
              processador e gateway de pagamentos escolhido e a infraestrutura (alojamento, base de dados, e-mail), 
              sempre com rigorosas salvaguardas contratuais.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-lg font-semibold text-zinc-900">5. Retenção</h2>
            <p className="mt-3 text-justify">
              Conservamos os dados pelo tempo necessário para prestar o serviço, cumprir obrigações legais
              (ex.: fiscais) e resolver litígios. Depois, eliminamos ou anonimizamos, salvo base legal para
              conservação mais prolongada.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-lg font-semibold text-zinc-900">6. Cookies e tecnologias similares</h2>
            <p className="mt-3 text-justify">
              O site pode utilizar cookies ou armazenamento local para sessão, preferências e segurança.
              Cookies estritamente necessários não dependem de consentimento; outros, se forem introduzidos,
              serão geridos conforme a legislação aplicável.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-lg font-semibold text-zinc-900">7. Os seus direitos</h2>
            <p className="mt-3 text-justify">
              Nos termos da LGPD, pode solicitar confirmação de tratamento, acesso, correção, anonimização,
              eliminação, portabilidade, informação sobre partilhas e revogação de consentimento, quando
              aplicável. Também pode apresentar reclamação à Autoridade Nacional de Proteção de Dados (ANPD).
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8" id="denunciar">
            <h2 className="text-lg font-semibold text-zinc-900">8. Denúncias e conteúdo abusivo</h2>
            <p className="mt-3 text-justify">
              Se detetar evento fraudulento, conteúdo ilegal, usurpação de identidade ou outro comportamento
              suspeito, contacte-nos com o máximo de detalhe (URL do evento, capturas de ecrã, datas).
              Analisaremos com diligência razoável. Pode configurar{" "}
              <code className="rounded bg-zinc-100 px-1 text-xs">NEXT_PUBLIC_EMAIL_DENUNCIAS</code> no ambiente
              do site para que o link &quot;Denunciar&quot; na área de compra abra o cliente de e-mail com o
              endereço correto.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-lg font-semibold text-zinc-900">9. Segurança</h2>
            <p className="mt-3 text-justify">
              Aplicamos medidas técnicas e organizativas adequadas ao risco, incluindo ligações encriptadas
              (HTTPS) e princípio do mínimo acesso interno. Nenhum sistema é infalível; recomendamos boas
              práticas de palavra-passe e dispositivos atualizados.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-lg font-semibold text-zinc-900">10. Alterações a esta política</h2>
            <p className="mt-3 text-justify">
              Podemos atualizar esta política para refletir mudanças legais ou do produto. A data no topo
              indica a última revisão relevante.
            </p>
          </div>
        </div>

        <p className="mt-12 text-center text-sm text-zinc-500">
          <Link href="/" className="text-emerald-800 underline-offset-2 hover:underline">
            ← Voltar ao início
          </Link>
        </p>
      </div>
    </div>
  );
}
