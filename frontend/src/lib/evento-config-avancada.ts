/** Parse checkboxes ausentes = false quando o campo não está no form. */

export function parseCheckbox(formData: FormData, name: string, defaultValue = false): boolean {
  if (!formData.has(name)) return defaultValue;
  const v = formData.get(name);
  return v === "true" || v === "on";
}

export function parseEventoConfigFromForm(formData: FormData) {
  const parcelamento_max = Number.parseInt(String(formData.get("parcelamento_max") ?? "2"), 10);
  const lista_espera_prazo_horas = Number.parseInt(
    String(formData.get("lista_espera_prazo_horas") ?? "24"),
    10,
  );
  return {
    urgencia_modo: String(formData.get("urgencia_modo") ?? "desligado"),
    parcelamento_habilitado: parseCheckbox(formData, "parcelamento_habilitado"),
    parcelamento_max: [2, 3, 6, 12].includes(parcelamento_max) ? parcelamento_max : 2,
    aceita_interesse: parseCheckbox(formData, "aceita_interesse", false),
    lista_espera_habilitada: parseCheckbox(formData, "lista_espera_habilitada"),
    lista_espera_prazo_horas: [12, 24, 48].includes(lista_espera_prazo_horas)
      ? lista_espera_prazo_horas
      : 24,
  };
}
