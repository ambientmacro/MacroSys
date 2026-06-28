/**
 * Formato canônico de exibição de um veículo para o usuário final.
 *
 * Regra:
 *  - Se há TAG e PLACA distintas → "TAG (PLACA)"  (ex.: "R-1 (ABC1A23)")
 *  - Se TAG == PLACA (caso de veículo sem TAG, onde gravamos a placa em
 *    `vehicle.tag` no momento do cadastro) → mostra só a placa.
 *  - Se só há TAG → só a TAG.
 *  - Sem nada → "—".
 *
 * Usar em listagens, revisão de requerimento, checklist de entrada,
 * dashboards etc. para evitar a sensação de "veículo sem identificação".
 */
export const vehicleLabel = (v) => {
  if (!v) return "—";
  const tag = String(v.tag || "").trim();
  const placa = String(v.placa || "").trim().toUpperCase();
  if (tag && placa && tag.toUpperCase() !== placa) return `${tag} (${placa})`;
  return tag || placa || "—";
};
