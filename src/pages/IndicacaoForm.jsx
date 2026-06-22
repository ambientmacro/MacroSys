import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { EQUIPAMENTO_TIPOS, REQ_TYPE, REQ_TYPE_LABEL } from "../lib/constants";
import { notifyWhatsApp } from "../lib/whatsapp";
import { toast } from "sonner";
import { ArrowLeft, PaperPlaneTilt, ChatCircleText } from "@phosphor-icons/react";

/**
 * Formulário de "Indicação de Necessidade" — somente Encarregado.
 *
 * Diferença em relação ao Requerimento:
 *  - É um pedido informal, sem dados técnicos completos
 *  - Vai para a Frota, que decide CONVERTER em Requerimento ou descartar
 *  - Encarregado acompanha o status da indicação
 */
export default function IndicacaoForm() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    tipo: "",
    equipamento_tipo: "",
    quantidade: 1,
    centro_custo: profile.centro_custo || "",
    obra_local: "",
    prazo_desejado: "",
    justificativa: "",
    urgencia: "normal",
  });
  const [busy, setBusy] = useState(false);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!form.tipo) return toast.error("Selecione o tipo de necessidade.");
    if (form.tipo !== REQ_TYPE.MOTORISTA && !form.equipamento_tipo) return toast.error("Selecione o tipo de equipamento.");
    if (!form.justificativa.trim()) return toast.error("Descreva a justificativa.");

    setBusy(true);
    try {
      const ref = await addDoc(collection(db, "indicacoes"), {
        ...form,
        status: "ABERTA",
        createdByUserId: profile.id,
        createdByName: profile.name,
        createdByRole: profile.role,
        createdAt: serverTimestamp(),
        history: [{
          at: new Date().toISOString(),
          action: "Indicação criada pelo encarregado",
          by: profile.name,
          byRole: profile.role,
        }],
      });
      // Avisa o time de Frota.
      try {
        await notifyWhatsApp({
          recipients: ["admin_frota"],
          title: "Nova indicação de necessidade",
          message: `🔔 *MACRO AMBIENTAL — Nova Indicação*\n\n👤 Encarregado: ${profile.name}\n📋 Tipo: ${REQ_TYPE_LABEL[form.tipo] || form.tipo}\n🎯 Equipamento: ${form.equipamento_tipo || "—"}\n⏱️ Urgência: ${form.urgencia}\n\n${window.location.origin}/indicacoes/${ref.id}`,
          context: { indicacaoId: ref.id },
        });
      } catch (_) { /* notificação é best-effort */ }
      toast.success("Indicação enviada à Frota.");
      navigate("/indicacoes");
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="px-4 sm:px-8 py-8 max-w-3xl mx-auto" data-testid="page-indicacao-form">
      <button onClick={() => navigate(-1)} className="text-xs text-[#708278] hover:text-[#0F2542] uppercase tracking-[0.15em] font-bold mb-4 flex items-center gap-1">
        <ArrowLeft size={14} /> Voltar
      </button>

      <div className="bg-white border border-[#E2E8E4] rounded-md p-6 sm:p-8">
        <div className="text-[10px] uppercase tracking-[0.25em] text-[#10B981] font-bold">Encarregado</div>
        <h1 className="font-[Outfit,sans-serif] text-3xl font-black tracking-tight text-[#0F1411] mt-1 flex items-center gap-2">
          <ChatCircleText size={28} className="text-[#10B981]" weight="duotone" /> Nova Indicação
        </h1>
        <p className="text-sm text-[#4A564F] mt-2">
          Use este formulário para <strong>indicar uma necessidade</strong> ao Administrador de Frota.
          A Frota analisa e, se for o caso, converte em um <strong>Requerimento</strong> completo.
        </p>

        <div className="mt-6 space-y-5">
          <div>
            <label className="block text-[11px] uppercase tracking-[0.2em] font-bold text-[#708278] mb-2">O que você precisa? *</label>
            <div className="grid sm:grid-cols-3 gap-2">
              {[REQ_TYPE.VEICULO, REQ_TYPE.MOTORISTA, REQ_TYPE.VEICULO_MOTORISTA].map((t) => (
                <button key={t} onClick={() => set("tipo", t)} data-testid={`tipo-${t}`}
                  className={`p-3 rounded-md border-2 text-left ${form.tipo === t ? "border-[#10B981] bg-[#ECFDF5]" : "border-[#E2E8E4] hover:border-[#10B981]/40"}`}>
                  <div className="font-bold text-sm text-[#0F1411]">{REQ_TYPE_LABEL[t]}</div>
                </button>
              ))}
            </div>
          </div>

          {form.tipo && form.tipo !== REQ_TYPE.MOTORISTA && (
            <div>
              <label className="block text-[11px] uppercase tracking-[0.2em] font-bold text-[#708278] mb-2">Tipo de equipamento *</label>
              <select value={form.equipamento_tipo} onChange={(e) => set("equipamento_tipo", e.target.value)} data-testid="equipamento_tipo"
                className="w-full border border-[#E2E8E4] bg-white px-3 py-2.5 rounded-md text-sm focus:outline-none focus:border-[#10B981]">
                <option value="">Selecione</option>
                {EQUIPAMENTO_TIPOS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
          )}

          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] uppercase tracking-[0.2em] font-bold text-[#708278] mb-2">Quantidade</label>
              <input type="number" min={1} value={form.quantidade} onChange={(e) => set("quantidade", e.target.value)} data-testid="quantidade"
                className="w-full border border-[#E2E8E4] bg-white px-3 py-2.5 rounded-md text-sm focus:outline-none focus:border-[#10B981]" />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-[0.2em] font-bold text-[#708278] mb-2">Urgência</label>
              <select value={form.urgencia} onChange={(e) => set("urgencia", e.target.value)} data-testid="urgencia"
                className="w-full border border-[#E2E8E4] bg-white px-3 py-2.5 rounded-md text-sm focus:outline-none focus:border-[#10B981]">
                <option value="baixa">Baixa</option>
                <option value="normal">Normal</option>
                <option value="alta">Alta</option>
                <option value="critica">Crítica</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-[0.2em] font-bold text-[#708278] mb-2">Prazo desejado</label>
              <input type="date" value={form.prazo_desejado} onChange={(e) => set("prazo_desejado", e.target.value)} data-testid="prazo"
                className="w-full border border-[#E2E8E4] bg-white px-3 py-2.5 rounded-md text-sm focus:outline-none focus:border-[#10B981]" />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] uppercase tracking-[0.2em] font-bold text-[#708278] mb-2">Centro de custo / Obra</label>
              <input value={form.centro_custo} onChange={(e) => set("centro_custo", e.target.value)} data-testid="centro_custo"
                className="w-full border border-[#E2E8E4] bg-white px-3 py-2.5 rounded-md text-sm focus:outline-none focus:border-[#10B981]" />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-[0.2em] font-bold text-[#708278] mb-2">Local / Endereço</label>
              <input value={form.obra_local} onChange={(e) => set("obra_local", e.target.value)} data-testid="obra_local"
                className="w-full border border-[#E2E8E4] bg-white px-3 py-2.5 rounded-md text-sm focus:outline-none focus:border-[#10B981]" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-[0.2em] font-bold text-[#708278] mb-2">Justificativa *</label>
            <textarea value={form.justificativa} onChange={(e) => set("justificativa", e.target.value)} data-testid="justificativa"
              rows={4} placeholder="Explique a necessidade e o contexto da operação..."
              className="w-full border border-[#E2E8E4] bg-white px-3 py-2.5 rounded-md text-sm focus:outline-none focus:border-[#10B981]" />
          </div>

          <button onClick={submit} disabled={busy} data-testid="btn-enviar-indicacao"
            className="w-full flex items-center justify-center gap-2 bg-[#10B981] hover:bg-[#059669] text-white py-4 rounded-md text-sm font-bold uppercase tracking-[0.15em] disabled:opacity-50">
            <PaperPlaneTilt size={16} weight="bold" /> Enviar indicação à Frota
          </button>
        </div>
      </div>
    </div>
  );
}
