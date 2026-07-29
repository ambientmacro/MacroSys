import { useEffect, useState } from "react";
import { collection, addDoc, updateDoc, doc, serverTimestamp, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { canManageFuncoes } from "../lib/roles";
import { toast } from "sonner";
import { Plus, Pencil, FloppyDisk, X, UserGear, ToggleLeft, ToggleRight } from "@phosphor-icons/react";

/**
 * CRUD de "Funções / Cargos" — gerenciado pelo perfil PERFORMANCE.
 *
 * Schema (`funcoes` collection):
 *  { id, nome, descricao, ativo, createdAt, updatedAt, createdBy }
 *
 * As funções aparecem como dropdown no Wizard de motorista
 * (`motorista_funcao`) e nos cadastros via Encarregado/DP.
 */
export default function FuncoesAdmin() {
  const { profile } = useAuth();
  const editable = canManageFuncoes(profile.role);
  const [funcoes, setFuncoes] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ nome: "", descricao: "", ativo: true });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "funcoes"), (snap) => {
      const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      arr.sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
      setFuncoes(arr);
    });
    return () => unsub();
  }, []);

  const cancel = () => { setEditing(null); setForm({ nome: "", descricao: "", ativo: true }); };
  const openNew = () => { setForm({ nome: "", descricao: "", ativo: true }); setEditing("new"); };
  const openEdit = (f) => { setForm({ nome: f.nome || "", descricao: f.descricao || "", ativo: f.ativo !== false }); setEditing(f.id); };

  const save = async () => {
    if (!form.nome.trim()) return toast.error("Informe o nome da função.");
    setBusy(true);
    try {
      const payload = {
        nome: form.nome.trim(),
        descricao: form.descricao.trim(),
        ativo: form.ativo !== false,
        updatedAt: serverTimestamp(),
        updatedBy: profile.name,
      };
      if (editing === "new") {
        await addDoc(collection(db, "funcoes"), { ...payload, createdAt: serverTimestamp(), createdBy: profile.name });
        toast.success("Função criada.");
      } else {
        await updateDoc(doc(db, "funcoes", editing), payload);
        toast.success("Função atualizada.");
      }
      cancel();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const toggleActive = async (f) => {
    if (!editable) return;
    try {
      await updateDoc(doc(db, "funcoes", f.id), { ativo: !f.ativo, updatedAt: serverTimestamp() });
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="px-4 sm:px-8 py-8 max-w-5xl mx-auto" data-testid="page-funcoes">
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-[#708278] font-bold">Performance · Organização</div>
          <h1 className="font-[Outfit,sans-serif] text-3xl font-black tracking-tight text-[#0F1411] mt-1">Funções / Cargos</h1>
          <p className="text-sm text-[#4A564F] mt-1">Catálogo de funções utilizadas no cadastro de motoristas.</p>
        </div>
        {editable && (
          <button onClick={openNew} data-testid="btn-nova-funcao"
            className="flex items-center gap-2 bg-[#1E3A5F] hover:bg-[#2A4A78] text-white px-5 py-3 rounded-md text-xs font-bold uppercase tracking-[0.15em]">
            <Plus size={16} weight="bold" /> Nova Função
          </button>
        )}
      </div>

      {funcoes.length === 0 ? (
        <div className="bg-white border border-dashed border-[#E2E8E4] rounded-md p-10 text-center">
          <UserGear size={40} className="mx-auto text-[#708278]" weight="duotone" />
          <div className="text-sm text-[#4A564F] mt-3">Nenhuma função cadastrada ainda.</div>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {funcoes.map((f) => (
            <div key={f.id} className={`bg-white border rounded-md p-4 ${f.ativo ? "border-[#E2E8E4]" : "border-[#E2E8E4] opacity-60"}`} data-testid={`funcao-${f.id}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-[Outfit,sans-serif] text-lg font-bold text-[#0F1411]">{f.nome}</div>
                  {f.descricao && <div className="text-xs text-[#4A564F] mt-1">{f.descricao}</div>}
                </div>
                {editable && (
                  <button onClick={() => toggleActive(f)} data-testid={`toggle-${f.id}`} title={f.ativo ? "Ativo" : "Inativo"}>
                    {f.ativo ? <ToggleRight size={28} className="text-[#10B981]" weight="fill" /> : <ToggleLeft size={28} className="text-[#708278]" />}
                  </button>
                )}
              </div>
              {editable && (
                <button onClick={() => openEdit(f)} data-testid={`edit-${f.id}`}
                  className="mt-3 flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[#1E3A5F] hover:underline">
                  <Pencil size={12} /> Editar
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-md max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-[Outfit,sans-serif] text-xl font-black tracking-tight text-[#0F1411]">
                {editing === "new" ? "Nova Função" : "Editar Função"}
              </h3>
              <button onClick={cancel} className="text-[#708278] hover:text-[#0F2542]"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] uppercase tracking-[0.2em] font-bold text-[#708278] mb-1.5">Nome *</label>
                <input value={form.nome} onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
                  data-testid="funcao-nome"
                  className="w-full border border-[#E2E8E4] bg-white px-3 py-2.5 rounded-md text-sm focus:outline-none focus:border-[#1E3A5F]"
                  placeholder="Ex: Operador de Retroescavadeira" />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-[0.2em] font-bold text-[#708278] mb-1.5">Descrição (opcional)</label>
                <textarea value={form.descricao} onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))}
                  data-testid="funcao-descricao" rows={3}
                  className="w-full border border-[#E2E8E4] bg-white px-3 py-2.5 rounded-md text-sm focus:outline-none focus:border-[#1E3A5F]" />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.ativo} onChange={(e) => setForm((p) => ({ ...p, ativo: e.target.checked }))} />
                <span>Função ativa</span>
              </label>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={cancel} className="flex-1 border border-[#E2E8E4] py-3 rounded-md text-xs font-bold uppercase tracking-[0.15em] text-[#4A564F]">Cancelar</button>
              <button onClick={save} disabled={busy} data-testid="funcao-salvar"
                className="flex-1 flex items-center justify-center gap-2 bg-[#10B981] hover:bg-[#059669] text-white py-3 rounded-md text-xs font-bold uppercase tracking-[0.15em] disabled:opacity-50">
                <FloppyDisk size={14} weight="bold" /> Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
