type Props = {
  tipo?: string | null;
};

/** Aviso obrigatório de documento para lotes de meia-entrada (Lei 12.933/2013). */
export function CheckoutAvisoMeiaEntrada({ tipo }: Props) {
  if (tipo !== "meia") return null;
  return (
    <p
      className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-950"
      role="alert"
    >
      <strong>Meia-entrada exige apresentação de Documento de Identificação Estudantil (DNE/CIE) na entrada</strong>
      , conforme a Lei 12.933/2013 — boleto ou declaração de matrícula não são aceitos.
    </p>
  );
}
