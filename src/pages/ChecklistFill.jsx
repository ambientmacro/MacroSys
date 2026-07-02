import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs, addDoc, query, where, serverTimestamp, limit } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { VEHICLE_STATUS, DRIVER_STATUS_ACTIVE, ROLES } from "../lib/constants";
import { filterOperationalDrivers } from "../lib/drivers";
import { resolveTemplateForVehicle } from "../lib/checklistTemplateResolver";
import { notifyWhatsApp } from "../lib/whatsapp";
import { toast } from "sonner";
import { vehicleLabel } from "../lib/vehicleLabel";
import { Camera, Printer, Truck, User, ClipboardText, Devices, CheckCircle, ShieldCheck } from "@phosphor-icons/react";

// =============================================================================
// ChecklistFill — preenchimento do checklist diário
// -----------------------------------------------------------------------------
// Suporta duas modalidades (mesmo checklist, fontes diferentes):
//   • mode = "digital" → motorista preenche pelo app (UI super simplificada)
//   • mode = "manual"  → encarregado lança o papel respondido pelo motorista
//
// Auto-seleções para o MOTORISTA (mode digital):
//   1. Veículo: busca em `vehicles` onde motoristaTitularId === profile.id.
//      Se houver exatamente 1, já seleciona e oculta o select.
//   2. Template: se o veículo tem `checklistTemplateId` (vinculado pela Frota),
//      seleciona auto e oculta o select.
//
// Quando nada estiver pré-configurado, cai no fallback (selects manuais).
// =============================================================================

export default function ChecklistFill({ mode = "digital" }) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [driverId, setDriverId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [answers, setAnswers] = useState({});
  const [photos, setPhotos] = useState({});
  const [obs, setObs] = useState("");
  const [busy, setBusy] = useState(false);
  const [savedChecklist, setSavedChecklist] = useState(null);

  useEffect(() => {
    (async () => {
      // Templates: 1 por tipo de equipamento (sem mais filtro por kind).
      const [d, v, t] = await Promise.all([
        getDocs(query(collection(db, "drivers"), where("status", "in", DRIVER_STATUS_ACTIVE))),
        getDocs(query(collection(db, "vehicles"), where("status", "==", VEHICLE_STATUS.ACTIVE))),
        getDocs(collection(db, "checklistTemplates")),
      ]);
      const rawDrivers = d.docs.map((x) => ({ id: x.id, ...x.data() }));
      setDrivers(filterOperationalDrivers(rawDrivers));
      setVehicles(v.docs.map((x) => ({ id: x.id, ...x.data() })));
      setTemplates(t.docs.map((x) => ({ id: x.id, ...x.data() })));
    })();
  }, []);

  // ===========================================================================
  // Detecção da PRIMEIRA EXECUÇÃO ("Vistoria de Entrada")
  // ---------------------------------------------------------------------------
  // Regra de negócio: a 1ª execução de checklist de um veículo é a "Vistoria
  // de Entrada" — só o Adm de Frota (ou Admin) pode lançá-la. Demais
  // execuções (Diário) ficam liberadas para motorista/encarregado.
  // ===========================================================================
  const [isFirstExecution, setIsFirstExecution] = useState(false);

  useEffect(() => {
    if (!vehicleId) { setIsFirstExecution(false); return; }
    (async () => {
      const q = query(
        collection(db, "checklists"),
        where("vehicleId", "==", vehicleId),
        limit(1),
      );
      const snap = await getDocs(q);
      setIsFirstExecution(snap.empty);
    })();
  }, [vehicleId]);

  // Quem pode fazer a 1ª execução: apenas Frota e Admin.
  const canDoFirstExecution = profile.role === ROLES.FROTA || profile.role === ROLES.ADMIN;
  const blockedByFirstExecution = isFirstExecution && !canDoFirstExecution;

  // Veículos do motorista logado (motorista titular). Suporta tanto a forma
  // nova `motoristasTitularesIds: [...]` quanto a legada `motoristaTitularId`.
  // No modo "manual" (encarregado) usamos a lista completa.
  const myVehicles = useMemo(() => {
    if (mode !== "digital") return [];
    return vehicles.filter((v) => {
      const list = Array.isArray(v.motoristasTitularesIds) ? v.motoristasTitularesIds : [];
      return list.includes(profile.id) || v.motoristaTitularId === profile.id;
    });
  }, [vehicles, profile.id, mode]);

  // Auto-seleção do veículo do motorista APENAS quando houver exatamente 1
  // vínculo. Com múltiplos titulares, o motorista escolhe no select.
  useEffect(() => {
    if (mode !== "digital") return;
    if (vehicleId) return;
    if (myVehicles.length === 1) setVehicleId(myVehicles[0].id);
  }, [myVehicles, mode, vehicleId]);

  // Encarregado: ao selecionar motorista, sugere o veículo padrão (se houver).
  useEffect(() => {
    if (mode === "manual" && driverId) {
      const drv = drivers.find((d) => d.id === driverId);
      if (drv?.defaultVehicleId) setVehicleId(drv.defaultVehicleId);
    }
  }, [driverId, drivers, mode]);

  // Auto-seleção do template via veículo (Frota configurou um template padrão).
  // Também desfaz o auto-selecionado se o usuário voltar para "Selecione" no veículo.
  useEffect(() => {
    if (!vehicleId) {
      // Veículo foi resetado → limpa template, respostas e fotos para evitar
      // resíduo de uma seleção anterior (bug reportado pelo usuário).
      setTemplateId("");
      setAnswers({});
      setPhotos({});
      setObs("");
      return;
    }
    // Veículo mudou: aplica o template via resolver (override → vehicleType → categoria).
    const veh = vehicles.find((v) => v.id === vehicleId);
    const resolved = resolveTemplateForVehicle(veh, templates);
    if (resolved) {
      setTemplateId(resolved.id);
    } else {
      // Veículo sem template configurado → o user escolhe manualmente.
      setTemplateId("");
    }
  }, [vehicleId, vehicles, templates]);

  // Quando o template muda (inclusive para vazio), recalcula respostas:
  //   - templateId vazio → answers vazio
  //   - templateId preenchido → answers iniciais do template
  useEffect(() => {
    if (!templateId) { setAnswers({}); setPhotos({}); return; }
    const t = templates.find((x) => x.id === templateId);
    if (!t) return;
    const initial = {};
    (t.items || []).forEach((item) => {
      if (item.type === "checkbox" && item.defaultEnabled) initial[item.id] = true;
    });
    setAnswers(initial);
    setPhotos({});
  }, [templateId, templates]);

  const template = templates.find((t) => t.id === templateId);
  const vehicle = vehicles.find((v) => v.id === vehicleId);
  const driver = drivers.find((d) => d.id === driverId);

  // Visibilidade dos selects (motorista no app vê o mínimo possível).
  const isMotoristaApp = mode === "digital";
  // Mostra select sempre que houver MAIS de um veículo vinculado (motorista
  // titular em vários). Esconde só quando há exatamente 1 (auto-seleção).
  const showVehicleSelect = !isMotoristaApp || myVehicles.length !== 1;
  const showTemplateSelect = !isMotoristaApp || !resolveTemplateForVehicle(vehicle, templates);

  // Bloqueio "sem veículo vinculado": motorista app NÃO está em nenhum veículo
  // como titular → não devemos mostrar todos os veículos da empresa para ele
  // escolher (regra de negócio). Apenas mensagem para procurar o Encarregado.
  const motoristaSemVeiculo = isMotoristaApp && myVehicles.length === 0;

  // No app do motorista, o select de veículo lista APENAS os veículos onde
  // ele é titular — nunca a lista completa (que é privilégio do encarregado).
  const vehiclesForSelect = isMotoristaApp ? myVehicles : vehicles;

  const onPhoto = (itemId) => (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => setPhotos((p) => ({ ...p, [itemId]: r.result }));
    r.readAsDataURL(file);
  };

  const submit = async () => {
    if (!templateId || !vehicleId) { toast.error("Selecione template e veículo."); return; }
    if (blockedByFirstExecution) {
      toast.error("Vistoria de Entrada", { description: "Apenas o Adm de Frota pode lançar a 1ª execução deste veículo." });
      return;
    }
    // Validação de itens obrigatórios do template ANTES de disparar o busy.
    // Para itens do tipo "photo" (ou com `allowPhoto`) marcados como
    // required, exige o anexo — a UI já mostra o `*` mas antes o motorista
    // conseguia enviar mesmo assim.
    const itens = template?.items || [];
    for (const item of itens) {
      if (!item.required) continue;
      const isPhotoOnly = item.type === "photo";
      if (isPhotoOnly) {
        if (!photos[item.id]) {
          toast.error(`Foto obrigatória: "${item.label}"`, { description: "Anexe a foto para prosseguir." });
          return;
        }
        continue;
      }
      // Itens booleanos/select obrigatórios precisam de resposta.
      const v = answers[item.id];
      if (v === undefined || v === null || v === "") {
        toast.error(`Item obrigatório: "${item.label}"`, { description: "Marque uma opção antes de enviar." });
        return;
      }
      // Se o item permite foto E foi marcado como required-com-foto,
      // exige também o anexo. (`allowPhoto` sozinho continua opcional.)
      if (item.requirePhoto && !photos[item.id]) {
        toast.error(`Foto obrigatória: "${item.label}"`, { description: "Este item exige comprovação por foto." });
        return;
      }
    }
    setBusy(true);
    try {
      const docRef = await addDoc(collection(db, "checklists"), {
        // Tipo do checklist: "diario" é o padrão; o sistema marca isFirstExecution
        // automaticamente quando é a 1ª execução do veículo (= Vistoria de Entrada).
        type: isFirstExecution ? "vistoria_entrada" : "diario",
        isFirstExecution,
        source: mode,
        templateId,
        templateName: template?.name,
        vehicleId,
        vehicleTag: vehicle?.tag,
        driverId: driverId || null,
        driverName: driver?.name || profile.name,
        answers,
        photos,
        observations: obs,
        filledByUserId: profile.id,
        filledByName: profile.name,
        filledByRole: profile.role,
        // Campo `date` (YYYY-MM-DD) é o que o Painel de Checklists do Dia usa
        // como índice de filtro. Sem ele os checklists ficam invisíveis no
        // painel e o equipamento aparece como pendente mesmo após preenchido.
        date: new Date().toISOString().slice(0, 10),
        createdAt: serverTimestamp(),
      });
      const message = `🔔 *MACRO AMBIENTAL — Checklist Registrado*

🚛 Veículo: ${vehicleLabel(vehicle)}
📋 Template: ${template?.name || "—"}
👤 Preenchido por: ${profile.name}${driver ? `\n👷 Motorista: ${driver.name}` : ""}
🕐 Em: ${new Date().toLocaleString("pt-BR")}

Acesse para detalhes:
${window.location.origin}/checklists`;
      const recipients = ["encarregado", "admin_frota"];
      if (driver?.phone) recipients.unshift({ name: driver.name, phone: driver.phone, role: "motorista" });
      await notifyWhatsApp({
        recipients,
        title: "Checklist registrado",
        message,
        context: { checklistId: docRef.id },
      });
      toast.success("Checklist salvo.");
      setSavedChecklist({ id: docRef.id });
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const goDetail = () => savedChecklist && navigate(`/checklists/${savedChecklist.id}`);

  // ----- estado pós-submit -----
  if (savedChecklist) {
    return (
      <div className="p-6 md:p-10 max-w-3xl mx-auto">
        <div className="mt-8 bg-white border border-[#E2E8E4] rounded-md p-8 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-[#2E7D32]/15 flex items-center justify-center text-[#2E7D32]">
            <CheckCircle size={36} weight="fill" />
          </div>
          <h2 className="font-[Outfit,sans-serif] text-2xl font-black mt-4 text-[#1E3A5F]">Checklist registrado</h2>
          <p className="text-sm text-[#4A564F] mt-2">Pronto! Você pode visualizar o registro e imprimir / salvar como PDF.</p>
          <div className="mt-6 flex gap-3 justify-center flex-wrap">
            <button onClick={goDetail} data-testid="btn-ver-detalhe"
              className="flex items-center gap-2 bg-[#1E3A5F] text-white px-5 py-3 rounded-md text-sm font-bold uppercase tracking-[0.1em] hover:bg-[#2A4A78]">
              <Printer size={16} /> Ver detalhe / Imprimir
            </button>
            <button onClick={() => navigate("/checklists")} className="border border-[#E2E8E4] text-[#1E3A5F] px-5 py-3 rounded-md text-sm font-bold uppercase tracking-[0.1em] hover:bg-[#EFF3F8]">
              Meus checklists
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ----- estado de fluxo -----
  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto">
      <div className="text-xs uppercase tracking-[0.25em] text-[#708278] font-bold flex items-center gap-2">
        {isMotoristaApp
          ? <><Devices size={14} /> Checklist Diário</>
          : <><ClipboardText size={14} /> Checklist Diário · Papel</>}
      </div>
      {/* TODO: Falta deixar o bom dia dinâmico. */}
      <h1 className="font-[Outfit,sans-serif] text-3xl font-black tracking-tight text-[#0F1411] mt-2">
        {isFirstExecution
          ? "Vistoria de Entrada do veículo"
          : isMotoristaApp ? "Bom dia! Vamos ao checklist." : "Lançar checklist do papel"}
      </h1>
      {isFirstExecution && (
        <div className="mt-4 bg-[#4A7A8C]/15 border border-[#4A7A8C]/40 rounded-md p-4 flex gap-3" data-testid="banner-vistoria-entrada">
          <ShieldCheck size={18} weight="duotone" className="text-[#2E4F5C] mt-0.5 shrink-0" />
          <div className="text-xs text-[#0F2542] leading-relaxed">
            <strong>1ª execução deste veículo — Vistoria de Entrada.</strong> Esta é a única vez que o checklist é lançado pelo <strong>Adm de Frota</strong> no recebimento do equipamento. Daqui pra frente, todas as execuções serão "Diário" e poderão ser feitas pelo motorista/encarregado.
          </div>
        </div>
      )}
      {blockedByFirstExecution && (
        <div className="mt-4 bg-[#C25D41]/15 border border-[#C25D41]/40 rounded-md p-4 flex gap-3" data-testid="banner-bloqueio">
          <ShieldCheck size={18} weight="duotone" className="text-[#8B3A26] mt-0.5 shrink-0" />
          <div className="text-xs text-[#5B1F0D] leading-relaxed">
            Este veículo ainda não tem <strong>Vistoria de Entrada</strong>. Apenas o <strong>Adm de Frota</strong> pode lançar a 1ª execução. Avise o gestor para liberar o equipamento.
          </div>
        </div>
      )}
      {!isMotoristaApp && (
        <p className="text-sm text-[#4A564F] mt-2">Mesmo checklist diário — lançado quando o motorista respondeu no papel.</p>
      )}

      {/* Estado de erro: motorista sem veículo titular vinculado */}
      {motoristaSemVeiculo && (
        <div className="mt-8 bg-[#FEF3C7] border border-[#F59E0B]/40 rounded-md p-6 flex gap-4" data-testid="banner-sem-veiculo">
          <ShieldCheck size={28} weight="duotone" className="text-[#92400E] mt-0.5 shrink-0" />
          <div className="text-sm text-[#92400E] leading-relaxed">
            <strong className="block text-base mb-1">Você não está vinculado a nenhum veículo.</strong>
            Para registrar o checklist, é necessário estar como <strong>motorista titular</strong> de pelo menos um equipamento.
            <div className="mt-3 text-xs">Procure o <strong>Encarregado de Frota</strong> para fazer o vínculo no sistema.</div>
          </div>
        </div>
      )}

      {/* Card resumo do veículo do dia (quando auto-selecionado) */}
      {isMotoristaApp && vehicle && !showVehicleSelect && (
        <div className="mt-6 bg-gradient-to-br from-[#0F2542] to-[#1E3A5F] text-white rounded-md p-5 flex items-center gap-4" data-testid="cl-vehicle-card">
          <div className="w-12 h-12 bg-white/15 rounded-md flex items-center justify-center">
            <Truck size={22} weight="duotone" />
          </div>
          <div className="flex-1">
            <div className="text-[11px] uppercase tracking-[0.2em] font-bold opacity-70">Seu veículo</div>
            <div className="font-[Outfit,sans-serif] text-xl font-bold flex items-center gap-2 flex-wrap mt-0.5">
              <span>{vehicleLabel(vehicle)}</span>
            </div>
            <div className="text-xs opacity-80 mt-0.5">{vehicle.marca} {vehicle.modelo}</div>
          </div>
        </div>
      )}

      <div className={`mt-6 bg-white border border-[#E2E8E4] rounded-md p-6 space-y-5 ${motoristaSemVeiculo ? "hidden" : ""}`}>
        {/* Seleção de motorista — apenas no modo manual (encarregado) */}
        {mode === "manual" && (
          <div>
            <label className="text-[11px] uppercase tracking-[0.2em] font-bold text-[#708278] block mb-1.5">Motorista</label>
            <select data-testid="cl-driver" value={driverId} onChange={(e) => setDriverId(e.target.value)}
              className="w-full border border-[#E2E8E4] px-4 py-3 rounded-md text-sm focus:outline-none focus:border-[#1E3A5F]">
              <option value="">Selecione…</option>
              {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        )}

        {/* Seleção de veículo (escondida se há apenas 1 do motorista) */}
        {showVehicleSelect && (
          <div>
            <label className="text-[11px] uppercase tracking-[0.2em] font-bold text-[#708278] block mb-1.5">
              {isMotoristaApp ? "Escolha o veículo" : "Veículo"}
            </label>
            <select data-testid="cl-vehicle" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}
              className="w-full border border-[#E2E8E4] px-4 py-3 rounded-md text-sm focus:outline-none focus:border-[#1E3A5F]">
              <option value="">Selecione um veículo ativo…</option>
              {vehiclesForSelect.map((v) => <option key={v.id} value={v.id}>{vehicleLabel(v)} — {v.marca} {v.modelo}</option>)}
            </select>
            {isMotoristaApp && myVehicles.length === 0 && vehicles.length > 0 && (
              <div className="text-[11px] text-[#708278] mt-1.5 italic">Você ainda não tem veículo titular vinculado — selecione manualmente.</div>
            )}
          </div>
        )}

        {/* Seleção de template (escondida se vier do veículo) */}
        {showTemplateSelect && (
          <div>
            <label className="text-[11px] uppercase tracking-[0.2em] font-bold text-[#708278] block mb-1.5">Template</label>
            <select data-testid="cl-template" value={templateId} onChange={(e) => setTemplateId(e.target.value)}
              className="w-full border border-[#E2E8E4] px-4 py-3 rounded-md text-sm focus:outline-none focus:border-[#1E3A5F]"
              disabled={!vehicleId && isMotoristaApp}>
              <option value="">Selecione um template…</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        )}

        {/* Mostra template auto-selecionado (info-only) */}
        {isMotoristaApp && template && !showTemplateSelect && (
          <div className="bg-[#EFF3F8] border border-[#2563EB]/30 rounded-md px-4 py-3 text-xs text-[#0F2542] flex items-center gap-2" data-testid="cl-template-auto">
            <ClipboardText size={14} className="text-[#2563EB]" weight="duotone" />
            <span>Template: <b>{template.name}</b> · {template.items?.length || 0} itens</span>
          </div>
        )}

        {/* Itens do checklist */}
        {template && (
          <div className="border-t border-[#E2E8E4] pt-5 space-y-2">
            {template.items.map((item) => (
              <div key={item.id} className="py-3 border-b border-[#E2E8E4] last:border-0">
                <div className="font-bold text-[#0F1411]">{item.label}{item.required && <span className="text-[#C25D41]"> *</span>}</div>
                {item.type === "checkbox" && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button onClick={() => setAnswers((p) => ({ ...p, [item.id]: true }))} data-testid={`cli-${item.id}-ok`}
                      className={`py-4 rounded-md font-bold text-sm uppercase tracking-[0.1em] border-2 ${answers[item.id] === true ? "bg-[#2E7D32] text-white border-[#2E7D32]" : "border-[#E2E8E4] hover:border-[#2E7D32]/40"}`}>Conforme</button>
                    <button onClick={() => setAnswers((p) => ({ ...p, [item.id]: false }))} data-testid={`cli-${item.id}-nok`}
                      className={`py-4 rounded-md font-bold text-sm uppercase tracking-[0.1em] border-2 ${answers[item.id] === false ? "bg-[#C25D41] text-white border-[#C25D41]" : "border-[#E2E8E4] hover:border-[#C25D41]/40"}`}>Não Conforme</button>
                  </div>
                )}
                {item.type === "text" && (
                  <input value={answers[item.id] || ""} onChange={(e) => setAnswers((p) => ({ ...p, [item.id]: e.target.value }))}
                    className="mt-3 w-full border border-[#E2E8E4] px-4 py-3 rounded-md text-sm focus:outline-none focus:border-[#1E3A5F]" />
                )}
                {item.type === "number" && (
                  <input type="number" value={answers[item.id] ?? ""} onChange={(e) => setAnswers((p) => ({ ...p, [item.id]: e.target.value }))}
                    className="mt-3 w-full border border-[#E2E8E4] px-4 py-3 rounded-md text-sm focus:outline-none focus:border-[#1E3A5F]" />
                )}
                {(item.type === "photo" || item.allowPhoto) && (
                  <>
                    <label className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-[#1E3A5F] cursor-pointer">
                      <Camera size={16} /> {photos[item.id] ? "Trocar foto" : "Anexar foto"}
                      <input type="file" accept="image/*" capture="environment" onChange={onPhoto(item.id)} className="hidden" />
                    </label>
                    {photos[item.id] && <img src={photos[item.id]} alt="" className="mt-2 w-28 h-28 object-cover rounded-md border border-[#E2E8E4]" />}
                  </>
                )}
              </div>
            ))}
            <div className="pt-3">
              <label className="text-[11px] uppercase tracking-[0.2em] font-bold text-[#708278] block mb-1.5">Observações</label>
              <textarea rows={3} value={obs} onChange={(e) => setObs(e.target.value)}
                placeholder={isMotoristaApp ? "Algo a relatar? (opcional)" : "Observações do encarregado..."}
                className="w-full border border-[#E2E8E4] px-4 py-3 rounded-md text-sm focus:outline-none focus:border-[#1E3A5F]" />
            </div>
            <button onClick={submit} disabled={busy || blockedByFirstExecution} data-testid="cl-submit"
              className="w-full mt-4 bg-[#1E3A5F] text-white py-3.5 rounded-md text-sm font-bold uppercase tracking-[0.1em] hover:bg-[#2A4A78] transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              {busy ? "Salvando…" : blockedByFirstExecution ? "Aguardando Adm de Frota" : isFirstExecution ? "Registrar Vistoria de Entrada" : isMotoristaApp ? "Enviar checklist" : "Salvar Checklist"}
            </button>
          </div>
        )}

        {/* Hint quando ainda não há template selecionado */}
        {!template && vehicleId && templates.length === 0 && (
          <div className="text-xs text-[#708278] italic pt-2 border-t border-[#E2E8E4]">
            Nenhum template diário cadastrado ainda. Avise a Segurança do Trabalho.
          </div>
        )}
      </div>
    </div>
  );
}
