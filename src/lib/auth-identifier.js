// =============================================================================
// lib/auth-identifier.js — Identificador de login dual (e-mail OU matrícula)
// -----------------------------------------------------------------------------
// Regra de negócio:
//   O motorista pode logar com (a) e-mail comum (Firebase Auth nativo) OU
//   (b) matrícula de 7 dígitos (sistema interno da empresa).
//
// Como o Firebase Auth só aceita e-mail/senha, mapeamos a matrícula para um
// PSEUDO-EMAIL interno, transparente para o motorista:
//
//     matrícula "1234567"  →  e-mail "m1234567@matricula.macro.local"
//
// Esse domínio fictício NUNCA é exibido na UI. O motorista digita só os 7
// dígitos no campo de login, o sistema converte por baixo dos panos.
//
// Para redefinição de senha:
//   - quem se cadastrou por e-mail real → usa o reset nativo do Firebase
//   - quem se cadastrou por matrícula  → reset interno (admin redefine na UI,
//     futuro). Por enquanto o admin/encarregado/DP que criou o login informa
//     verbalmente a senha inicial; trocar é função futura.
// =============================================================================

/** Domínio fictício usado apenas internamente para matrículas. */
export const MATRICULA_DOMAIN = "matricula.macro.local";

/** Regex: matrícula = 7+ caracteres alfanuméricos (números e/ou letras MAIÚSCULAS).
 *  Exemplos válidos: "1234567", "ABC1234", "OP12345", "MOT0001". */
const MATRICULA_RE = /^[A-Z0-9]{7,}$/;

/**
 * Verifica se a string informada é uma matrícula (7 dígitos).
 * @param {string} raw
 * @returns {boolean}
 */
export function isMatricula(raw) {
  return MATRICULA_RE.test((raw || "").trim());
}

/**
 * Converte uma matrícula em pseudo-email para o Firebase.
 * Lança erro se a string não for uma matrícula válida.
 * @param {string} raw — ex.: "1234567"
 * @returns {string}  — ex.: "m1234567@matricula.macro.local"
 */
export function matriculaToPseudoEmail(raw) {
  const m = (raw || "").trim();
  if (!isMatricula(m)) throw new Error("Matrícula inválida (esperado 7 dígitos).");
  return `m${m}@${MATRICULA_DOMAIN}`;
}

/**
 * Normaliza qualquer identificador de login (e-mail ou matrícula) em e-mail
 * aceito pelo Firebase Auth. Esta é a função usada no signIn da tela /login.
 *
 *   normalizeLoginIdentifier("yuri@macro.local") → "yuri@macro.local"
 *   normalizeLoginIdentifier("1234567")          → "m1234567@matricula.macro.local"
 *   normalizeLoginIdentifier(" ABC ")            → "abc" (sem alteração — Firebase rejeita)
 *
 * @param {string} raw
 * @returns {string}
 */
export function normalizeLoginIdentifier(raw) {
  const v = (raw || "").trim();
  // Para matrícula, normaliza para MAIÚSCULAS antes de testar o regex.
  const upper = v.toUpperCase();
  if (isMatricula(upper)) return matriculaToPseudoEmail(upper);
  return v.toLowerCase();
}

/**
 * Inverso: dada uma string que vem do `users.email` ou `users.matricula`,
 * retorna o que mostrar pro humano na UI.
 *   "m1234567@matricula.macro.local" → "Matrícula 1234567"
 *   "fulano@macro.local"             → "fulano@macro.local"
 */
export function describeIdentifier(emailOrPseudo) {
  if (!emailOrPseudo) return "";
  if (emailOrPseudo.endsWith(`@${MATRICULA_DOMAIN}`)) {
    const mat = emailOrPseudo.split("@")[0].replace(/^m/, "");
    return `Matrícula ${mat}`;
  }
  return emailOrPseudo;
}
