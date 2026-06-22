import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc, updateDoc, collection, query, where, getDocs, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { VEHICLE_STATUS, VEHICLE_STATUS_LABEL, COMBUSTIVEIS, ROLES, DRIVER_STATUS, ORIGEM_TIPOS } from "../lib/constants";
import { filterOperationalDrivers } from "../lib/drivers";
import { resolveTemplateForVehicle } from "../lib/checklistTemplateResolver";
import { toast } from "sonner";
import { ArrowLeft, FloppyDisk, Truck, User, ClipboardText, PencilSimple, Plus, X, FileText } from "@phosphor-icons/react";
import { SingleFileSlot, MultiFileSlot } from "../components/FileSlots";

const inp = "w-full border border-[#E2E8E4] bg-white px-4 py-3 rounded-md text-sm text-[#0F1411] focus:outline-none focus:border-[#2563EB] focus:border-2 transition-all";

export default function VehicleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [vehicle, setVehicle] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [teams, setTeams] = useState([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);

  const canEdit = [ROLES.ADMIN, ROLES.FROTA, ROLES.DP].includes(profile.role);
  // Vinculação de motorista titular: apenas Frota/DP/Admin (Encarregado faz apenas via Requerimento/Equipe).
  const canLinkDriver = [ROLES.ADMIN, ROLES.FROTA, ROLES.DP].includes(profile.role);

  useEffect(() => {
    (async () => {
      const s = await getDoc(doc(db, "vehicles", id));
      if (s.exists()) {
        const v = { id: s.id, ...s.data() };
        setVehicle(v);
        // Normaliza o array de motoristas titulares (compat legado: campo único
        // `motoristaTitularId` vira array com 1 item; ausência vira []).
        const titulares = Array.isArray(v.motoristasTitularesIds)
          ? v.motoristasTitularesIds
          : (v.motoristaTitularId ? [v.motoristaTitularId] : []);
        setForm({ ...v, motoristasTitularesIds: titulares, anexos: v.anexos || [] });
      }
      const [d, t, tm] = await Promise.all([
        getDocs(query(collection(db, "drivers"), where("status", "in", [DRIVER_STATUS.ACTIVE, DRIVER_STATUS.NO_LOGIN_USER]))),
        getDocs(collection(db, "checklistTemplates")),
        getDocs(collection(db, "teams")),
      ]);
      const rawDrivers = d.docs.map((x) => ({ id: x.id, ...x.data() }));
      setDrivers(filterOperationalDrivers(rawDrivers));
      setTemplates(t.docs.map((x) => ({ id: x.id, ...x.data() })));
      setTeams(tm.docs.map((x) => ({ id: x.id, ...x.data() })));
    })();
  }, [id]);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  // Modal de conflito ao adicionar um motorista que já é titular de outro veículo.
  //   Estrutura: { driverId, driverName, conflicts: [{ id, tag, marca, modelo, placa }] }
  const [conflictDialog, setConflictDialog] = useState(null);
  // Decisões por motorista após o diálogo: "remover" | "manter".
  // Quando "manter" → o motorista permanece titular de múltiplos veículos.
  // Quando "remover" → ao salvar, desvinculamos dos veículos antigos.
  const [realocacoes, setRealocacoes] = useState({});

  // Helpers da lista de motoristas titulares — sem duplicados.
  // Antes de adicionar, checa se o motorista já é titular em outro veículo
  // e, se sim, abre o diálogo para o usuário decidir (NÃO remove automático).
  const addTitular = async (driverId) => {
    if (!driverId) return;
    const cur = form.motoristasTitularesIds || [];
    if (cur.includes(driverId)) {
      toast.warning("Esse motorista já está vinculado neste veículo.");
      return;
    }
    try {
      const [snapSingle, snapArr] = await Promise.all([
        getDocs(query(collection(db, "vehicles"), where("motoristaTitularId", "==", driverId))),
        getDocs(query(collection(db, "vehicles"), where("motoristasTitularesIds", "array-contains", driverId))),
      ]);
      const conflictsMap = new Map();
      [...snapSingle.docs, ...snapArr.docs].forEach((d) => {
        if (d.id !== id) conflictsMap.set(d.id, { id: d.id, ...d.data() });
      });
      if (conflictsMap.size > 0) {
        const driver = drivers.find((d) => d.id === driverId);
        setConflictDialog({
          driverId,
          driverName: driver?.name || "Motorista",
          conflicts: [...conflictsMap.values()],
        });
        return; // adição efetiva acontece após escolha no modal
      }
    } catch (e) { /* falha de query → segue sem dialog */ }
    setForm((p) => ({ ...p, motoristasTitularesIds: [...(p.motoristasTitularesIds || []), driverId] }));
  };

  // Confirmação do diálogo: aplica a decisão e adiciona o motorista à lista.
  const resolveConflict = (decisao) => {
    if (!conflictDialog) return;
    const { driverId } = conflictDialog;
    setForm((p) => ({ ...p, motoristasTitularesIds: [...(p.motoristasTitularesIds || []), driverId] }));
    setRealocacoes((p) => ({ ...p, [driverId]: decisao }));
    setConflictDialog(null);
  };

  const removeTitular = (driverId) => {
    setForm((p) => ({ ...p, motoristasTitularesIds: (p.motoristasTitularesIds || []).filter((x) => x !== driverId) }));
    setRealocacoes((p) => { const { [driverId]: _, ...rest } = p; return rest; });
  };

  const save = async () => {
    setBusy(true);
    try {
      const titulares = (form.motoristasTitularesIds || []).filter(Boolean);
      // Remove duplicados (defesa adicional caso UI deixe escapar).
      const titularesUnicos = [...new Set(titulares)];
      const titularesDocs = titularesUnicos.map((tid) => drivers.find((d) => d.id === tid)).filter(Boolean);
      const primeiroTitular = titularesDocs[0] || null;
      // Normaliza placa para busca/uniqueness (vide RequerimentoWizard).
      const placa = (form.placa || "").trim().toUpperCase();
      const placaNormalizada = placa.replace(/[^A-Z0-9]/g, "") || null;
      await updateDoc(doc(db, "vehicles", id), {
        tag: form.tag,
        placa: placa || null,
        placaNormalizada,
        marca: form.marca,
        modelo: form.modelo,
        ano: form.ano,
        combustivel: form.combustivel,
        capacidade: form.capacidade,
        horimetro: form.horimetro,
        quilometragem: form.quilometragem,
        centro_custo: form.centro_custo,
        unidade: form.unidade,
        empresa: form.empresa,
        origem: form.origem || "proprio",
        // Campos de custo/gestão para relatórios da Frota:
        valorAluguelMensal: Number(form.valorAluguelMensal) || 0,
        valorPatrimonio: Number(form.valorPatrimonio) || 0,
        dataAquisicao: form.dataAquisicao || null,
        vencimentoCRLV: form.vencimentoCRLV || null,
        teamId: form.teamId || null,
        // Lista de motoristas titulares (nova). Mantemos `motoristaTitularId`
        // apontando para o primeiro para compatibilidade com componentes legados.
        motoristasTitularesIds: titularesUnicos,
        motoristasTitularesNomes: titularesDocs.map((d) => d.name),
        motoristaTitularId: primeiroTitular?.id || null,
        motoristaTitularNome: primeiroTitular?.name || null,
        checklistTemplateId: form.checklistTemplateId || null,
        // Anexos:
        crlvAnexo: form.crlvAnexo || null,
        anexos: form.anexos || [],
        updatedAt: serverTimestamp(),
        updatedBy: profile.name,
      });

      // Auto-realocação CONTROLADA: só desvinculamos o motorista do veículo
      // anterior quando o usuário explicitamente escolheu "remover" no diálogo
      // de conflito (ver `addTitular`). Caso contrário, o motorista pode ser
      // titular de múltiplos veículos simultaneamente — e verá todos no
      // checklist diário.
      const titularesAntes = Array.isArray(vehicle.motoristasTitularesIds)
        ? vehicle.motoristasTitularesIds
        : (vehicle.motoristaTitularId ? [vehicle.motoristaTitularId] : []);
      const novosVinculos = titularesUnicos.filter((tid) => !titularesAntes.includes(tid));

      await Promise.all(novosVinculos.map(async (tid) => {
        // `defaultVehicleId` representa o veículo "principal" (último associado).
        await updateDoc(doc(db, "drivers", tid), { defaultVehicleId: id });
        if (realocacoes[tid] !== "remover") return; // mantém em múltiplos veículos
        // Usuário escolheu remover dos outros → faz a desvinculação.
        const qSingle = query(collection(db, "vehicles"), where("motoristaTitularId", "==", tid));
        const snapSingle = await getDocs(qSingle);
        await Promise.all(snapSingle.docs.filter((d) => d.id !== id).map((d) =>
          updateDoc(doc(db, "vehicles", d.id), {
            motoristaTitularId: null,
            motoristaTitularNome: null,
            motoristasTitularesIds: ((d.data().motoristasTitularesIds || []).filter((x) => x !== tid)),
            motoristaRemovidoEm: serverTimestamp(),
            motoristaRemovidoMotivo: `Realocado para ${form.tag || id}`,
          })));
        const qArr = query(collection(db, "vehicles"), where("motoristasTitularesIds", "array-contains", tid));
        const snapArr = await getDocs(qArr);
        await Promise.all(snapArr.docs.filter((d) => d.id !== id).map((d) => {
          const arr = (d.data().motoristasTitularesIds || []).filter((x) => x !== tid);
          return updateDoc(doc(db, "vehicles", d.id), {
            motoristasTitularesIds: arr,
            motoristaTitularId: (d.data().motoristaTitularId === tid) ? (arr[0] || null) : (d.data().motoristaTitularId || null),
            motoristaRemovidoEm: serverTimestamp(),
            motoristaRemovidoMotivo: `Realocado para ${form.tag || id}`,
          });
        }));
      }));

      toast.success("Veículo atualizado.");
      setEditing(false);
      const s = await getDoc(doc(db, "vehicles", id));
      const v = { id: s.id, ...s.data() };
      setVehicle(v);
      setForm({ ...v, motoristasTitularesIds: Array.isArray(v.motoristasTitularesIds) ? v.motoristasTitularesIds : (v.motoristaTitularId ? [v.motoristaTitularId] : []), anexos: v.anexos || [] });
    } catch (e) {
      toast.error(e.message);
    } finally { setBusy(false); }
  };

  if (!vehicle) return <div className="p-10 text-sm text-[#4A564F]">Carregando…</div>;

  // Resolve a lista efetiva de motoristas titulares (compat single → array).
  const titularesIds = Array.isArray(vehicle.motoristasTitularesIds)
    ? vehicle.motoristasTitularesIds
    : (vehicle.motoristaTitularId ? [vehicle.motoristaTitularId] : []);
  const titulares = titularesIds.map((tid) => drivers.find((d) => d.id === tid)).filter(Boolean);
  // Template efetivo: resolver via cadeia (override → tipo → categoria).
  const resolvedTemplate = resolveTemplateForVehicle(vehicle, templates);
  const tpl = resolvedTemplate || templates.find((t) => t.id === vehicle.checklistTemplateId);
  const tplOrigem = vehicle.checklistTemplateId && resolvedTemplate?.id === vehicle.checklistTemplateId
    ? "Override manual neste veículo"
    : resolvedTemplate?.vehicleTypeNome ? `Herdado do tipo: ${resolvedTemplate.vehicleTypeNome}` : null;
  // Para o select de adicionar motorista — exclui os já vinculados (evita duplicado).
  const driversNaoVinculados = drivers.filter((d) => !(form.motoristasTitularesIds || []).includes(d.id));

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] font-bold text-[#708278] hover:text-[#1E3A5F]">
        <ArrowLeft size={14} /> Voltar
      </button>

      <div className="flex flex-wrap items-end justify-between gap-4 mt-4">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-[#708278] font-bold">Frota</div>
          <h1 className="font-[Outfit,sans-serif] text-3xl font-black tracking-tight text-[#0F1411] mt-2 flex items-center gap-3 flex-wrap">
            <Truck size={28} weight="duotone" className="text-[#2563EB]" /> {vehicle.tag}
            {vehicle.placa && <span className="text-base font-bold bg-[#1E3A5F] text-white px-2 py-1 rounded">{vehicle.placa}</span>}
          </h1>
          <p className="text-sm text-[#4A564F] mt-1">{vehicle.marca} {vehicle.modelo} · {vehicle.ano}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] uppercase tracking-[0.15em] font-bold px-3 py-2 rounded-md border ${
            vehicle.status === "ACTIVE" ? "bg-[#2E7D32]/15 text-[#1B5E20] border-[#2E7D32]/40" :
            vehicle.status === "PENDING_ACTIVATION" ? "bg-[#8EA694]/20 text-[#3D4F44] border-[#8EA694]/50" :
            "bg-[#D9A05B]/15 text-[#8B5E2B] border-[#D9A05B]/40"
          }`}>{VEHICLE_STATUS_LABEL[vehicle.status]}</span>
          {canEdit && !editing && (
            <button onClick={() => setEditing(true)} data-testid="btn-editar-veiculo"
              className="flex items-center gap-2 bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] text-white px-4 py-2 rounded-md text-xs font-bold uppercase tracking-[0.1em] hover:from-[#1D4ED8] hover:to-[#1E40AF]">
              <PencilSimple size={14} /> Editar
            </button>
          )}
        </div>
      </div>

      <div className="mt-8 bg-white border border-[#E2E8E4] rounded-md p-6 space-y-5">
        {editing ? (
          <>
            <h3 className="text-lg font-bold text-[#0F2542] font-[Outfit,sans-serif]">Editar dados do veículo</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field l="TAG"><input value={form.tag || ""} onChange={(e) => set("tag", e.target.value)} className={inp} data-testid="ev-tag" /></Field>
              <Field l="Placa" hint="Em maiúsculas.">
                <input value={form.placa || ""}
                  onChange={(e) => set("placa", e.target.value.toUpperCase())}
                  className={inp} data-testid="ev-placa" maxLength={8} placeholder="ABC1D23" />
              </Field>
              <Field l="Marca"><input value={form.marca || ""} onChange={(e) => set("marca", e.target.value)} className={inp} /></Field>
              <Field l="Modelo"><input value={form.modelo || ""} onChange={(e) => set("modelo", e.target.value)} className={inp} /></Field>
              <Field l="Ano"><input type="number" value={form.ano || ""} onChange={(e) => set("ano", e.target.value)} className={inp} /></Field>
              <Field l="Combustível">
                <select value={form.combustivel || ""} onChange={(e) => set("combustivel", e.target.value)} className={inp}>
                  <option value="">Selecione</option>
                  {COMBUSTIVEIS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field l="Capacidade"><input value={form.capacidade || ""} onChange={(e) => set("capacidade", e.target.value)} className={inp} /></Field>
              <Field l="Horímetro"><input value={form.horimetro || ""} onChange={(e) => set("horimetro", e.target.value)} className={inp} /></Field>
              <Field l="Quilometragem"><input value={form.quilometragem || ""} onChange={(e) => set("quilometragem", e.target.value)} className={inp} /></Field>
              <Field l="Empresa"><input value={form.empresa || ""} onChange={(e) => set("empresa", e.target.value)} className={inp} /></Field>
              <Field l="Centro de custo"><input value={form.centro_custo || ""} onChange={(e) => set("centro_custo", e.target.value)} className={inp} /></Field>
              <Field l="Unidade"><input value={form.unidade || ""} onChange={(e) => set("unidade", e.target.value)} className={inp} /></Field>
            </div>

            {/* Bloco custo/gestão para Frota — campos inegociáveis para relatórios. */}
            <div className="pt-4 border-t border-[#E2E8E4]">
              <h4 className="text-xs uppercase tracking-[0.2em] font-bold text-[#0F2542] mb-3">Custos e Gestão (Frota)</h4>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field l="Origem">
                  <select value={form.origem || "proprio"} onChange={(e) => set("origem", e.target.value)} className={inp} data-testid="ev-origem">
                    {ORIGEM_TIPOS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                    {/* Compatibilidade com origens legadas pré-migração */}
                    {form.origem === "alugado" && <option value="alugado">Alugado (legado)</option>}
                    {form.origem === "prestacao" && <option value="prestacao">Prestação de serviço (legado)</option>}
                  </select>
                </Field>
                <Field l="Valor mensal de aluguel (R$)" hint="Inegociável. Mesmo veículos próprios têm auto-aluguel interno para relatórios.">
                  <input type="number" value={form.valorAluguelMensal || ""} onChange={(e) => set("valorAluguelMensal", e.target.value)} className={inp} placeholder="15000" data-testid="ev-aluguel" />
                </Field>
                <Field l="Valor de patrimônio (R$)" hint="Para veículos próprios.">
                  <input type="number" value={form.valorPatrimonio || ""} onChange={(e) => set("valorPatrimonio", e.target.value)} className={inp} placeholder="350000" data-testid="ev-patrimonio" />
                </Field>
                <Field l="Data de aquisição">
                  <input type="date" value={form.dataAquisicao || ""} onChange={(e) => set("dataAquisicao", e.target.value)} className={inp} data-testid="ev-data-aquisicao" />
                </Field>
                <Field l="Vencimento do CRLV" hint="Aparece no Dashboard como alerta quando próximo do vencimento.">
                  <input type="date" value={form.vencimentoCRLV || ""} onChange={(e) => set("vencimentoCRLV", e.target.value)} className={inp} data-testid="ev-crlv" />
                </Field>
                <Field l="Equipe responsável" hint="Equipe que opera o veículo (definida pelo DP em /teams).">
                  <select value={form.teamId || ""} onChange={(e) => set("teamId", e.target.value)} className={inp} data-testid="ev-team">
                    <option value="">— Nenhuma —</option>
                    {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </Field>
              </div>
            </div>

            <div className="pt-4 border-t border-[#E2E8E4]">
              <h4 className="text-xs uppercase tracking-[0.2em] font-bold text-[#0F2542] mb-3">Vínculos operacionais</h4>
              <div className="grid sm:grid-cols-2 gap-4">
                {/* Lista de motoristas titulares — sem duplicados */}
                <Field l={`Motoristas titulares (${(form.motoristasTitularesIds || []).length})`}
                  hint="Vários motoristas podem operar o mesmo equipamento. Apenas APROVADOS pelo DP aparecem.">
                  <div className="space-y-2">
                    {(form.motoristasTitularesIds || []).length === 0 && (
                      <div className="text-[11px] text-[#708278] italic">Nenhum motorista vinculado.</div>
                    )}
                    {(form.motoristasTitularesIds || []).map((tid) => {
                      const d = drivers.find((x) => x.id === tid);
                      return (
                        <div key={tid} className="flex items-center justify-between bg-[#EFF3F8] border border-[#2563EB]/20 rounded-md px-3 py-2"
                          data-testid={`titular-chip-${tid}`}>
                          <div className="flex items-center gap-2 min-w-0">
                            <User size={14} className="text-[#2563EB]" weight="duotone" />
                            <span className="text-sm font-bold text-[#0F2542] truncate">{d?.name || "Motorista removido"}</span>
                            {d?.cnh && <span className="text-[10px] text-[#708278]">CNH {d.cnh}</span>}
                          </div>
                          {canLinkDriver && (
                            <button type="button" onClick={() => removeTitular(tid)}
                              data-testid={`titular-rm-${tid}`}
                              className="text-[10px] text-[#DC2626] font-bold uppercase tracking-[0.15em]">Remover</button>
                          )}
                        </div>
                      );
                    })}
                    {canLinkDriver && (
                      <div className="flex gap-2">
                        <select value="" onChange={(e) => { addTitular(e.target.value); e.target.value = ""; }}
                          data-testid="ev-add-titular"
                          className={inp} disabled={driversNaoVinculados.length === 0}>
                          <option value="">{driversNaoVinculados.length === 0 ? "— Todos os motoristas já vinculados —" : "+ Adicionar motorista titular…"}</option>
                          {driversNaoVinculados.map((d) => <option key={d.id} value={d.id}>{d.name}{d.cnh ? ` (CNH ${d.cnh})` : ""}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                </Field>
                <Field l="Template de checklist (override)" hint="Por padrão o veículo herda o template do TIPO (catálogo Medição). Use aqui apenas para sobrescrever com um template específico deste equipamento.">
                  <select value={form.checklistTemplateId || ""} onChange={(e) => set("checklistTemplateId", e.target.value)} className={inp} data-testid="ev-template">
                    <option value="">— Herdar do tipo —</option>
                    {templates.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.items?.length || 0} itens)</option>)}
                  </select>
                </Field>
              </div>
            </div>

            {/* Anexos do veículo */}
            <div className="pt-4 border-t border-[#E2E8E4]">
              <h4 className="text-xs uppercase tracking-[0.2em] font-bold text-[#0F2542] mb-3">Anexos</h4>
              <div className="grid sm:grid-cols-2 gap-4">
                <SingleFileSlot
                  testId="ev-crlv-anexo"
                  label="CRLV do Veículo"
                  hint="Certificado de Registro e Licenciamento (PDF ou imagem)."
                  file={form.crlvAnexo}
                  onChange={(f) => set("crlvAnexo", f)}
                  onClear={() => set("crlvAnexo", null)}
                  allowCamera
                />
                <div /> {/* slot vazio do grid */}
              </div>
              <div className="mt-4">
                <MultiFileSlot
                  testId="ev-anexos"
                  label="Outros documentos (genéricos)"
                  hint="Adicione contrato, nota fiscal, fotos do equipamento, manuais, etc."
                  files={form.anexos || []}
                  onAdd={(novos) => set("anexos", [...(form.anexos || []), ...novos])}
                  onRemove={(i) => set("anexos", (form.anexos || []).filter((_, idx) => idx !== i))}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-[#E2E8E4]">
              <button onClick={save} disabled={busy} data-testid="ev-save"
                className="flex items-center gap-2 bg-[#0F2542] text-white px-6 py-3 rounded-md text-sm font-bold uppercase tracking-[0.1em] hover:bg-[#16294A]">
                <FloppyDisk size={16} /> {busy ? "Salvando…" : "Salvar"}
              </button>
              <button onClick={() => { setEditing(false); setForm(vehicle); }}
                className="border border-[#E2E8E4] text-[#4A564F] px-6 py-3 rounded-md text-sm font-bold uppercase tracking-[0.1em] hover:bg-[#F5F7FA]">
                Cancelar
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 className="text-lg font-bold text-[#0F2542] font-[Outfit,sans-serif]">Dados</h3>
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <Row k="TAG" v={vehicle.tag} />
              <Row k="Equipamento" v={vehicle.equipamento_tipo} />
              <Row k="Marca / Modelo" v={`${vehicle.marca || ""} ${vehicle.modelo || ""}`} />
              <Row k="Ano" v={vehicle.ano} />
              <Row k="Combustível" v={vehicle.combustivel} />
              <Row k="Capacidade" v={vehicle.capacidade} />
              <Row k="Horímetro" v={vehicle.horimetro} />
              <Row k="Quilometragem" v={vehicle.quilometragem} />
              <Row k="Empresa" v={vehicle.empresa} />
              <Row k="Centro de custo" v={vehicle.centro_custo} />
              <Row k="Unidade" v={vehicle.unidade} />
              <Row k="Origem" v={vehicle.origem} />
            </div>

            <div className="pt-4 border-t border-[#E2E8E4]">
              <h4 className="text-xs uppercase tracking-[0.2em] font-bold text-[#0F2542] mb-3">Vínculos operacionais</h4>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="bg-[#EFF3F8] border border-[#2563EB]/20 rounded-md p-4">
                  <div className="flex items-start gap-3">
                    <User size={20} className="text-[#2563EB] mt-1 shrink-0" weight="duotone" />
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase tracking-[0.15em] font-bold text-[#708278]">Motoristas titulares ({titulares.length})</div>
                      {titulares.length === 0 ? (
                        <div className="text-sm font-bold text-[#708278] mt-1 italic">— Nenhum vinculado —</div>
                      ) : (
                        <ul className="mt-2 space-y-1.5">
                          {titulares.map((t) => (
                            <li key={t.id} className="text-sm font-bold text-[#0F2542] flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB]" />
                              <span>{t.name}</span>
                              {t.phone && <span className="text-[11px] text-[#708278] font-normal">· {t.phone}</span>}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
                <div className="bg-[#EFF3F8] border border-[#2563EB]/20 rounded-md p-4 flex items-start gap-3">
                  <ClipboardText size={20} className="text-[#2563EB] mt-1" weight="duotone" />
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-[0.15em] font-bold text-[#708278]">Template de checklist</div>
                    <div className="text-sm font-bold text-[#0F2542] mt-0.5">{tpl?.name || "— Não vinculado —"}</div>
                    {tpl && <div className="text-xs text-[#4A564F]">{tpl.items?.length || 0} itens</div>}
                    {tplOrigem && <div className="text-[10px] uppercase tracking-[0.15em] font-bold text-[#2563EB] mt-1">{tplOrigem}</div>}
                  </div>
                </div>
              </div>
            </div>

            {/* Anexos (somente exibição) */}
            {(vehicle.crlvAnexo || (vehicle.anexos || []).length > 0) && (
              <div className="pt-4 border-t border-[#E2E8E4]">
                <h4 className="text-xs uppercase tracking-[0.2em] font-bold text-[#0F2542] mb-3">Anexos</h4>
                <div className="space-y-2">
                  {vehicle.crlvAnexo && (
                    <a href={vehicle.crlvAnexo.dataUrl} download={vehicle.crlvAnexo.name}
                      data-testid="view-crlv-anexo"
                      className="flex items-center gap-2 border border-[#2563EB]/30 bg-[#EFF3F8] rounded-md px-3 py-2 hover:bg-[#1E3A5F] hover:text-white transition-all group">
                      <FileText size={14} className="text-[#2563EB] group-hover:text-white" weight="duotone" />
                      <span className="text-[10px] uppercase tracking-[0.15em] font-bold text-[#2563EB] group-hover:text-white/80">CRLV:</span>
                      <span className="text-sm font-bold truncate">{vehicle.crlvAnexo.name}</span>
                    </a>
                  )}
                  {(vehicle.anexos || []).map((a, i) => (
                    <a key={i} href={a.dataUrl} download={a.name}
                      data-testid={`view-anexo-${i}`}
                      className="flex items-center gap-2 border border-[#E2E8E4] rounded-md px-3 py-2 hover:bg-[#EFF3F8] transition-all">
                      <FileText size={14} className="text-[#2563EB]" weight="duotone" />
                      <span className="text-sm font-bold truncate text-[#0F2542]">{a.name}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Diálogo de conflito: motorista já é titular em outro veículo */}
      {conflictDialog && (
        <div className="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-4" data-testid="dialog-conflito-titular">
          <div className="bg-white rounded-md max-w-md w-full p-6 relative">
            <div className="text-[11px] uppercase tracking-[0.2em] font-bold text-[#D9A05B]">Atenção</div>
            <h3 className="font-[Outfit,sans-serif] text-xl font-black tracking-tight text-[#0F1411] mt-1">
              {conflictDialog.driverName} já é titular em outro veículo
            </h3>
            <p className="text-sm text-[#4A564F] mt-3">
              Esse motorista atualmente está vinculado como titular em:
            </p>
            <ul className="mt-3 space-y-2 max-h-44 overflow-auto">
              {conflictDialog.conflicts.map((c) => (
                <li key={c.id} className="flex items-center gap-2 bg-[#FFF8E7] border border-[#D9A05B]/30 rounded-md px-3 py-2 text-sm" data-testid={`conflito-veiculo-${c.id}`}>
                  <Truck size={14} className="text-[#8B5E2B]" weight="duotone" />
                  <span className="font-bold text-[#5B3F1A] truncate">{c.tag || c.placa || c.id}</span>
                  <span className="text-[11px] text-[#8B5E2B]">{c.marca} {c.modelo}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-[#4A564F] mt-4 leading-relaxed">
              Como deseja proceder? Manter em ambos permite que o motorista veja
              vários veículos no checklist. Remover dos outros deixa este como
              titular único.
            </p>
            <div className="grid sm:grid-cols-3 gap-2 mt-5">
              <button onClick={() => setConflictDialog(null)} data-testid="conflito-cancelar"
                className="border border-[#E2E8E4] text-[#4A564F] py-2.5 rounded-md text-xs font-bold uppercase tracking-[0.1em] hover:bg-[#F5F7FA]">
                Cancelar
              </button>
              <button onClick={() => resolveConflict("manter")} data-testid="conflito-manter"
                className="bg-[#10B981] hover:bg-[#059669] text-white py-2.5 rounded-md text-xs font-bold uppercase tracking-[0.1em]">
                Manter em ambos
              </button>
              <button onClick={() => resolveConflict("remover")} data-testid="conflito-remover"
                className="bg-[#DC2626] hover:bg-[#B91C1C] text-white py-2.5 rounded-md text-xs font-bold uppercase tracking-[0.1em]">
                Remover dos outros
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ l, children, hint }) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-[0.2em] font-bold text-[#708278] block mb-1.5">{l}</label>
      {children}
      {hint && <div className="text-[11px] text-[#708278] mt-1 italic">{hint}</div>}
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div className="border-b border-[#E2E8E4] py-2">
      <div className="text-[10px] uppercase tracking-[0.15em] text-[#708278] font-bold">{k}</div>
      <div className="text-sm text-[#0F1411] font-semibold mt-0.5">{v || "—"}</div>
    </div>
  );
}
