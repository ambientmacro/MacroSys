/**
 * Sementes de tema por perfil (baseado no fluxograma do Rikelmy).
 *
 * O DP altera essas cores no painel /temas. Se um perfil não tiver override
 * salvo no Firestore, o sistema usa esses defaults. As cores são aplicadas
 * como CSS variables no `:root` — a UI já consome `var(--app-bg)` etc.
 */

import { ROLES } from "./constants";

/**
 * Tokens mínimos por perfil:
 *   bg         — background da página (todo o app)
 *   surface    — cards / containers (leitura estável)
 *   primary    — cor de destaque (badges, item ativo do sidebar, botões primários)
 *   primaryFg  — cor do texto sobre `primary`
 *   text       — texto principal
 *   sidebarBg  — fundo do sidebar (moldura vertical)
 *   sidebarFg  — cor do texto/ícones do sidebar
 *   font       — família da fonte principal (o header continua Outfit fixo)
 */
export const DEFAULT_THEME = {
  bg: "#F5F7FA",
  surface: "#FFFFFF",
  primary: "#1E3A5F",
  primaryFg: "#FFFFFF",
  text: "#0F1411",
  sidebarBg: "#0F2542",
  sidebarFg: "#FFFFFF",
  font: "Outfit",
};

/**
 * Seeds baseadas no fluxograma:
 *  Marrom → Frota | Rosa → DP | Lilás → Medição | Ciano → Encarregado (Campo)
 *  Amarelo → Segurança | Branco → Performance | Cinza → Admin (todos) | Motorista → default
 */
export const THEME_SEEDS = {
  [ROLES.ADMIN]:       { bg: "#EEF0F2", surface: "#FFFFFF", primary: "#4A564F", primaryFg: "#FFFFFF", text: "#0F1411", sidebarBg: "#1F262A", sidebarFg: "#F5F7FA", font: "Outfit" },
  [ROLES.FROTA]:       { bg: "#F5EDE6", surface: "#FFFFFF", primary: "#7B4B2A", primaryFg: "#FFFFFF", text: "#2E1F14", sidebarBg: "#3E2416", sidebarFg: "#F5EDE6", font: "Outfit" },
  [ROLES.DP]:          { bg: "#FDF2FA", surface: "#FFFFFF", primary: "#C74F98", primaryFg: "#FFFFFF", text: "#2E1B28", sidebarBg: "#5E1E43", sidebarFg: "#FDF2FA", font: "Outfit" },
  [ROLES.MEDICAO]:     { bg: "#F3EEFB", surface: "#FFFFFF", primary: "#7C3AED", primaryFg: "#FFFFFF", text: "#22164A", sidebarBg: "#2E1A5F", sidebarFg: "#F3EEFB", font: "Outfit" },
  [ROLES.ENCARREGADO]: { bg: "#E6F6FB", surface: "#FFFFFF", primary: "#0891B2", primaryFg: "#FFFFFF", text: "#0F2A33", sidebarBg: "#0E3A4A", sidebarFg: "#E6F6FB", font: "Outfit" },
  [ROLES.SEGURANCA]:   { bg: "#FEF9E3", surface: "#FFFFFF", primary: "#D9A05B", primaryFg: "#0F1411", text: "#2A2210", sidebarBg: "#3E2E10", sidebarFg: "#FEF9E3", font: "Outfit" },
  [ROLES.PERFORMANCE]: { bg: "#FBFAF7", surface: "#FFFFFF", primary: "#6B7280", primaryFg: "#FFFFFF", text: "#0F1411", sidebarBg: "#2A2E33", sidebarFg: "#F5F7FA", font: "Outfit" },
  [ROLES.MOTORISTA]:   DEFAULT_THEME,
};

/** Aplica um tema (objeto) ao :root do documento como CSS variables. */
export const applyTheme = (t) => {
  const theme = { ...DEFAULT_THEME, ...(t || {}) };
  const r = document.documentElement.style;
  r.setProperty("--app-bg", theme.bg);
  r.setProperty("--app-surface", theme.surface);
  r.setProperty("--app-primary", theme.primary);
  r.setProperty("--app-primary-fg", theme.primaryFg);
  r.setProperty("--app-text", theme.text);
  r.setProperty("--app-sidebar-bg", theme.sidebarBg);
  r.setProperty("--app-sidebar-fg", theme.sidebarFg);
  r.setProperty("--app-font", `"${theme.font}", sans-serif`);
};

/** Fontes disponíveis (livres, todas do Google Fonts já carregadas). */
export const AVAILABLE_FONTS = ["Outfit", "Inter", "Poppins", "Roboto", "Manrope"];
