/**
 * Revisão de templates de checklist — a cada 6 meses.
 *
 * Regras (acordadas em reunião):
 *   - Janela total: 180 dias (6 meses) entre revisões.
 *   - Alerta de "atenção" começa quando faltam 30 dias (≥ 150 dias da última revisão).
 *   - Vencido: > 180 dias.
 *
 * `lastReviewedAt` é gravado quando o Segurança clica em "Marcar como revisado".
 * Para templates legados que não têm o campo, usamos `createdAt` como referência.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
export const REVISION_WINDOW_DAYS = 180;
export const REVISION_WARNING_DAYS = 150;

/** Converte timestamp Firestore | string | Date em ms (ou null). */
const toMs = (t) => {
  if (!t) return null;
  if (typeof t === "number") return t;
  if (t.seconds) return t.seconds * 1000;
  if (typeof t === "string") return Date.parse(t);
  if (t instanceof Date) return t.getTime();
  return null;
};

/** Calcula o status de revisão de um template. */
export const getTemplateRevisionStatus = (template) => {
  const last = toMs(template.lastReviewedAt) || toMs(template.createdAt) || Date.now();
  const ageDays = Math.floor((Date.now() - last) / DAY_MS);
  const remainingDays = REVISION_WINDOW_DAYS - ageDays;
  let status;
  if (ageDays > REVISION_WINDOW_DAYS) status = "vencido";
  else if (ageDays >= REVISION_WARNING_DAYS) status = "atencao";
  else status = "ok";
  return {
    status,
    ageDays,
    remainingDays,
    lastReviewedAt: last,
    nextDueAt: last + REVISION_WINDOW_DAYS * DAY_MS,
  };
};
