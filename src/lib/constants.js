export const ROLES = {
  ADMIN: "admin",
  MOTORISTA: "motorista",
  ENCARREGADO: "encarregado",
  FROTA: "admin_frota",
  DP: "dp",
  SEGURANCA: "seguranca",
  MEDICAO: "medicao",
  PERFORMANCE: "performance",
};

export const ROLE_LABELS = {
  admin: "TI / Administrador",
  motorista: "Motorista",
  encarregado: "Encarregado",
  admin_frota: "Administrador de Frota",
  dp: "Departamento Pessoal",
  seguranca: "Segurança do Trabalho",
  medicao: "Medição",
  performance: "Performance",
};

export const USER_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
};

export const VEHICLE_STATUS = {
  PRE_REGISTERED: "PRE_REGISTERED",
  PENDING_ACTIVATION: "PENDING_ACTIVATION",
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
};

export const VEHICLE_STATUS_LABEL = {
  PRE_REGISTERED: "Pré-cadastrado",
  PENDING_ACTIVATION: "Aguardando Ativação",
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
};

export const DRIVER_STATUS = {
  PENDING_APPROVAL: "PENDING_APPROVAL",
  NO_LOGIN_USER: "NO_LOGIN_USER",
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
};

export const DRIVER_STATUS_LABEL = {
  PENDING_APPROVAL: "Aguardando DP",
  NO_LOGIN_USER: "Aprovado · sem login",
  ACTIVE: "Aprovado · com login",
  INACTIVE: "Inativo",
};

// Status considerados "habilitados para operação" (filtra Checklist, Veículo titular, etc.)
export const DRIVER_STATUS_ACTIVE = [DRIVER_STATUS.ACTIVE, DRIVER_STATUS.NO_LOGIN_USER];

export const REQ_STATUS = {
  RASCUNHO: "RASCUNHO",
  PENDENTE: "PENDENTE",
  APROVADO: "APROVADO",
  REPROVADO: "REPROVADO",
  EM_ANALISE_SEGURANCA: "EM_ANALISE_SEGURANCA",
  AGUARDANDO_VISTORIA: "AGUARDANDO_VISTORIA",
  AGUARDANDO_CONTRATO_DP: "AGUARDANDO_CONTRATO_DP",
  FINALIZADO: "FINALIZADO",
};

export const REQ_STATUS_LABEL = {
  RASCUNHO: "Rascunho",
  PENDENTE: "Pendente",
  APROVADO: "Aprovado pelo DP",
  REPROVADO: "Reprovado",
  EM_ANALISE_SEGURANCA: "Em Análise (Segurança)",
  AGUARDANDO_VISTORIA: "Aguardando Vistoria",
  AGUARDANDO_CONTRATO_DP: "Aguardando Contrato (DP)",
  FINALIZADO: "Finalizado",
};

export const REQ_STATUS_COLOR = {
  RASCUNHO: "bg-[#E2E8E4]/60 text-[#4A564F] border-[#708278]/40",
  PENDENTE: "bg-[#D9A05B]/15 text-[#8B5E2B] border-[#D9A05B]/40",
  APROVADO: "bg-[#2E7D32]/15 text-[#1B5E20] border-[#2E7D32]/40",
  REPROVADO: "bg-[#C25D41]/15 text-[#8B3A26] border-[#C25D41]/40",
  EM_ANALISE_SEGURANCA: "bg-[#4A7A8C]/15 text-[#2E4F5C] border-[#4A7A8C]/40",
  AGUARDANDO_VISTORIA: "bg-[#8EA694]/20 text-[#3D4F44] border-[#8EA694]/50",
  AGUARDANDO_CONTRATO_DP: "bg-[#D9A05B]/20 text-[#8B5E2B] border-[#D9A05B]/50",
  FINALIZADO: "bg-[#1E3A5F]/15 text-[#0A1A2E] border-[#1E3A5F]/40",
};

export const REQ_TYPE = {
  VEICULO: "veiculo",
  MOTORISTA: "motorista",
  VEICULO_MOTORISTA: "veiculo_motorista",
};

export const REQ_TYPE_LABEL = {
  veiculo: "Apenas Veículo",
  motorista: "Apenas Motorista",
  veiculo_motorista: "Veículo + Motorista",
};

export const PORTE_VEICULO = [
  { id: "pesado", label: "Pesado", desc: "Caminhões, máquinas e equipamentos de grande porte." },
  { id: "leve", label: "Leve", desc: "Veículos de passeio, utilitários e camionetes." },
  { id: "moto", label: "Moto", desc: "Motocicletas (categoria separada)." },
];

// Sub-tipos aplicáveis a caminhões (Basculante / Carroceria).
export const SUB_TIPOS_CAMINHAO = [
  { id: "toco", label: "Toco" },
  { id: "truck", label: "Truck" },
  { id: "3_4", label: "3/4" },
];
export const SUB_TIPOS_LABEL = { toco: "Toco", truck: "Truck", "3_4": "3/4" };

// `medicao`: define se o equipamento usa Horímetro (escavadeira/retro) ou Quilometragem.
// `subTipos`: lista de IDs de sub-tipos aceitos (ex: caminhão basculante aceita toco e truck).
export const EQUIPAMENTO_TIPOS = [
  { id: "retroescavadeira", label: "Retroescavadeira", porte: "pesado", medicao: "horimetro" },
  { id: "escavadeira", label: "Escavadeira", porte: "pesado", medicao: "horimetro" },
  { id: "caminhao_pipa", label: "Caminhão Pipa", porte: "pesado", medicao: "km" },
  { id: "muck", label: "Muck", porte: "pesado", medicao: "km" },
  { id: "caminhao_basculante", label: "Caminhão Basculante", porte: "pesado", medicao: "km", subTipos: ["toco", "truck"] },
  { id: "caminhao_carroceria", label: "Caminhão Carroceria", porte: "pesado", medicao: "km", subTipos: ["toco", "truck", "3_4"] },
  { id: "carro", label: "Carro", porte: "leve", medicao: "km" },
  { id: "caminhonete", label: "Caminhonete", porte: "leve", medicao: "km" },
  { id: "van", label: "Van / Utilitário", porte: "leve", medicao: "km" },
  { id: "moto", label: "Moto", porte: "moto", medicao: "km" },
  { id: "outro", label: "Outro", porte: null, medicao: "ambos" },
];

// Mapeamento de legados → IDs novos (para retrocompatibilidade visual).
export const EQUIPAMENTO_TIPO_ALIASES = {
  caminhao: "caminhao_basculante",
  trator: "caminhao_carroceria",
};

// Helper: para um tipo de equipamento, retorna a configuração consolidada.
export const getEquipamentoTipo = (id) => {
  const real = EQUIPAMENTO_TIPO_ALIASES[id] || id;
  return EQUIPAMENTO_TIPOS.find((e) => e.id === real) || null;
};

export const ORIGEM_TIPOS = [
  { id: "proprio", label: "Próprio", desc: "Equipamento de propriedade da empresa (patrimônio)." },
  { id: "alugado_empresa", label: "Alugado (Locadora)", desc: "Locado de uma empresa locadora — sem motorista vinculado." },
  { id: "alugado_motorista", label: "Alugado com Motorista", desc: "Veículo terceirizado que vem junto com o próprio motorista (vínculo obrigatório)." },
];

// Origens em que o veículo é considerado "alugado" (custos e campos de aluguel exigidos).
export const ORIGENS_ALUGADAS = ["alugado_empresa", "alugado_motorista", "alugado", "prestacao"];

export const COMBUSTIVEIS = [
  "Diesel", "Gasolina", "Etanol", "Flex", "GNV",
];

export const CATEGORIAS_CNH = ["A", "B", "C", "D", "E", "AB", "AC", "AD", "AE"];

export const WIZARD_STEPS = [
  { id: 1, label: "Tipo de Requerimento", short: "Tipo" },
  { id: 2, label: "Dados Iniciais", short: "Dados" },
  { id: 3, label: "Informações Adicionais", short: "Adicionais" },
  { id: 4, label: "Documentos", short: "Documentos" },
  { id: 5, label: "Detalhes", short: "Detalhes" },
  { id: 6, label: "Revisão", short: "Revisão" },
  { id: 7, label: "Conclusão", short: "Conclusão" },
];

export const CHECKLIST_ITEM_TYPES = [
  { id: "checkbox", label: "Conforme / Não Conforme" },
  { id: "text", label: "Texto" },
  { id: "number", label: "Número" },
  { id: "photo", label: "Foto (opcional)" },
];
