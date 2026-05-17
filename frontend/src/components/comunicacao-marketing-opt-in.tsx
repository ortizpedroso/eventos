"use client";

type Props = {
  email: boolean;
  whatsapp: boolean;
  onEmailChange: (v: boolean) => void;
  onWhatsappChange: (v: boolean) => void;
  /** Exibe aviso se WhatsApp marcado sem telefone (perfil). */
  telefoneInformado?: boolean;
  compact?: boolean;
};

export function ComunicacaoMarketingOptIn({
  email,
  whatsapp,
  onEmailChange,
  onWhatsappChange,
  telefoneInformado = true,
  compact = false,
}: Props) {
  return (
    <fieldset
      className={`rounded-lg border border-zinc-200 bg-zinc-50/80 ${compact ? "p-3" : "p-4"}`}
    >
      <legend className="px-1 text-sm font-semibold text-zinc-900">
        Comunicações da EventosBR (opcional)
      </legend>
      <p className="mt-1 text-xs leading-relaxed text-zinc-600">
        Novidades sobre eventos na plataforma, dicas para organizadores e ofertas. Pode alterar a
        qualquer momento no perfil. Não inclui e-mails do ingresso nem avisos do organizador do seu
        evento.
      </p>
      <div className="mt-3 space-y-2">
        <label className="flex cursor-pointer items-start gap-2 text-sm text-zinc-800">
          <input
            type="checkbox"
            checked={email}
            onChange={(e) => onEmailChange(e.target.checked)}
            className="mt-0.5 rounded border-zinc-300"
          />
          <span>
            Aceito receber comunicações por <strong>e-mail</strong>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-2 text-sm text-zinc-800">
          <input
            type="checkbox"
            checked={whatsapp}
            onChange={(e) => onWhatsappChange(e.target.checked)}
            className="mt-0.5 rounded border-zinc-300"
          />
          <span>
            Aceito receber comunicações por <strong>WhatsApp</strong>
            {!telefoneInformado ? (
              <span className="mt-0.5 block text-xs text-amber-800">
                Informe seu telefone no perfil para ativar o WhatsApp.
              </span>
            ) : null}
          </span>
        </label>
      </div>
    </fieldset>
  );
}
