import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Termos de Uso",
  description: "Termos e condições de uso da plataforma EventosBR.",
};

export default function TermosPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Termos de Uso</h1>
      <p className="mt-2 text-sm text-zinc-500">Última atualização: julho de 2026</p>

      <div className="prose prose-zinc mt-8 max-w-none space-y-6 text-zinc-700">
        <section>
          <h2 className="text-lg font-semibold text-zinc-900">1. Aceitação</h2>
          <p>
            Ao acessar ou utilizar a plataforma EventosBR, você concorda com estes Termos de Uso. Se não
            concordar, não utilize o serviço.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-900">2. Descrição do serviço</h2>
          <p>
            A EventosBR permite a descoberta, divulgação e venda de ingressos para eventos, bem como
            ferramentas para organizadores (criação de eventos, gestão de vendas e check-in). Funcionalidades
            específicas podem variar conforme o plano ou acordo comercial.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-900">3. Contas e responsabilidades</h2>
          <p>
            Você é responsável pela veracidade dos dados da conta e pela guarda das credenciais. Organizadores
            são responsáveis pelo conteúdo dos eventos, cumprimento de obrigações legais perante o público e
            cumprimento das regras de pagamento e repasse aplicáveis.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-900">4. Compras e pagamentos</h2>
          <p>
            Pagamentos são processados por prestadores de serviço de pagamento (por exemplo, Asaas). Prazos de
            confirmação, cancelamento e reembolso dependem do método de pagamento, das regras do evento e da
            legislação aplicável. Taxas e comissões, quando houver, são informadas no fluxo de compra ou no
            contrato com o organizador.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-900">5. Conduta</h2>
          <p>
            É proibido usar a plataforma para fins ilícitos, fraudar sistemas de pagamento, publicar conteúdo
            ofensivo ou enganoso, ou interferir na segurança ou disponibilidade do serviço.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-900">6. Propriedade intelectual</h2>
          <p>
            A marca, o software e os materiais da EventosBR são protegidos. Conteúdo publicado por
            organizadores permanece sob a respectiva titularidade, com licença necessária para operação da
            plataforma.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-900">7. Limitação de responsabilidade</h2>
          <p>
            Na medida permitida por lei, a EventosBR não se responsabiliza por danos indiretos decorrentes do
            uso da plataforma, nem pela realização efetiva do evento (que é responsabilidade do organizador),
            salvo nos casos em que a lei imponha obrigação diversa.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-900">8. Alterações</h2>
          <p>
            Podemos atualizar estes termos. A versão vigente será publicada nesta página. O uso continuado após
            a publicação constitui aceitação das alterações, quando a lei o permitir.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-900">9. Contato</h2>
          <p>
            Dúvidas sobre estes termos podem ser enviadas pelo{" "}
            <Link href="/contato" className="font-medium text-teal-800 underline-offset-2 hover:underline">
              formulário de contato
            </Link>
            .
          </p>
        </section>
      </div>

      <p className="mt-10">
        <Link href="/" className="text-sm font-medium text-teal-800 hover:underline">
          Voltar ao início
        </Link>
      </p>
    </main>
  );
}
