/**
 * Resolução de template de checklist para um veículo.
 *
 * Regra de precedência:
 *   1. `vehicle.checklistTemplateId` (legado / override manual) — se ainda
 *      existir, mantém. Permite veículo com regras especiais.
 *   2. Template ativo cujo `vehicleTypeId == vehicle.vehicleTypeId`
 *      (catálogo Medição). Este é o caminho preferido pós-refator.
 *   3. Match por categoria + sub-tipo (`equipamento_tipo` + `subTipo`):
 *      útil para veículos legados que não foram migrados para o novo
 *      `vehicleTypeId` ainda.
 *   4. `null` (chama o usuário a configurar).
 */
export const resolveTemplateForVehicle = (vehicle, templates) => {
  if (!vehicle) return null;
  // 1. Override explícito no veículo.
  if (vehicle.checklistTemplateId) {
    const direct = templates.find((t) => t.id === vehicle.checklistTemplateId);
    if (direct) return direct;
  }
  // 2. Template vinculado ao mesmo tipo de veículo (catálogo Medição).
  if (vehicle.vehicleTypeId) {
    const byType = templates.find((t) => t.vehicleTypeId === vehicle.vehicleTypeId);
    if (byType) return byType;
  }
  // 3. Match por categoria + sub-tipo (fallback para legado).
  if (vehicle.equipamento_tipo) {
    const byCat = templates.find((t) =>
      t.categoria === vehicle.equipamento_tipo &&
      (t.subTipo || null) === (vehicle.subTipo || null)
    );
    if (byCat) return byCat;
    // Sem sub-tipo: aceita template do mesmo categoria, sem sub-tipo definido.
    const byCatLoose = templates.find((t) =>
      t.categoria === vehicle.equipamento_tipo && !t.subTipo
    );
    if (byCatLoose) return byCatLoose;
  }
  return null;
};
