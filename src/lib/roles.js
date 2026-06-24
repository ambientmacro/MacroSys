import { ROLES } from "./constants";

// ────────────────────────────────────────────────────────────────────────
// Permissões por papel (FROTA cria Requerimento NÃO-CLT; DP futuramente
// CLT; Encarregado cria apenas INDICAÇÃO de necessidade).
// ────────────────────────────────────────────────────────────────────────

export const canCreateRequerimento = (role) =>
  [ROLES.FROTA, ROLES.DP, ROLES.ADMIN].includes(role);

export const canCreateIndicacao = (role) =>
  [ROLES.ENCARREGADO, ROLES.ADMIN].includes(role);

export const canConvertIndicacao = (role) =>
  [ROLES.FROTA, ROLES.ADMIN].includes(role);

export const canReviewDP = (role) =>
  [ROLES.DP, ROLES.ADMIN].includes(role);

export const canActAsSeguranca = (role) =>
  [ROLES.SEGURANCA, ROLES.ADMIN].includes(role);

export const canCreateDriver = (role) =>
  [ROLES.ENCARREGADO, ROLES.ADMIN].includes(role);

export const canManageUsers = (role) => role === ROLES.ADMIN;

export const canManageVehicleTypes = (role) =>
  [ROLES.MEDICAO, ROLES.ADMIN].includes(role);

export const canViewVehicleTypes = (role) =>
  [ROLES.MEDICAO, ROLES.PERFORMANCE, ROLES.FROTA, ROLES.DP, ROLES.ADMIN].includes(role);

export const canManageEquipes = (role) =>
  [ROLES.PERFORMANCE, ROLES.ADMIN].includes(role);

export const canManageFuncoes = (role) =>
  [ROLES.PERFORMANCE, ROLES.ADMIN].includes(role);

export const canViewChecklistsPainel = (role) =>
  [ROLES.FROTA, ROLES.ENCARREGADO, ROLES.ADMIN].includes(role);

export const canFillChecklistDigital = (role) =>
  [ROLES.MOTORISTA, ROLES.ENCARREGADO, ROLES.ADMIN].includes(role);

export const canFillChecklistManual = (role) =>
  [ROLES.ENCARREGADO, ROLES.ADMIN].includes(role);

// ────────────────────────────────────────────────────────────────────────
// Menus laterais por papel.
// ────────────────────────────────────────────────────────────────────────
export const getMenuByRole = (role) => {
  const common = [
    { path: "/", label: "Dashboard", icon: "House" },
  ];

  const items = {
    [ROLES.MOTORISTA]: [
      ...common,
      { path: "/checklist/digital", label: "Novo Checklist Diário", icon: "ClipboardText" },
      { path: "/checklists", label: "Meus Checklists", icon: "ListChecks" },
    ],
    [ROLES.ENCARREGADO]: [
      ...common,
      { path: "/indicacoes/nova", label: "Nova Indicação", icon: "PlusCircle" },
      { path: "/indicacoes", label: "Minhas Indicações", icon: "ChatCircleText" },
      { path: "/checklists/painel", label: "Painel de Checklists", icon: "ChartBar" },
      { path: "/checklist/manual", label: "Lançar Checklist (papel)", icon: "ClipboardText" },
      { path: "/checklist/digital", label: "Checklist Diário (app)", icon: "Devices" },
      { path: "/checklists", label: "Checklists", icon: "ListChecks" },
      { path: "/motoristas", label: "Motoristas", icon: "Users" },
      { path: "/users", label: "Criar Login Motorista", icon: "UserGear" },
      { path: "/veiculos", label: "Veículos", icon: "Truck" },
    ],
    [ROLES.FROTA]: [
      ...common,
      { path: "/requerimentos/novo", label: "Novo Requerimento", icon: "PlusCircle" },
      { path: "/requerimentos", label: "Requerimentos", icon: "FileText" },
      { path: "/indicacoes", label: "Indicações Recebidas", icon: "ChatCircleText" },
      { path: "/checklists/painel", label: "Painel de Checklists", icon: "ChartBar" },
      { path: "/getrak", label: "Importação GETRAK", icon: "FileXls" },
      { path: "/veiculos", label: "Veículos", icon: "Truck" },
      { path: "/frota/relatorios", label: "Relatórios Frota", icon: "ChartBar" },
      { path: "/frota/custos", label: "Custo Total da Frota", icon: "CurrencyCircleDollar" },
      { path: "/motoristas", label: "Motoristas", icon: "Users" },
      { path: "/users", label: "Criar Login Motorista", icon: "UserGear" },
      { path: "/checklists", label: "Checklists", icon: "ListChecks" },
      { path: "/tipos-veiculo", label: "Tipos de Veículo", icon: "Stack" },
    ],
    [ROLES.DP]: [
      ...common,
      { path: "/requerimentos/novo", label: "Novo Requerimento CLT", icon: "PlusCircle" },
      { path: "/requerimentos", label: "Requerimentos", icon: "FileText" },
      { path: "/users", label: "Criar Login Motorista", icon: "UserGear" },
    ],
    [ROLES.SEGURANCA]: [
      ...common,
      { path: "/requerimentos", label: "Requerimentos", icon: "FileText" },
      { path: "/vistorias", label: "Vistorias", icon: "ClipboardText" },
      { path: "/templates", label: "Templates Checklist", icon: "Stack" },
      { path: "/templates/revisao", label: "Revisão de Templates", icon: "ClockClockwise" },
      { path: "/veiculos", label: "Veículos", icon: "Truck" },
    ],
    [ROLES.MEDICAO]: [
      ...common,
      { path: "/tipos-veiculo", label: "Tipos de Veículo", icon: "Stack" },
      { path: "/veiculos", label: "Veículos", icon: "Truck" },
      { path: "/frota/custos", label: "Custo Total da Frota", icon: "CurrencyCircleDollar" },
      { path: "/frota/relatorios", label: "Acompanhamento de Custo", icon: "ChartBar" },
    ],
    [ROLES.PERFORMANCE]: [
      ...common,
      { path: "/teams", label: "Equipes", icon: "Users" },
      { path: "/funcoes", label: "Funções / Cargos", icon: "UserGear" },
      { path: "/tipos-veiculo", label: "Tipos de Veículo", icon: "Stack" },
      { path: "/frota/custos", label: "Custo Total da Frota", icon: "CurrencyCircleDollar" },
      { path: "/frota/relatorios", label: "Acompanhamento de Custo", icon: "ChartBar" },
    ],
    [ROLES.ADMIN]: [
      ...common,
      { path: "/requerimentos/novo", label: "Novo Requerimento", icon: "PlusCircle" },
      { path: "/requerimentos", label: "Requerimentos", icon: "FileText" },
      { path: "/indicacoes", label: "Indicações", icon: "ChatCircleText" },
      { path: "/checklists/painel", label: "Painel de Checklists", icon: "ChartBar" },
      { path: "/getrak", label: "Importação GETRAK", icon: "FileXls" },
      { path: "/veiculos", label: "Veículos", icon: "Truck" },
      { path: "/tipos-veiculo", label: "Tipos de Veículo", icon: "Stack" },
      { path: "/motoristas", label: "Motoristas", icon: "Users" },
      { path: "/teams", label: "Equipes", icon: "Users" },
      { path: "/funcoes", label: "Funções / Cargos", icon: "UserGear" },
      { path: "/frota/relatorios", label: "Relatórios Frota", icon: "ChartBar" },
      { path: "/templates", label: "Templates Checklist", icon: "Stack" },
      { path: "/templates/revisao", label: "Revisão de Templates", icon: "ClockClockwise" },
      { path: "/checklists", label: "Checklists", icon: "ListChecks" },
      { path: "/vistorias", label: "Vistorias", icon: "ClipboardText" },
      { path: "/users", label: "Usuários", icon: "UserGear" },
    ],
  };

  return items[role] || common;
};
