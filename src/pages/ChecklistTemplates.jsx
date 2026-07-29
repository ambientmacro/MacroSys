import { useEffect, useState } from "react";
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { canActAsSeguranca } from "../lib/roles";
import { CHECKLIST_ITEM_TYPES, EQUIPAMENTO_TIPOS, SUB_TIPOS_LABEL } from "../lib/constants";
import { toast } from "sonner";
import { Plus, Trash, Stack, FloppyDisk, PencilSimple } from "@phosphor-icons/react";
import Pagination, { usePagination } from "../components/Pagination";

export default function ChecklistTemplates() {
  const { profile } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [vehicleTypes, setVehicleTypes] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  // Template agora vincula-se a UM tipo de veículo (catálogo Medição).
  // Editar 1 template impacta TODOS os veículos do mesmo tipo automaticamente.
  const [form, setForm] = useState({ name: "", vehicleTypeId: "", items: [] });
  const canEdit = canActAsSeguranca(profile?.role);

  useEffect(() => {
    const u1 = onSnapshot(query(collection(db, "checklistTemplates"), orderBy("createdAt", "desc")), (snap) => {
      setTemplates(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const u2 = onSnapshot(query(collection(db, "vehicleTypes"), where("ativo", "==", true)), (snap) => {
      const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      arr.sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
      setVehicleTypes(arr);
    });
    return () => { u1(); u2(); };
  }, []);

  const resetForm = () => { setForm({ name: "", vehicleTypeId: "", items: [] }); setEditingId(null); setShowForm(false); };

  const startEdit = (t) => {
    setForm({
      name: t.name,
      vehicleTypeId: t.vehicleTypeId || "",
      items: (t.items || []).map((it) => ({ ...it, defaultEnabled: it.defaultEnabled || false, allowPhoto: it.allowPhoto || false })),
    });
    setEditingId(t.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const addItem = () => setForm((p) => ({ ...p, items: [...p.items, { id: `i_${Date.now()}_${p.items.length}`, type: "checkbox", label: "", required: false, allowPhoto: false, defaultEnabled: false }] }));
  const updateItem = (i, k, v) => setForm((p) => ({ ...p, items: p.items.map((it, idx) => idx === i ? { ...it, [k]: v } : it) }));
  const removeItem = (i) => setForm((p) => ({ ...p, items: p.items.filter((_, idx) => idx !== i) }));

  // Chave canônica para uniqueness: nome normalizado (case-insensitive).
  // Regra: 1 template por NOME (= 1 por tipo de equipamento).
  const buildNameKey = (name) => name.trim().toLowerCase().replace(/\s+/g, " ");

  const save = async () => {
    if (!form.name || form.items.length === 0) { toast.error("Informe nome e ao menos 1 item."); return; }
    if (!form.vehicleTypeId) { toast.error("Vincule o template a um Tipo de Veículo do catálogo Medição."); return; }
    try {
      const nameKey = buildNameKey(form.name);
      // Uniqueness por tipo de veículo: 1 template por tipo.
      const dupByType = templates.find((t) => t.vehicleTypeId === form.vehicleTypeId && t.id !== editingId);
      if (dupByType) {
        toast.error(`O tipo selecionado já tem um template ("${dupByType.name}").`,
          { description: "Edite o existente em vez de criar um novo. 1 template = 1 tipo." });
        return;
      }
      // Captura categoria + sub-tipo do vehicleType para acelerar resolução fallback.
      const vt = vehicleTypes.find((v) => v.id === form.vehicleTypeId);
      const payload = {
        name: form.name.trim(),
        nameKey,
        vehicleTypeId: form.vehicleTypeId,
        // Campos denormalizados para resolução por categoria (legados/sem vehicleTypeId):
        categoria: vt?.categoria || null,
        subTipo: vt?.subTipo || null,
        vehicleTypeNome: vt?.nome || null,
        kind: "diario",
        items: form.items,
      };
      if (editingId) {
        await updateDoc(doc(db, "checklistTemplates", editingId), {
          ...payload,
          updatedAt: serverTimestamp(),
          updatedBy: profile.name,
          // Editar conta como revisão (Segurança ajustou itens → conhece o template).
          lastReviewedAt: serverTimestamp(),
          lastReviewedBy: profile.name,
        });
        toast.success("Template atualizado — aplicado a todos os veículos deste tipo.");
      } else {
        await addDoc(collection(db, "checklistTemplates"), {
          ...payload,
          createdAt: serverTimestamp(),
          createdBy: profile.name,
          lastReviewedAt: serverTimestamp(),
          lastReviewedBy: profile.name,
        });
        toast.success("Template criado — vinculado ao tipo.");
      }
      resetForm();
    } catch (e) { toast.error(e.message); }
  };

  const remove = async (id) => {
    if (!window.confirm("Excluir template?")) return;
    await deleteDoc(doc(db, "checklistTemplates", id));
  };

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <div className="flex justify-between items-end gap-4 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-[#708278] font-bold">Configuração</div>
          <h1 className="font-[Outfit,sans-serif] text-3xl font-black tracking-tight text-[#0F1411] mt-2">Templates de Checklist</h1>
          <p className="text-sm text-[#4A564F] mt-2">Crie um template por tipo de equipamento (ex.: <strong>Retroescavadeira</strong>, <strong>Caminhão Toco</strong>). O mesmo template é usado na Vistoria de Entrada e no checklist diário.</p>
        </div>
        {canEdit && (
          <button onClick={() => showForm ? resetForm() : setShowForm(true)} data-testid="btn-novo-template"
            className="flex items-center gap-2 bg-[#1E3A5F] text-white px-5 py-3 rounded-md text-sm font-bold uppercase tracking-[0.1em] hover:bg-[#2A4A78] transition-all">
            <Plus size={16} /> {showForm ? "Cancelar" : "Novo Template"}
          </button>
        )}
      </div>

      {showForm && (
        <div className="mt-6 bg-white border border-[#E2E8E4] rounded-md p-6 space-y-4">
          <h3 className="text-lg font-bold text-[#0F2542] font-[Outfit,sans-serif]">{editingId ? "Editar Template" : "Novo Template"}</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] uppercase tracking-[0.2em] font-bold text-[#708278] block mb-1.5">Nome do template *</label>
              <input data-testid="tpl-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex.: Checklist Retroescavadeira"
                className="w-full border border-[#E2E8E4] px-4 py-3 rounded-md text-sm focus:outline-none focus:border-[#1E3A5F]" />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-[0.2em] font-bold text-[#708278] block mb-1.5">Tipo de Veículo (catálogo Medição) *</label>
              <select data-testid="tpl-vehicle-type" value={form.vehicleTypeId} onChange={(e) => setForm({ ...form, vehicleTypeId: e.target.value })}
                className="w-full border border-[#E2E8E4] px-4 py-3 rounded-md text-sm focus:outline-none focus:border-[#1E3A5F]">
                <option value="">— Selecione —</option>
                {vehicleTypes.map((vt) => (
                  <option key={vt.id} value={vt.id}>{vt.nome}{vt.subTipo ? ` · ${SUB_TIPOS_LABEL[vt.subTipo]}` : ""}</option>
                ))}
              </select>
              <div className="text-[11px] text-[#708278] mt-1.5 italic">
                Editar este template afeta <strong>todos os veículos</strong> deste tipo simultaneamente.
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase tracking-[0.2em] font-bold text-[#708278]">Itens do checklist</div>
              <button onClick={addItem} data-testid="tpl-add-item" className="text-xs font-bold text-[#1E3A5F] flex items-center gap-1"><Plus size={14} /> Adicionar item</button>
            </div>
            <div className="mt-3 space-y-2">
              {form.items.map((it, i) => (
                <div key={it.id} className="border border-[#E2E8E4] rounded-md p-3 space-y-2">
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <input data-testid={`tpl-item-label-${i}`} placeholder="Texto do item (ex: Pneus em bom estado)" value={it.label} onChange={(e) => updateItem(i, "label", e.target.value)}
                      className="col-span-12 sm:col-span-8 border border-[#E2E8E4] px-3 py-2 rounded-md text-sm focus:outline-none focus:border-[#1E3A5F]" />
                    <select value={it.type} onChange={(e) => updateItem(i, "type", e.target.value)}
                      className="col-span-10 sm:col-span-3 border border-[#E2E8E4] px-3 py-2 rounded-md text-sm focus:outline-none focus:border-[#1E3A5F]">
                      {CHECKLIST_ITEM_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                    </select>
                    <button onClick={() => removeItem(i)} data-testid={`tpl-item-rm-${i}`} className="col-span-2 sm:col-span-1 text-[#C25D41] flex justify-center"><Trash size={18} /></button>
                  </div>
                  <div className="flex flex-wrap gap-4 pt-1 pl-1">
                    <label className="flex items-center gap-2 text-xs font-bold text-[#4A564F] cursor-pointer">
                      <input type="checkbox" checked={it.required} onChange={(e) => updateItem(i, "required", e.target.checked)} data-testid={`tpl-item-req-${i}`}
                        className="w-4 h-4 accent-[#2563EB]" />
                      Obrigatório
                    </label>
                    <label className="flex items-center gap-2 text-xs font-bold text-[#4A564F] cursor-pointer">
                      <input type="checkbox" checked={it.allowPhoto || false} onChange={(e) => updateItem(i, "allowPhoto", e.target.checked)} data-testid={`tpl-item-photo-${i}`}
                        className="w-4 h-4 accent-[#2563EB]" />
                      Permitir foto
                    </label>
                    {it.type === "checkbox" && (
                      <label className="flex items-center gap-2 text-xs font-bold text-[#10B981] cursor-pointer" title="Item já virá marcado como Conforme quando alguém preencher o checklist.">
                        <input type="checkbox" checked={it.defaultEnabled || false} onChange={(e) => updateItem(i, "defaultEnabled", e.target.checked)} data-testid={`tpl-item-default-${i}`}
                          className="w-4 h-4 accent-[#10B981]" />
                        Habilitado por padrão (vem pré-marcado como Conforme)
                      </label>
                    )}
                  </div>
                </div>
              ))}
              {form.items.length === 0 && <div className="text-sm text-[#708278] italic">Nenhum item adicionado.</div>}
            </div>
          </div>

          <button onClick={save} data-testid="tpl-save"
            className="flex items-center gap-2 bg-[#1E3A5F] text-white px-6 py-3 rounded-md text-sm font-bold uppercase tracking-[0.1em] hover:bg-[#2A4A78]">
            <FloppyDisk size={16} /> {editingId ? "Atualizar Template" : "Salvar Template"}
          </button>
        </div>
      )}

      <TemplatesGrid templates={templates} canEdit={canEdit} startEdit={startEdit} remove={remove} />
    </div>
  );
}

function TemplatesGrid({ templates, canEdit, startEdit, remove }) {
  // Lista pequena → 10/pág default.
  const { paged, ...pag } = usePagination(templates, { defaultPerPage: 10 });
  return (
    <>
      <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {paged.map((t) => (
          <div key={t.id} className="bg-white border border-[#E2E8E4] rounded-md p-5 flex flex-col" data-testid={`tpl-card-${t.id}`}>
            <div className="flex items-start justify-between">
              <Stack size={22} className="text-[#1E3A5F]" weight="duotone" />
              {canEdit && (
                <div className="flex items-center gap-2">
                  <button onClick={() => startEdit(t)} data-testid={`tpl-edit-${t.id}`}
                    title="Editar template"
                    className="text-[#2563EB] hover:bg-[#EFF3F8] p-1 rounded">
                    <PencilSimple size={16} />
                  </button>
                  <button onClick={() => remove(t.id)} data-testid={`tpl-del-${t.id}`}
                    title="Excluir template"
                    className="text-[#C25D41] hover:bg-[#C25D41]/10 p-1 rounded">
                    <Trash size={16} />
                  </button>
                </div>
              )}
            </div>
            <div className="mt-3 font-bold text-[#0F1411]">{t.name}</div>
            {t.vehicleTypeNome ? (
              <div className="text-[10px] uppercase tracking-[0.15em] font-bold text-[#2563EB] mt-1">Tipo: {t.vehicleTypeNome}</div>
            ) : (
              <div className="text-[10px] uppercase tracking-[0.15em] font-bold text-[#D9A05B] mt-1">Sem tipo vinculado</div>
            )}
            <div className="text-xs text-[#708278] mt-1 uppercase tracking-[0.1em] font-bold">{t.items?.length || 0} itens</div>
            {canEdit && (
              <button onClick={() => startEdit(t)} data-testid={`tpl-edit-link-${t.id}`}
                className="mt-4 text-xs uppercase tracking-[0.15em] font-bold text-[#2563EB] hover:underline self-start">
                Editar itens →
              </button>
            )}
          </div>
        ))}
        {templates.length === 0 && <div className="col-span-full border border-dashed border-[#E2E8E4] rounded-md p-10 text-center text-sm text-[#708278]">Nenhum template criado.</div>}
      </div>
      <Pagination {...pag} testid="templates-pag" />
    </>
  );
}
