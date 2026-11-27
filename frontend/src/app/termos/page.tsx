import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Termos de uso | EventosBR",
  description:
    "Termos e condições de uso da plataforma EventosBR para organizadores e participantes.",
};

const linkClasse = "font-medium text-emerald-700 underline-offset-2 hover:underline";

type Secao = { titulo: string; paragrafos?: ReactNode[]; itens?: ReactNode[] };

const SECOES: Secao[] = [
  {
    titulo: "1. O que é a EventosBR",
    paragrafos: [
      "A EventosBR é uma plataforma de tecnologia que permite a organizadores criar a página do seu evento, vender ingressos e controlar a entrada. A EventosBR não organiza, não produz e não é dona dos eventos anunciados. Quem oferece o evento ao público é o organizador indicado na página do evento.",
      "Os pagamentos são processados pela Asaas, instituição de pagamento autorizada pelo Banco Central do Brasil. Em cada venda, o valor do ingresso é dividido automaticamente: a parte do organizador vai para a conta de recebimento dele, e a taxa da plataforma fica com a EventosBR.",
    ],
  },
  {
    titulo: "2. Conta e cadastro",
    itens: [
      "Para criar conta é preciso ter 18 anos ou mais, ou estar assistido pelo responsável legal.",
      "Os dados informados devem ser verdadeiros e próprios. É proibido usar nome, CPF, e-mail ou outros dados de terceiros sem autorização.",
      "Você é responsável pelo sigilo da sua senha e por toda atividade feita na sua conta.",
      "A EventosBR pode recusar cadastros, inclusive os feitos com e-mail temporário, e pedir confirmação de dados a qualquer momento.",
    ],
  },
  {
    titulo: "3. Responsabilidades do organizador",
    paragrafos: ["Ao publicar um evento, o organizador declara e garante que:"],
    itens: [
      "as informações do evento são verdadeiras e completas: data, horário, local, atrações, preços, lotes, classificação etária e regras de entrada;",
      "possui as licenças, alvarás e autorizações exigidos para o evento, e responde pelos direitos autorais e de imagem das obras e pessoas divulgadas, inclusive pelo pagamento devido ao ECAD quando aplicável;",
      "cumpre a lei da meia-entrada (Lei 12.933/2013), o Estatuto da Criança e do Adolescente, o Código de Defesa do Consumidor e as regras de acessibilidade;",
      "trata os dados pessoais dos participantes conforme a LGPD, usando-os apenas para a realização do evento e para as finalidades informadas;",
      "é responsável pelos tributos e pela emissão de nota fiscal relativos à venda dos ingressos;",
      "vincula uma conta de recebimento própria e comprova que é o titular dela.",
    ],
  },
  {
    titulo: "4. Cancelamento, adiamento e alteração de evento",
    itens: [
      "Se o evento for cancelado, adiado ou tiver alteração relevante, o organizador deve comunicar a EventosBR e os compradores imediatamente, pelos canais da plataforma.",
      "Em caso de cancelamento, o organizador deve reembolsar integralmente os compradores. Em caso de adiamento ou alteração relevante, o comprador que não puder ou não quiser comparecer pode pedir o reembolso.",
      "O organizador autoriza a EventosBR a estornar as cobranças dos ingressos afetados e se obriga a ressarcir a EventosBR por qualquer valor que ela venha a pagar a compradores, inclusive por decisão judicial ou administrativa, em razão do evento dele.",
      "A EventosBR pode informar os compradores sobre o cancelamento e as formas de reembolso, mesmo sem aviso do organizador.",
    ],
  },
  {
    titulo: "5. Compra de ingressos",
    itens: [
      "O preço total, incluindo eventuais taxas, e as regras do evento são exibidos antes da confirmação do pagamento.",
      <>
        O comprador pode cancelar a compra em Minha conta até 10 dias após a compra, desde que o ingresso não tenha
        sido usado. Depois desse prazo, valem as regras do evento e a lei. Veja{" "}
        <Link href="/ajuda/reembolsos" className={linkClasse}>
          Reembolsos
        </Link>
        .
      </>,
      "O ingresso é enviado por e-mail e fica disponível em Minha conta. Ingressos obtidos por fraude, com pagamento contestado ou revendidos em desacordo com as regras do evento podem ser cancelados.",
      "Dúvidas sobre o conteúdo e a realização do evento devem ser dirigidas ao organizador, cujo contato aparece na página do evento. A EventosBR atende pelos serviços que presta: a venda, o pagamento, a emissão do ingresso e as informações sobre o pedido.",
    ],
  },
  {
    titulo: "6. Conteúdo proibido",
    paragrafos: ["É proibido publicar na EventosBR evento, texto, imagem ou link que:"],
    itens: [
      "seja falso, enganoso ou criado para obter dinheiro ou dados de terceiros;",
      "ofenda, discrimine ou incite ódio ou violência contra pessoas ou grupos, inclusive por raça, cor, etnia, religião, origem, gênero, orientação sexual ou deficiência;",
      "faça apologia de crime ou divulgue atividade ilegal;",
      "envolva exploração ou exposição sexual de crianças ou adolescentes, ou ofereça a menores conteúdo ou consumo proibido por lei;",
      "viole direitos autorais, marcas, imagem ou privacidade de terceiros;",
      "tente burlar os controles técnicos, de pagamento ou de segurança da plataforma.",
    ],
  },
  {
    titulo: "7. Moderação, suspensão e recurso",
    itens: [
      "A EventosBR pode, a qualquer momento e sem aviso prévio, retirar da vitrine, suspender ou remover um evento, cancelar vendas ou suspender contas quando houver indício de violação destes termos ou da lei, inclusive a partir de denúncias.",
      "O organizador é avisado por e-mail sobre a suspensão e o motivo. Enquanto o evento estiver suspenso, ele não pode ser republicado nem vendido.",
      "O organizador pode contestar a decisão respondendo ao e-mail de aviso ou pelo formulário de contato. A EventosBR analisa o pedido e comunica a decisão por e-mail.",
      "A EventosBR também remove conteúdo por ordem judicial ou quando a lei exigir, e pode comunicar às autoridades indícios de crime.",
    ],
  },
  {
    titulo: "8. Vitrine e divulgação",
    paragrafos: [
      "A vitrine e as listas da EventosBR são um espaço de divulgação da plataforma. Para aparecer nelas, o evento precisa cumprir critérios definidos pela EventosBR, como imagem de capa, e-mail confirmado e conta de recebimento comprovada. Um evento que não aparece na vitrine continua acessível pelo link próprio e pela página do organizador.",
      "O organizador autoriza a EventosBR a exibir e divulgar o evento, com seus textos, imagens e marca, na plataforma, em redes sociais, e-mails e anúncios, enquanto o evento estiver publicado.",
    ],
  },
  {
    titulo: "9. Denúncias",
    paragrafos: [
      <>
        Qualquer pessoa pode denunciar um evento pelo link &quot;Denunciar este evento&quot;, na página do evento, ou
        pelo{" "}
        <Link href="/contato" className={linkClasse}>
          formulário de contato
        </Link>
        . A EventosBR analisa as denúncias e pode tomar as medidas previstas nestes termos. Denúncias feitas de
        má-fé podem levar à suspensão da conta de quem denunciou.
      </>,
    ],
  },
  {
    titulo: "10. Fraude, contestações e segurança",
    itens: [
      "A EventosBR pode recusar ou cancelar transações suspeitas, bloquear ingressos e suspender contas para proteger compradores, organizadores e a plataforma.",
      "O organizador responde pelas contestações de pagamento (chargebacks) e pelos reembolsos dos seus eventos, inclusive pelos valores já repassados à conta de recebimento dele.",
    ],
  },
  {
    titulo: "11. Indenização",
    paragrafos: [
      "O organizador se obriga a indenizar e a manter a EventosBR livre de danos, multas, condenações e despesas, inclusive honorários advocatícios, decorrentes do seu evento, do conteúdo que publicou ou do descumprimento destes termos ou da lei. A EventosBR pode exercer o direito de regresso contra o organizador por qualquer valor que tenha de pagar por esses motivos.",
    ],
  },
  {
    titulo: "12. Limites de responsabilidade",
    itens: [
      "Perante os compradores, nada nestes termos afasta os direitos garantidos pelo Código de Defesa do Consumidor.",
      "A EventosBR não garante o funcionamento ininterrupto da plataforma, mas trabalha para mantê-la disponível e segura.",
      "Nas relações com organizadores, que são relações empresariais, a responsabilidade da EventosBR por danos ligados ao uso da plataforma fica limitada ao valor das taxas que o organizador pagou à EventosBR nos 12 meses anteriores ao fato, salvo dolo ou culpa grave, e não inclui lucros cessantes ou danos indiretos.",
    ],
  },
  {
    titulo: "13. Registros de acesso e privacidade",
    paragrafos: [
      <>
        A EventosBR guarda os registros de acesso à plataforma (endereço IP, data e hora) pelo prazo previsto no art.
        15 do Marco Civil da Internet (Lei 12.965/2014), em sigilo, e só os fornece mediante ordem judicial ou nos
        casos previstos em lei. O tratamento de dados pessoais está descrito na{" "}
        <Link href="/privacidade" className={linkClasse}>
          Política de Privacidade
        </Link>
        .
      </>,
    ],
  },
  {
    titulo: "14. Propriedade intelectual",
    paragrafos: [
      "A marca, o software e os conteúdos próprios da EventosBR pertencem aos seus titulares e não podem ser copiados ou usados sem autorização. O conteúdo dos eventos continua sendo do organizador, que concede à EventosBR a licença descrita na seção 8.",
    ],
  },
  {
    titulo: "15. Alterações destes termos",
    paragrafos: [
      "A EventosBR pode alterar estes termos. Alterações relevantes são avisadas na plataforma ou por e-mail antes de entrarem em vigor. Compras já feitas seguem as regras vigentes na data da compra.",
    ],
  },
  {
    titulo: "16. Lei aplicável e foro",
    paragrafos: [
      "Estes termos são regidos pelas leis do Brasil. O comprador consumidor pode propor ação no foro do seu domicílio, como garante o Código de Defesa do Consumidor. Para as demais relações, inclusive com organizadores, fica eleito o foro da comarca da sede da empresa titular da EventosBR.",
    ],
  },
  {
    titulo: "17. Contato",
    paragrafos: [
      <>
        Dúvidas sobre estes termos? Fale com a gente pelo{" "}
        <Link href="/contato" className={linkClasse}>
          formulário de contato
        </Link>
        . Respondemos por e-mail o mais rápido possível.
      </>,
    ],
  },
];

export default function TermosPage() {
  return (
    <div className="pb-12 pt-6 sm:pb-16 sm:pt-8">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">Documento legal</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl">
          Termos de uso
        </h1>
        <p className="mt-3 text-sm text-zinc-500">Última atualização: novembro de 2026.</p>

        <div className="mt-10 space-y-6 text-sm leading-relaxed text-zinc-600">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <p className="text-justify">
              Estes termos valem para todos que usam a EventosBR: organizadores, compradores e visitantes. Ao criar
              uma conta, publicar um evento ou comprar um ingresso, você concorda com eles. Se não concordar, não use
              a plataforma.
            </p>
          </div>

          {SECOES.map((secao) => (
            <section key={secao.titulo} className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="text-lg font-semibold text-zinc-900">{secao.titulo}</h2>
              {secao.paragrafos?.map((p, i) => (
                <p key={i} className="mt-3 text-justify">
                  {p}
                </p>
              ))}
              {secao.itens ? (
                <ul className="mt-3 list-disc space-y-2 pl-5 text-justify">
                  {secao.itens.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>

        <p className="mt-12 text-center text-sm text-zinc-500">
          <Link href="/" className="text-emerald-700 underline-offset-2 hover:underline">
            ← Voltar ao início
          </Link>
        </p>
      </div>
    </div>
  );
}
