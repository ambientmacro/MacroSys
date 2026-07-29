import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { collection, doc, getDoc, getDocs, query, where, addDoc, updateDoc, serverTimestamp, arrayUnion } from "firebase/firestore";
import { db } from "../lib/firebase";
import { REQ_STATUS, VEHICLE_STATUS, DRIVER_STATUS } from "../lib/constants";
import { resolveTemplateForVehicle } from "../lib/checklistTemplateResolver";
import { toast } from "sonner";
import { notifyWhatsApp } from "../lib/whatsapp";
import { ShieldCheck, CheckCircle, XCircle, ArrowLeft, Camera } from "@phosphor-icons/react";

export default function VistoriaEntrada() {
  const { reqId } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [req, setReq] = useState(null);
  const [vehicle, setVehicle] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [templateId, setTemplateId] = useState("");
  const [template, setTemplate] = useState(null);
  const [answers, setAnswers] = useState({});
  const [photos, setPhotos] = useState({});
  const [obs, setObs] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (reqId) {
        const r = await getDoc(doc(db, "requerimentos", reqId));
        if (r.exists()) {
          setReq({ id: r.id, ...r.data() });
          if (r.data().vehicleId) {
            const v = await getDoc(doc(db, "vehicles", r.data().vehicleId));
            if (v.exists()) setVehicle({ id: v.id, ...v.data() });
          }
        }
      }
      // 1 template por tipo de equipamento — sem mais filtro por kind.
      const ts = await getDocs(collection(db, "checklistTemplates"));
      const all = ts.docs.map((d) => ({ id: d.id, ...d.data() }));
      setTemplates(all);
    })();
  }, [reqId]);

  // Após carregar veículo + templates, tenta resolver o template pelo tipo
  // automaticamente (mantém retrocompat com override no veículo).
  useEffect(() => {
    if (!vehicle || templates.length === 0 || templateId) return;
    const resolved = resolveTemplateForVehicle(vehicle, templates);
    if (resolved) setTemplateId(resolved.id);
  }, [vehicle, templates, templateId]);

  useEffect(() => {
    if (templateId) {
      const t = templates.find((x) => x.id === templateId);
      setTemplate(t || null);
      // Pré-marca itens configurados como "Habilitado por padrão"
      if (t) {
        const initial = {};
        (t.items || []).forEach((item) => {
          if (item.type === "checkbox" && item.defaultEnabled) initial[item.id] = true;
        });
        setAnswers(initial);
      }
    }
  }, [templateId, templates]);

  const onPhoto = (itemId) => (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => setPhotos((p) => ({ ...p, [itemId]: r.result }));
    r.readAsDataURL(file);
  };

  const submit = async (approved) => {
    if (!template) { toast.error("Selecione um template de vistoria."); return; }
    setBusy(true);
    try {
      await addDoc(collection(db, "checklists"), {
        type: "vistoria",
        templateId: template.id,
        templateName: template.name,
        vehicleId: vehicle?.id || null,
        vehicleTag: vehicle?.tag || null,
        requerimentoId: reqId,
        answers,
        photos,
        observations: obs,
        result: approved ? "APROVADO" : "REPROVADO",
        filledByUserId: profile.id,
        filledByName: profile.name,
        filledByRole: profile.role,
        createdAt: serverTimestamp(),
      });
      if (vehicle?.id) {
        await updateDoc(doc(db, "vehicles", vehicle.id), {
          // Vistoria aprovada: veículo NÃO entra em ACTIVE ainda — fica aguardando contrato do DP.
          // Vistoria reprovada: veículo vai pra INACTIVE.
          status: approved ? VEHICLE_STATUS.PENDING_ACTIVATION : VEHICLE_STATUS.INACTIVE,
          checklistTemplateId: template.id,
          vistoriaAprovadaAt: approved ? serverTimestamp() : null,
        });
      }
      if (reqId) {
        await updateDoc(doc(db, "requerimentos", reqId), {
          // Aprovado → fica pendente de Contrato/DP. Reprovado → encerra reprovado.
          status: approved ? REQ_STATUS.AGUARDANDO_CONTRATO_DP : REQ_STATUS.REPROVADO,
          history: arrayUnion({
            at: new Date().toISOString(),
            action: approved
              ? "Vistoria aprovada — aguardando arquivamento do contrato (DP)"
              : "Vistoria reprovada",
            by: profile.name,
            byRole: profile.role,
          }),
        });
      }
      // Fluxo Veículo+Motorista: quando a vistoria é aprovada, o motorista também é ativado.
      if (req?.driverId) {
        const drvSnap = await getDoc(doc(db, "drivers", req.driverId));
        const hasLogin = drvSnap.exists() && drvSnap.data().hasLogin;
        await updateDoc(doc(db, "drivers", req.driverId), {
          status: approved
            ? (hasLogin ? DRIVER_STATUS.ACTIVE : DRIVER_STATUS.NO_LOGIN_USER)
            : DRIVER_STATUS.INACTIVE,
          approvedAt: approved ? serverTimestamp() : null,
          approvedBy: approved ? profile.name : null,
        });
      }
      const recipients = ["encarregado", "admin_frota"];
      if (approved) recipients.push("dp");
      if (req?.createdByUserId) recipients.push({ userId: req.createdByUserId });
      const message = `🔔 *MACRO AMBIENTAL — Vistoria de Entrada*

🚛 Veículo: ${vehicle?.tag || "—"} (${vehicle?.marca || ""} ${vehicle?.modelo || ""})
${approved ? "✅ *VISTORIA APROVADA* — aguardando o DP arquivar o contrato físico para ativar." : "❌ *VISTORIA REPROVADA* — veículo NÃO foi ativado, retorne para ajuste."}
👤 Vistoriado por: ${profile.name}

${approved ? "DP: acesse o requerimento para anexar o contrato e finalizar o cadastro." : "Verifique os pontos não conformes no sistema."}
${window.location.origin}/requerimentos/${reqId}`;
      await notifyWhatsApp({
        recipients,
        title: approved ? "Vistoria aprovada — aguardando contrato (DP)" : "Vistoria reprovada",
        message,
        context: { vehicleId: vehicle?.id, requerimentoId: reqId },
      });
      toast.success(approved ? "Vistoria aprovada. Aguardando DP arquivar contrato." : "Vistoria reprovada.");
      navigate("/requerimentos");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] font-bold text-[#708278] hover:text-[#1E3A5F]">
        <ArrowLeft size={14} /> Voltar
      </button>
      <div className="text-xs uppercase tracking-[0.25em] text-[#708278] font-bold mt-4 flex items-center gap-2">
        <ShieldCheck size={14} /> Vistoria de Entrada
      </div>
      <h1 className="font-[Outfit,sans-serif] text-3xl font-black tracking-tight text-[#0F1411] mt-2">
        Vistoria do veículo {vehicle?.tag || "—"}
      </h1>
      <p className="text-sm text-[#4A564F] mt-2">A vistoria define o status final do veículo.</p>

      <div className="mt-8 bg-white border border-[#E2E8E4] rounded-md p-6 space-y-5">
        <div>
          <label className="text-[11px] uppercase tracking-[0.2em] font-bold text-[#708278] block mb-1.5">Template de Vistoria</label>
          <select data-testid="vistoria-template" value={templateId} onChange={(e) => setTemplateId(e.target.value)}
            className="w-full border border-[#E2E8E4] bg-white px-4 py-3 rounded-md text-sm focus:outline-none focus:border-[#1E3A5F]">
            <option value="">Selecione um template…</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          {templates.length === 0 && (
            <div className="text-xs text-[#C25D41] mt-2">Nenhum template cadastrado. Crie em "Templates Checklist".</div>
          )}
        </div>

        {template && (
          <>
            <div className="border-t border-[#E2E8E4] pt-5">
              {template.items?.map((item, idx) => (
                <ChecklistItem key={item.id || idx} item={item} value={answers[item.id]}
                  onChange={(v) => setAnswers((p) => ({ ...p, [item.id]: v }))}
                  photo={photos[item.id]} onPhoto={onPhoto(item.id)} />
              ))}
            </div>

            <div>
              <label className="text-[11px] uppercase tracking-[0.2em] font-bold text-[#708278] block mb-1.5">Observações</label>
              <textarea rows={4} value={obs} onChange={(e) => setObs(e.target.value)} data-testid="vistoria-obs"
                className="w-full border border-[#E2E8E4] bg-white px-4 py-3 rounded-md text-sm focus:outline-none focus:border-[#1E3A5F]" />
            </div>

            <div className="grid sm:grid-cols-2 gap-3 pt-4 border-t border-[#E2E8E4]">
              <button disabled={busy} onClick={() => submit(false)} data-testid="vistoria-reprovar"
                className="flex items-center justify-center gap-2 border-2 border-[#C25D41] text-[#C25D41] py-3 rounded-md text-sm font-bold uppercase tracking-[0.1em] hover:bg-[#C25D41] hover:text-white transition-all">
                <XCircle size={16} /> Reprovar
              </button>
              <button disabled={busy} onClick={() => submit(true)} data-testid="vistoria-aprovar"
                className="flex items-center justify-center gap-2 bg-[#2E7D32] text-white py-3 rounded-md text-sm font-bold uppercase tracking-[0.1em] hover:opacity-90 transition-all">
                <CheckCircle size={16} /> Aprovar e Ativar Veículo
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ChecklistItem({ item, value, onChange, photo, onPhoto }) {
  return (
    <div className="py-4 border-b border-[#E2E8E4] last:border-0">
      <div className="font-bold text-[#0F1411]">{item.label}{item.required && <span className="text-[#C25D41]"> *</span>}</div>
      {item.type === "checkbox" && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={() => onChange(true)} data-testid={`cl-${item.id}-ok`}
            className={`py-4 rounded-md font-bold text-sm uppercase tracking-[0.1em] border-2 transition-all ${value === true ? "bg-[#2E7D32] text-white border-[#2E7D32]" : "border-[#E2E8E4] text-[#0F1411] hover:border-[#2E7D32]/40"}`}>
            Conforme
          </button>
          <button onClick={() => onChange(false)} data-testid={`cl-${item.id}-nok`}
            className={`py-4 rounded-md font-bold text-sm uppercase tracking-[0.1em] border-2 transition-all ${value === false ? "bg-[#C25D41] text-white border-[#C25D41]" : "border-[#E2E8E4] text-[#0F1411] hover:border-[#C25D41]/40"}`}>
            Não Conforme
          </button>
        </div>
      )}
      {item.type === "text" && (
        <input data-testid={`cl-${item.id}-txt`} value={value || ""} onChange={(e) => onChange(e.target.value)}
          className="mt-3 w-full border border-[#E2E8E4] bg-white px-4 py-3 rounded-md text-sm focus:outline-none focus:border-[#1E3A5F]" />
      )}
      {item.type === "number" && (
        <input data-testid={`cl-${item.id}-num`} type="number" value={value ?? ""} onChange={(e) => onChange(e.target.value)}
          className="mt-3 w-full border border-[#E2E8E4] bg-white px-4 py-3 rounded-md text-sm focus:outline-none focus:border-[#1E3A5F]" />
      )}
      {(item.type === "photo" || item.allowPhoto) && (
        <label className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-[#1E3A5F] cursor-pointer">
          <Camera size={16} />
          <span>{photo ? "Foto anexada (trocar)" : "Anexar foto"}</span>
          <input type="file" accept="image/*" capture="environment" onChange={onPhoto} className="hidden" />
        </label>
      )}
      {photo && <img src={photo} alt="foto" className="mt-2 w-32 h-32 object-cover rounded-md border border-[#E2E8E4]" />}
    </div>
  );
}
