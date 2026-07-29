import { useEffect, useState, useMemo } from "react";
import { collection, addDoc, updateDoc, doc, serverTimestamp, arrayUnion, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import {
  EQUIPAMENTO_TIPOS, SUB_TIPOS_CAMINHAO, SUB_TIPOS_LABEL, PORTE_VEICULO,
} from "../lib/constants";
import { canManageVehicleTypes } from "../lib/roles";
import { formatCurrency } from "../lib/vehicleTypes";
import { toast } from "sonner";
import { Plus, Pencil, FloppyDisk, X, Stack, ToggleLeft, ToggleRight, CurrencyCircleDollar, ClockClockwise } from "@phosphor-icons/react";

const emptyForm = {
  nome: "",
  categoria: "",
  subTipo: "",
  porte: "",
  medicao: "km",
  valorMensal: "",
  valorHoraExtra: "",
  valorDiaExtra: "",
  ativo: true,
};

export default function VehicleTypesAdmin() {
  const { profile } = useAuth();
  const editable = canManageVehicleTypes(profile.role);
  const [types, setTypes] = useState([]);
  const [editing, setEditing] = useState(null); // null | "new" | id
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [filterCat, setFilterCat] = useState("");
  const [showHistory, setShowHistory] = useState(null); // id

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "vehicleTypes"), (snap) => {
      const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      arr.sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
      setTypes(arr);
    });
    return () => unsub();
  }, []);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const catCfg = EQUIPAMENTO_TIPOS.find((e) => e.id === form.categoria);
  const subTiposDisponiveis = catCfg?.subTipos
    ? SUB_TIPOS_CAMINHAO.filter((s) => catCfg.subTipos.includes(s.id))
    : [];

  // Ao escolher categoria, preenche porte e medicao automaticamente.
  const onCategoriaChange = (id) => {
    const cfg = EQUIPAMENTO_TIPOS.find((e) => e.id === id);
    setForm((p) => ({
      ...p,
      categoria: id,
      porte: cfg?.porte || "",
      medicao: cfg?.medicao && cfg.medicao !== "ambos" ? cfg.medicao : (p.medicao || "km"),
      subTipo: cfg?.subTipos ? (p.subTipo || cfg.subTipos[0]) : "",
    }));
  };

  const openNew = () => { setForm(emptyForm); setEditing("new"); };
  const openEdit = (vt) => {
    setForm({
      nome: vt.nome || "",
      categoria: vt.categoria || "",
      subTipo: vt.subTipo || "",
      porte: vt.porte || "",
      medicao: vt.medicao || "km",
      valorMensal: vt.valorMensal ?? "",
      valorHoraExtra: vt.valorHoraExtra ?? "",
      valorDiaExtra: vt.valorDiaExtra ?? "",
      ativo: vt.ativo !== false,
    });
    setEditing(vt.id);
  };
  const cancel = () => { setEditing(null); setForm(emptyForm); };

  const save = async () => {
    if (!form.nome.trim()) return toast.error("Informe o nome do tipo.");
    if (!form.categoria) return toast.error("Selecione a categoria.");
    if (catCfg?.subTipos && !form.subTipo) return toast.error("Selecione o sub-tipo (Toco/Truck/3/4).");
    if (Number(form.valorMensal) < 0) return toast.error("Valor mensal inválido.");
    setBusy(true);
    try {
      const valoresLog = {
        at: new Date().toISOString(),
        by: profile.name,
        valorMensal: Number(form.valorMensal) || 0,
        valorHoraExtra: Number(form.valorHoraExtra) || 0,
        valorDiaExtra: Number(form.valorDiaExtra) || 0,
      };
      const payload = {
        nome: form.nome.trim(),
        categoria: form.categoria,
        subTipo: form.subTipo || null,
        porte: form.porte,
        medicao: form.medicao,
        valorMensal: Number(form.valorMensal) || 0,
        valorHoraExtra: Number(form.valorHoraExtra) || 0,
        valorDiaExtra: Number(form.valorDiaExtra) || 0,
        ativo: form.ativo !== false,
        updatedAt: serverTimestamp(),
        updatedBy: profile.name,
      };
      if (editing === "new") {
        await addDoc(collection(db, "vehicleTypes"), {
          ...payload,
          createdAt: serverTimestamp(),
          createdBy: profile.name,
          historicoValores: [valoresLog],
        });
        toast.success("Tipo criado.");
      } else {
        // Adiciona ao histórico se valores mudaram (vs estado anterior).
        const prev = types.find((t) => t.id === editing);
        const valoresMudaram = prev && (
          Number(prev.valorMensal || 0) !== Number(form.valorMensal || 0) ||
          Number(prev.valorHoraExtra || 0) !== Number(form.valorHoraExtra || 0) ||
          Number(prev.valorDiaExtra || 0) !== Number(form.valorDiaExtra || 0)
        );
        const update = { ...payload };
        if (valoresMudaram) update.historicoValores = arrayUnion(valoresLog);
        await updateDoc(doc(db, "vehicleTypes", editing), update);
        toast.success("Tipo atualizado.");
      }
      cancel();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const toggleActive = async (vt) => {
    if (!editable) return;
    try {
      await updateDoc(doc(db, "vehicleTypes", vt.id), {
        ativo: !vt.ativo,
        updatedAt: serverTimestamp(),
        updatedBy: profile.name,
      });
    } catch (e) { toast.error(e.message); }
  };

  const filtered = useMemo(() => filterCat ? types.filter((t) => t.categoria === filterCat) : types, [types, filterCat]);

  const histType = showHistory ? types.find((t) => t.id === showHistory) : null;

  return (
    <div className="px-4 sm:px-8 py-8 max-w-7xl mx-auto" data-testid="page-vehicle-types">
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-[#708278] font-bold">Medição · Catálogo</div>
          <h1 className="font-[Outfit,sans-serif] text-3xl font-black tracking-tight text-[#0F1411] mt-1">Tipos de Veículo</h1>
          <p className="text-sm text-[#4A564F] mt-1">Configuração de categorias, sub-tipos e valores (mensal, hora extra, dia extra) consumidos pelo Wizard de Requerimentos.</p>
        </div>
        {editable && (
          <button onClick={openNew} data-testid="btn-novo-tipo"
            className="flex items-center gap-2 bg-[#1E3A5F] hover:bg-[#2A4A78] text-white px-5 py-3 rounded-md text-xs font-bold uppercase tracking-[0.15em]">
            <Plus size={16} weight="bold" /> Novo Tipo
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <button onClick={() => setFilterCat("")} className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-[0.1em] ${!filterCat ? "bg-[#1E3A5F] text-white" : "bg-[#E2E8E4] text-[#4A564F]"}`}>Todas ({types.length})</button>
        {EQUIPAMENTO_TIPOS.map((c) => {
          const count = types.filter((t) => t.categoria === c.id).length;
          if (count === 0) return null;
          return (
            <button key={c.id} onClick={() => setFilterCat(c.id)} className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-[0.1em] ${filterCat === c.id ? "bg-[#1E3A5F] text-white" : "bg-[#E2E8E4] text-[#4A564F]"}`}>
              {c.label} ({count})
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-dashed border-[#E2E8E4] rounded-md p-10 text-center">
          <Stack size={40} className="mx-auto text-[#708278]" weight="duotone" />
          <div className="text-sm text-[#4A564F] mt-3">Nenhum tipo cadastrado{filterCat ? " nesta categoria" : ""}.</div>
          {editable && !filterCat && (
            <button onClick={openNew} className="mt-4 text-xs font-bold uppercase tracking-[0.15em] text-[#1E3A5F] hover:underline">
              + Criar primeiro tipo
            </button>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((vt) => (
            <div key={vt.id} className={`bg-white border rounded-md p-4 ${vt.ativo ? "border-[#E2E8E4]" : "border-[#E2E8E4] opacity-60"}`} data-testid={`type-card-${vt.id}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-[0.15em] text-[#708278] font-bold">{EQUIPAMENTO_TIPOS.find((c) => c.id === vt.categoria)?.label || vt.categoria}{vt.subTipo ? ` · ${SUB_TIPOS_LABEL[vt.subTipo]}` : ""}</div>
                  <div className="font-[Outfit,sans-serif] text-lg font-bold text-[#0F1411] truncate">{vt.nome}</div>
                </div>
                {editable && (
                  <button onClick={() => toggleActive(vt)} data-testid={`toggle-${vt.id}`}
                    title={vt.ativo ? "Ativo" : "Inativo"}>
                    {vt.ativo ? <ToggleRight size={28} className="text-[#10B981]" weight="fill" /> : <ToggleLeft size={28} className="text-[#708278]" />}
                  </button>
                )}
              </div>
              <div className="mt-3 space-y-1.5 text-xs">
                <div className="flex justify-between"><span className="text-[#708278]">Mensal</span><span className="font-bold text-[#0F2542]">{formatCurrency(vt.valorMensal)}</span></div>
                <div className="flex justify-between"><span className="text-[#708278]">Hora extra</span><span className="font-bold text-[#0F2542]">{formatCurrency(vt.valorHoraExtra)}</span></div>
                <div className="flex justify-between"><span className="text-[#708278]">Dia extra</span><span className="font-bold text-[#0F2542]">{formatCurrency(vt.valorDiaExtra)}</span></div>
              </div>
              <div className="mt-3 flex gap-2">
                {editable && (
                  <button onClick={() => openEdit(vt)} data-testid={`edit-${vt.id}`}
                    className="flex-1 flex items-center justify-center gap-1 border border-[#1E3A5F] text-[#1E3A5F] hover:bg-[#1E3A5F] hover:text-white py-2 rounded-md text-[10px] font-bold uppercase tracking-[0.1em] transition-all">
                    <Pencil size={12} /> Editar
                  </button>
                )}
                <button onClick={() => setShowHistory(vt.id)} data-testid={`history-${vt.id}`}
                  className="flex items-center justify-center gap-1 border border-[#E2E8E4] text-[#708278] hover:bg-[#F5F7FA] py-2 px-3 rounded-md text-[10px] font-bold uppercase tracking-[0.1em] transition-all">
                  <ClockClockwise size={12} /> Histórico
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL CRIAR/EDITAR */}
      {editing && (
        <div className="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-4 overflow-auto">
          <div className="bg-white rounded-md max-w-lg w-full p-6 my-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-[Outfit,sans-serif] text-xl font-black tracking-tight text-[#0F1411]">
                {editing === "new" ? "Novo Tipo de Veículo" : "Editar Tipo"}
              </h3>
              <button onClick={cancel} className="text-[#708278] hover:text-[#0F2542]"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <FormField l="Nome" required>
                <input value={form.nome} onChange={(e) => set("nome", e.target.value)} data-testid="vt-nome"
                  className="w-full border border-[#E2E8E4] bg-white px-3 py-2.5 rounded-md text-sm focus:outline-none focus:border-[#1E3A5F]"
                  placeholder="Ex: Caminhão Basculante Toco" />
              </FormField>
              <div className="grid sm:grid-cols-2 gap-3">
                <FormField l="Categoria" required>
                  <select value={form.categoria} onChange={(e) => onCategoriaChange(e.target.value)} data-testid="vt-categoria"
                    className="w-full border border-[#E2E8E4] bg-white px-3 py-2.5 rounded-md text-sm focus:outline-none focus:border-[#1E3A5F]">
                    <option value="">Selecione</option>
                    {EQUIPAMENTO_TIPOS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </FormField>
                {subTiposDisponiveis.length > 0 && (
                  <FormField l="Sub-tipo" required>
                    <select value={form.subTipo} onChange={(e) => set("subTipo", e.target.value)} data-testid="vt-subtipo"
                      className="w-full border border-[#E2E8E4] bg-white px-3 py-2.5 rounded-md text-sm focus:outline-none focus:border-[#1E3A5F]">
                      <option value="">Selecione</option>
                      {subTiposDisponiveis.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                  </FormField>
                )}
                <FormField l="Porte (auto)">
                  <select value={form.porte} disabled
                    className="w-full border border-[#E2E8E4] bg-[#F5F7FA] px-3 py-2.5 rounded-md text-sm">
                    <option value="">—</option>
                    {PORTE_VEICULO.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </FormField>
                <FormField l="Medição (auto)">
                  <select value={form.medicao} disabled={catCfg && catCfg.medicao !== "ambos"} onChange={(e) => set("medicao", e.target.value)}
                    className="w-full border border-[#E2E8E4] bg-[#F5F7FA] px-3 py-2.5 rounded-md text-sm">
                    <option value="km">Quilometragem (km)</option>
                    <option value="horimetro">Horímetro (h)</option>
                  </select>
                </FormField>
              </div>
              <div className="border-t border-[#E2E8E4] pt-4">
                <div className="text-[11px] uppercase tracking-[0.2em] font-bold text-[#0F2542] mb-3 flex items-center gap-2">
                  <CurrencyCircleDollar size={14} className="text-[#10B981]" /> Valores
                </div>
                <div className="grid sm:grid-cols-3 gap-3">
                  <FormField l="Mensal (R$)" required>
                    <input type="number" step="0.01" value={form.valorMensal} onChange={(e) => set("valorMensal", e.target.value)} data-testid="vt-valor-mensal"
                      className="w-full border border-[#E2E8E4] bg-white px-3 py-2.5 rounded-md text-sm focus:outline-none focus:border-[#1E3A5F]" placeholder="0,00" />
                  </FormField>
                  <FormField l="Hora extra (R$/h)">
                    <input type="number" step="0.01" value={form.valorHoraExtra} onChange={(e) => set("valorHoraExtra", e.target.value)} data-testid="vt-valor-hora"
                      className="w-full border border-[#E2E8E4] bg-white px-3 py-2.5 rounded-md text-sm focus:outline-none focus:border-[#1E3A5F]" placeholder="0,00" />
                  </FormField>
                  <FormField l="Dia extra (R$/dia)">
                    <input type="number" step="0.01" value={form.valorDiaExtra} onChange={(e) => set("valorDiaExtra", e.target.value)} data-testid="vt-valor-dia"
                      className="w-full border border-[#E2E8E4] bg-white px-3 py-2.5 rounded-md text-sm focus:outline-none focus:border-[#1E3A5F]" placeholder="0,00" />
                  </FormField>
                </div>
                <p className="text-[11px] text-[#708278] italic mt-3">Horário normal: Seg-Qui 7h-17h, Sex 7h-16h. Hora extra e dia extra somam ao mensal.</p>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.ativo !== false} onChange={(e) => set("ativo", e.target.checked)} data-testid="vt-ativo" />
                <span>Tipo ativo (disponível para novos requerimentos)</span>
              </label>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={cancel} className="flex-1 border border-[#E2E8E4] py-3 rounded-md text-xs font-bold uppercase tracking-[0.15em] text-[#4A564F]" data-testid="vt-cancelar">Cancelar</button>
              <button onClick={save} disabled={busy} data-testid="vt-salvar"
                className="flex-1 flex items-center justify-center gap-2 bg-[#10B981] hover:bg-[#059669] text-white py-3 rounded-md text-xs font-bold uppercase tracking-[0.15em] disabled:opacity-50">
                <FloppyDisk size={14} weight="bold" /> Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL HISTÓRICO */}
      {histType && (
        <div className="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-4" onClick={() => setShowHistory(null)}>
          <div className="bg-white rounded-md max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-[#708278] font-bold">Histórico de Valores</div>
                <h3 className="font-bold text-[#0F1411]">{histType.nome}</h3>
              </div>
              <button onClick={() => setShowHistory(null)} className="text-[#708278] hover:text-[#0F2542]"><X size={20} /></button>
            </div>
            <div className="space-y-3 max-h-96 overflow-auto">
              {[...(histType.historicoValores || [])].reverse().map((h, i) => (
                <div key={i} className="bg-[#F5F7FA] border border-[#E2E8E4] rounded-md p-3 text-xs">
                  <div className="flex justify-between text-[10px] uppercase tracking-[0.15em] text-[#708278] font-bold mb-2">
                    <span>{new Date(h.at).toLocaleString("pt-BR")}</span>
                    <span>{h.by}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div><div className="text-[#708278]">Mensal</div><div className="font-bold">{formatCurrency(h.valorMensal)}</div></div>
                    <div><div className="text-[#708278]">H.Extra</div><div className="font-bold">{formatCurrency(h.valorHoraExtra)}</div></div>
                    <div><div className="text-[#708278]">D.Extra</div><div className="font-bold">{formatCurrency(h.valorDiaExtra)}</div></div>
                  </div>
                </div>
              ))}
              {(!histType.historicoValores || histType.historicoValores.length === 0) && (
                <div className="text-sm text-[#708278] text-center py-6">Sem histórico ainda.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FormField({ l, required, children }) {
  return (
    <div>
      <label className="block text-[11px] uppercase tracking-[0.2em] font-bold text-[#708278] mb-1.5">
        {l} {required && <span className="text-[#DC2626]">*</span>}
      </label>
      {children}
    </div>
  );
}
