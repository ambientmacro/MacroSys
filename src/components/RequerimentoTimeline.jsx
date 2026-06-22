import { REQ_STATUS, REQ_STATUS_LABEL, REQ_TYPE } from "../lib/constants";
import {
  CircleDashed, PaperPlaneTilt, ShieldCheck, Files, ClipboardText,
  Buildings, CheckCircle, XCircle,
} from "@phosphor-icons/react";

/**
 * Timeline visual do fluxo do requerimento.
 *
 * Renderiza os checkpoints do ciclo de vida em ordem cronológica, com:
 *  - estado atual destacado (azul + pulse)
 *  - etapas concluídas (verde + check)
 *  - próximas etapas (cinza claro)
 *  - data/autor de cada transição, quando registrado em `req.history`
 *  - branch especial para "Apenas Motorista" (pula Segurança/Vistoria/Contrato)
 *  - banner de reprovação quando o requerimento foi reprovado
 *
 * Apenas leitura — não dispara transições. Para isso há os botões no painel
 * de ações do `RequerimentoDetail`.
 */
export default function RequerimentoTimeline({ req }) {
  if (!req) return null;
  const isMotoristaOnly = req.type === REQ_TYPE.MOTORISTA;
  const isReprovado = req.status === REQ_STATUS.REPROVADO;

  // Definição das etapas — branch curto para motorista, fluxo simplificado para veículo.
  // Fluxo de VEÍCULO (Fev/2026): Frota → Segurança → Vistoria → DP arquiva contrato → Ativo
  // (não passa mais pelo DP no início, vai direto para Segurança do Trabalho).
  const steps = isMotoristaOnly
    ? [
        { id: "rascunho", label: "Rascunho", icon: CircleDashed, matchStatus: [REQ_STATUS.RASCUNHO], matchHistory: ["Rascunho"] },
        { id: "pendente", label: "Pendente · DP", icon: PaperPlaneTilt, matchStatus: [REQ_STATUS.PENDENTE], matchHistory: ["Requerimento criado", "Rascunho enviado"] },
        { id: "finalizado", label: "Finalizado", icon: CheckCircle, matchStatus: [REQ_STATUS.FINALIZADO], matchHistory: ["DP finalizou cadastro do motorista"] },
      ]
    : [
        { id: "rascunho", label: "Rascunho", icon: CircleDashed, matchStatus: [REQ_STATUS.RASCUNHO], matchHistory: ["Rascunho"] },
        // Etapa "Segurança" captura tanto o início (EM_ANALISE_SEGURANCA) quanto fluxos legados em PENDENTE/APROVADO.
        { id: "seguranca", label: "Segurança", icon: ShieldCheck, matchStatus: [REQ_STATUS.EM_ANALISE_SEGURANCA, REQ_STATUS.PENDENTE, REQ_STATUS.APROVADO], matchHistory: ["Requerimento criado", "Encaminhado para Segurança", "DP aprovou"] },
        { id: "vistoria", label: "Vistoria", icon: ClipboardText, matchStatus: [REQ_STATUS.AGUARDANDO_VISTORIA], matchHistory: ["Segurança preparou checklist", "Vistoria aprovada"] },
        { id: "contrato", label: "Contrato · DP", icon: Buildings, matchStatus: [REQ_STATUS.AGUARDANDO_CONTRATO_DP], matchHistory: ["Vistoria aprovada — aguardando arquivamento", "DP arquivou contrato"] },
        { id: "finalizado", label: "Ativo", icon: CheckCircle, matchStatus: [REQ_STATUS.FINALIZADO], matchHistory: ["DP arquivou contrato", "DP confirmou arquivamento"] },
      ];

  // Descobre o índice da etapa atual a partir do status.
  const currentIndex = (() => {
    if (isReprovado) {
      // Reprovado: ancorar na última etapa registrada no history.
      const lastHist = (req.history || []).slice().reverse().find((h) => /aprovado|encaminhado|preparou|aprovada|arquivou/i.test(h.action));
      if (!lastHist) return 1; // assume reprovado no DP
      for (let i = steps.length - 1; i >= 0; i--) {
        if (steps[i].matchHistory.some((m) => lastHist.action.toLowerCase().includes(m.toLowerCase()))) return i;
      }
      return 1;
    }
    const idx = steps.findIndex((s) => s.matchStatus.includes(req.status));
    return idx >= 0 ? idx : 0;
  })();

  // Para cada step concluído/atual, pega a entrada de history mais recente que casa.
  const findHistoryFor = (step) => {
    const list = (req.history || []);
    for (let i = list.length - 1; i >= 0; i--) {
      const h = list[i];
      if (step.matchHistory.some((m) => h.action.toLowerCase().includes(m.toLowerCase()))) return h;
    }
    return null;
  };

  return (
    <div className="bg-white border border-[#E2E8E4] rounded-md p-5 sm:p-6">
      <div className="flex items-center justify-between gap-4 mb-5">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-[#708278] font-bold">Fluxo do Requerimento</div>
          <div className="text-base font-bold text-[#0F2542] mt-0.5 flex items-center gap-2">
            {isReprovado ? (
              <><XCircle size={18} weight="fill" className="text-[#C25D41]" /> Reprovado</>
            ) : (
              <>Etapa atual: <span className="text-[#2563EB]">{REQ_STATUS_LABEL[req.status] || req.status}</span></>
            )}
          </div>
        </div>
        <div className="text-[11px] text-[#708278] font-bold uppercase tracking-[0.15em] hidden sm:block">
          {Math.min(currentIndex + 1, steps.length)} / {steps.length}
        </div>
      </div>

      {/* DESKTOP: horizontal */}
      <ol className="hidden md:flex items-start justify-between gap-1 relative" data-testid="req-timeline-desktop">
        {steps.map((step, i) => {
          const Icon = step.icon;
          const isDone = i < currentIndex && !isReprovado;
          const isCurrent = i === currentIndex;
          const isReprovadoHere = isReprovado && i === currentIndex;
          const hist = findHistoryFor(step);
          const color = isReprovadoHere
            ? "bg-[#C25D41] text-white ring-4 ring-[#C25D41]/20"
            : isCurrent
            ? "bg-[#2563EB] text-white ring-4 ring-[#2563EB]/20 animate-pulse"
            : isDone
            ? "bg-[#10B981] text-white"
            : "bg-[#E2E8E4] text-[#708278]";
          const labelColor = isReprovadoHere
            ? "text-[#C25D41]"
            : isCurrent ? "text-[#2563EB]" : isDone ? "text-[#0F2542]" : "text-[#708278]";
          return (
            <li key={step.id} className="flex flex-col items-center flex-1 min-w-0 relative" data-testid={`tl-step-${step.id}`}>
              <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm transition-all z-10 ${color}`}>
                {isDone ? <CheckCircle size={20} weight="fill" /> : isReprovadoHere ? <XCircle size={20} weight="fill" /> : <Icon size={20} weight={isCurrent ? "fill" : "duotone"} />}
              </div>
              <div className={`mt-2 text-[11px] font-bold uppercase tracking-[0.1em] text-center px-1 ${labelColor}`}>{step.label}</div>
              {hist && (
                <div className="text-[10px] text-[#708278] mt-1 text-center" title={`${hist.by} (${hist.byRole})`}>
                  {new Date(hist.at).toLocaleDateString("pt-BR")}
                </div>
              )}
              {/* Conector */}
              {i < steps.length - 1 && (
                <div className={`absolute top-[22px] left-1/2 right-[-50%] h-0.5 -z-0 ${i < currentIndex && !isReprovado ? "bg-[#10B981]" : "bg-[#E2E8E4]"}`} style={{ width: "100%" }} />
              )}
            </li>
          );
        })}
      </ol>

      {/* MOBILE: vertical */}
      <ol className="md:hidden space-y-1" data-testid="req-timeline-mobile">
        {steps.map((step, i) => {
          const Icon = step.icon;
          const isDone = i < currentIndex && !isReprovado;
          const isCurrent = i === currentIndex;
          const isReprovadoHere = isReprovado && i === currentIndex;
          const hist = findHistoryFor(step);
          const color = isReprovadoHere
            ? "bg-[#C25D41] text-white"
            : isCurrent
            ? "bg-[#2563EB] text-white"
            : isDone
            ? "bg-[#10B981] text-white"
            : "bg-[#E2E8E4] text-[#708278]";
          const labelColor = isReprovadoHere
            ? "text-[#C25D41] font-black"
            : isCurrent ? "text-[#2563EB] font-black" : isDone ? "text-[#0F2542] font-bold" : "text-[#708278] font-semibold";
          return (
            <li key={step.id} className="flex gap-3 relative pb-3" data-testid={`tl-step-mobile-${step.id}`}>
              <div className="flex flex-col items-center">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${color}`}>
                  {isDone ? <CheckCircle size={18} weight="fill" /> : isReprovadoHere ? <XCircle size={18} weight="fill" /> : <Icon size={18} weight={isCurrent ? "fill" : "duotone"} />}
                </div>
                {i < steps.length - 1 && (
                  <div className={`w-0.5 flex-1 mt-1 ${i < currentIndex && !isReprovado ? "bg-[#10B981]" : "bg-[#E2E8E4]"}`} style={{ minHeight: "20px" }} />
                )}
              </div>
              <div className="flex-1 pt-1.5">
                <div className={`text-sm ${labelColor}`}>{step.label}</div>
                {hist && (
                  <div className="text-[11px] text-[#708278] mt-0.5">
                    {new Date(hist.at).toLocaleString("pt-BR")} · {hist.by}
                  </div>
                )}
                {isCurrent && !isReprovado && (
                  <div className="text-[11px] text-[#2563EB] font-bold mt-0.5 italic">Aguardando próxima ação</div>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {isReprovado && (
        <div className="mt-5 bg-[#C25D41]/10 border border-[#C25D41]/40 rounded-md p-3 text-xs text-[#8B3A26]">
          <strong>Requerimento reprovado.</strong> Confira o histórico abaixo para o motivo e os comentários do responsável.
        </div>
      )}
    </div>
  );
}
