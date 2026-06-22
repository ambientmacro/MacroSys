import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, doc, onSnapshot, updateDoc, serverTimestamp, arrayUnion, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { ROLES, REQ_TYPE_LABEL, EQUIPAMENTO_TIPOS } from "../lib/constants";
import { canCreateIndicacao, canConvertIndicacao } from "../lib/roles";
import { toast } from "sonner";
import { ChatCircleText, PlusCircle, ArrowRight, CheckCircle, XCircle, Hourglass, Trash } from "@phosphor-icons/react";

const STATUS_COLOR = {
  ABERTA: "bg-[#D9A05B]/15 text-[#8B5E2B] border-[#D9A05B]/40",
  CONVERTIDA: "bg-[#2E7D32]/15 text-[#1B5E20] border-[#2E7D32]/40",
  DESCARTADA: "bg-[#C25D41]/15 text-[#8B3A26] border-[#C25D41]/40",
};
const STATUS_LABEL = {
  ABERTA: "Aberta — aguardando Frota",
  CONVERTIDA: "Convertida em requerimento",
  DESCARTADA: "Descartada",
};
const STATUS_ICON = { ABERTA: Hourglass, CONVERTIDA: CheckCircle, DESCARTADA: XCircle };

export default function IndicacoesList() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("ABERTA");
  const isEncarregado = profile.role === ROLES.ENCARREGADO;
  const isFrota = profile.role === ROLES.FROTA || profile.role === ROLES.ADMIN;

  useEffect(() => {
    // Encarregado vê só as próprias; Frota/Admin vê todas.
    const ref = isEncarregado
      ? query(collection(db, "indicacoes"), where("createdByUserId", "==", profile.id))
      : collection(db, "indicacoes");
    const unsub = onSnapshot(ref, (snap) => {
      const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      arr.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setItems(arr);
    });
    return () => unsub();
  }, [profile.id, isEncarregado]);

  const filtered = filter === "TODAS" ? items : items.filter((i) => i.status === filter);

  const convertToRequerimento = async (ind) => {
    if (!canConvertIndicacao(profile.role)) return;
    // Marca a indicação como convertida e navega para o wizard com pré-preenchimento.
    try {
      await updateDoc(doc(db, "indicacoes", ind.id), {
        status: "CONVERTIDA",
        convertedAt: serverTimestamp(),
        convertedBy: profile.name,
        history: arrayUnion({
          at: new Date().toISOString(),
          action: "Frota converteu em requerimento",
          by: profile.name,
          byRole: profile.role,
        }),
      });
      toast.success("Indicação convertida — preencha o requerimento.");
      navigate(`/requerimentos/novo?fromIndicacao=${ind.id}`);
    } catch (e) { toast.error(e.message); }
  };

  const discard = async (ind) => {
    if (!canConvertIndicacao(profile.role)) return;
    const motivo = window.prompt("Motivo do descarte (opcional):") || "";
    try {
      await updateDoc(doc(db, "indicacoes", ind.id), {
        status: "DESCARTADA",
        discardedAt: serverTimestamp(),
        discardedBy: profile.name,
        discardReason: motivo,
        history: arrayUnion({
          at: new Date().toISOString(),
          action: `Indicação descartada${motivo ? `: ${motivo}` : ""}`,
          by: profile.name,
          byRole: profile.role,
        }),
      });
      toast.info("Indicação descartada.");
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="px-4 sm:px-8 py-8 max-w-6xl mx-auto" data-testid="page-indicacoes">
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-[#708278] font-bold">{isEncarregado ? "Encarregado" : "Frota"}</div>
          <h1 className="font-[Outfit,sans-serif] text-3xl font-black tracking-tight text-[#0F1411] mt-1 flex items-center gap-2">
            <ChatCircleText size={28} className="text-[#10B981]" weight="duotone" />
            {isEncarregado ? "Minhas Indicações" : "Indicações Recebidas"}
          </h1>
        </div>
        {canCreateIndicacao(profile.role) && (
          <button onClick={() => navigate("/indicacoes/nova")} data-testid="btn-nova-indicacao"
            className="flex items-center gap-2 bg-[#10B981] hover:bg-[#059669] text-white px-5 py-3 rounded-md text-xs font-bold uppercase tracking-[0.15em]">
            <PlusCircle size={16} weight="bold" /> Nova Indicação
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {["ABERTA", "CONVERTIDA", "DESCARTADA", "TODAS"].map((s) => {
          const count = s === "TODAS" ? items.length : items.filter((i) => i.status === s).length;
          return (
            <button key={s} onClick={() => setFilter(s)} data-testid={`filter-${s}`}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-[0.1em] ${filter === s ? "bg-[#1E3A5F] text-white" : "bg-[#E2E8E4] text-[#4A564F]"}`}>
              {s === "TODAS" ? "Todas" : STATUS_LABEL[s]} ({count})
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-dashed border-[#E2E8E4] rounded-md p-10 text-center">
          <ChatCircleText size={40} className="mx-auto text-[#708278]" weight="duotone" />
          <div className="text-sm text-[#4A564F] mt-3">Nenhuma indicação{filter !== "TODAS" ? " neste status" : ""}.</div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((ind) => {
            const Icon = STATUS_ICON[ind.status] || Hourglass;
            const eq = EQUIPAMENTO_TIPOS.find((e) => e.id === ind.equipamento_tipo);
            return (
              <div key={ind.id} className="bg-white border border-[#E2E8E4] rounded-md p-4 sm:p-5" data-testid={`indicacao-${ind.id}`}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] uppercase tracking-[0.15em] font-bold ${STATUS_COLOR[ind.status] || ""}`}>
                        <Icon size={11} weight="bold" /> {STATUS_LABEL[ind.status] || ind.status}
                      </span>
                      {ind.urgencia && (
                        <span className="text-[10px] uppercase tracking-[0.15em] font-bold text-[#C25D41]">
                          {ind.urgencia === "critica" ? "🔴" : ind.urgencia === "alta" ? "🟠" : ""}{ind.urgencia}
                        </span>
                      )}
                    </div>
                    <div className="font-[Outfit,sans-serif] text-lg font-bold text-[#0F1411] mt-2">
                      {REQ_TYPE_LABEL[ind.tipo]} {eq && `· ${eq.label}`} {ind.quantidade > 1 && `(${ind.quantidade}x)`}
                    </div>
                    <div className="text-xs text-[#4A564F] mt-1">
                      Solicitado por <strong>{ind.createdByName}</strong>
                      {ind.centro_custo && ` · CC ${ind.centro_custo}`}
                      {ind.obra_local && ` · ${ind.obra_local}`}
                    </div>
                    {ind.justificativa && (
                      <div className="mt-3 bg-[#F5F7FA] border-l-2 border-[#10B981] pl-3 py-2 text-sm text-[#0F1411] italic">
                        "{ind.justificativa}"
                      </div>
                    )}
                  </div>
                  {ind.status === "ABERTA" && isFrota && (
                    <div className="flex flex-col gap-2 shrink-0">
                      <button onClick={() => convertToRequerimento(ind)} data-testid={`btn-converter-${ind.id}`}
                        className="flex items-center justify-center gap-1 bg-[#1E3A5F] hover:bg-[#2A4A78] text-white px-4 py-2 rounded-md text-[10px] font-bold uppercase tracking-[0.15em]">
                        <ArrowRight size={12} /> Converter em Requerimento
                      </button>
                      <button onClick={() => discard(ind)} data-testid={`btn-descartar-${ind.id}`}
                        className="flex items-center justify-center gap-1 border border-[#C25D41] text-[#C25D41] hover:bg-[#C25D41] hover:text-white px-4 py-2 rounded-md text-[10px] font-bold uppercase tracking-[0.15em]">
                        <Trash size={12} /> Descartar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
