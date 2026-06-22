// =============================================================================
// lib/drivers.js — Regras de negócio dos motoristas (SINGLE SOURCE OF TRUTH)
// -----------------------------------------------------------------------------
// Objetivo: concentrar toda a lógica de "quando um motorista pode operar"
// num único lugar, eliminando duplicação e protegendo contra dados legados.
//
// Regra de negócio inegociável:
//   "Não existe cadastro direto. Toda inclusão de motorista passa por
//    Requerimento → aprovação do DP. Antes de aprovado, o motorista NÃO
//    pode ser selecionado em checklist nem virar titular de veículo."
//
// Por que filtrar por status NÃO basta:
//   Documentos legados criados antes da introdução do status PENDING_APPROVAL
//   podem ter `status: NO_LOGIN_USER` desde sempre — sem nunca terem passado
//   pelo DP. Para esses casos usamos `approvedAt` como prova de aprovação.
// =============================================================================

import { DRIVER_STATUS } from "./constants";

/**
 * Retorna `true` se o motorista pode aparecer em listas operacionais
 * (checklist diário, motorista titular de veículo, etc.).
 *
 * Critério (ambos precisam ser verdadeiros):
 *   1. status ∈ { ACTIVE, NO_LOGIN_USER }
 *   2. possui `approvedAt` (foi efetivamente aprovado pelo DP)
 *
 * Documentos legados criados antes da regra entrarem em vigor podem ter
 * status válido mas NÃO ter approvedAt — esses serão tratados como pendentes
 * e devem ser regularizados pelo DP (criar requerimento ou marcar como
 * aprovado via tela de detalhe — futuro).
 *
 * @param {object} driver - documento do Firestore (com campos status, approvedAt)
 * @returns {boolean}
 */
export function isOperationalDriver(driver) {
  if (!driver) return false;
  const statusOk = driver.status === DRIVER_STATUS.ACTIVE
                || driver.status === DRIVER_STATUS.NO_LOGIN_USER;
  // approvedAt é definido pelo DP em RequerimentoDetail ou pela Segurança
  // em VistoriaEntrada (fluxo veículo+motorista). Aceita Timestamp do Firestore
  // ou valor truthy (Date / string ISO).
  const approved = !!driver.approvedAt;
  return statusOk && approved;
}

/**
 * Helper inverso. Útil para títulos de UI ("aguardando aprovação").
 *
 * Inclui: motoristas legados (sem approvedAt) E motoristas em PENDING_APPROVAL.
 */
export function isPendingDriver(driver) {
  if (!driver) return false;
  if (driver.status === DRIVER_STATUS.PENDING_APPROVAL) return true;
  // Legados: status "aprovado" mas sem timestamp de aprovação real.
  const looksApproved = driver.status === DRIVER_STATUS.ACTIVE
                     || driver.status === DRIVER_STATUS.NO_LOGIN_USER;
  return looksApproved && !driver.approvedAt;
}

/**
 * Filtra uma lista do Firestore aplicando a regra operacional acima.
 * Uso: `const motoristasParaSelect = filterOperationalDrivers(allDrivers)`
 */
export function filterOperationalDrivers(drivers) {
  return (drivers || []).filter(isOperationalDriver);
}
