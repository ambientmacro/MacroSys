import { useEffect, useMemo, useState } from "react";
import {
  collection, addDoc, updateDoc, deleteDoc, doc, getDocs, onSnapshot,
  orderBy, query, serverTimestamp, writeBatch, where,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { ROLES, ROLE_LABELS } from "../lib/constants";
import { toast } from "sonner";
import {
  Stack, Plus, Trash, FloppyDisk, Users, UserCircle, IdentificationCard, X,
} from "@phosphor-icons/react";
import Pagination, { usePagination } from "../components/Pagination";

const inp = "w-full border border-[#E2E8E4] bg-white px-4 py-3 rounded-md text-sm text-[#0F1411] focus:outline-none focus:border-[#2563EB] focus:border-2 transition-all";

export default function TeamsAdmin() {
  const { profile } = useAuth();
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", leaderUserId: "", memberUserIds: [], memberDriverIds: [] });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsubT = onSnapshot(query(collection(db, "teams"), orderBy("name")), (snap) => {
      setTeams(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    (async () => {
      const [u, d] = await Promise.all([
        getDocs(collection(db, "users")),
        getDocs(collection(db, "drivers")),
      ]);
      setUsers(u.docs.map((x) => ({ id: x.id, ...x.data() })));
      setDrivers(d.docs.map((x) => ({ id: x.id, ...x.data() })));
    })();
    return () => unsubT();
  }, []);

  const driversNoLogin = useMemo(() => {
    return drivers.filter((d) => !d.userId);
  }, [drivers]);

  const leaders = useMemo(() => users.filter((u) => u.role === ROLES.ENCARREGADO || u.role === ROLES.ADMIN), [users]);
  const motoristaUsers = useMemo(() => users.filter((u) => u.role === ROLES.MOTORISTA), [users]);


  const totalSelecionados = useMemo(() => {
    const ids = new Set([
      ...(form.memberUserIds || []),
      ...(form.memberDriverIds || []),
    ]);

    // adiciona o encarregado se existir
    if (form.leaderUserId) {
      ids.add(form.leaderUserId);
    }

    return ids.size;
  }, [form]);

  const reset = () => {
    setForm({ name: "", leaderUserId: "", memberUserIds: [], memberDriverIds: [] });
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (t) => {
    setEditingId(t.id);
    setForm({
      name: t.name || "",
      leaderUserId: t.leaderUserId || "",
      memberUserIds: t.memberUserIds || [],
      memberDriverIds: t.memberDriverIds || [],
    });
    setShowForm(true);
  };

  const toggleArr = (key, id) => {
    setForm((p) => {
      const arr = p[key] || [];
      return { ...p, [key]: arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id] };
    });
  };

  const cascadeTeamId = async (teamId, prevDoc) => {
    // Update users.teamId and drivers.teamId so encarregado can filter quickly.
    const batch = writeBatch(db);
    const prevUserIds = prevDoc?.memberUserIds || [];
    const prevDriverIds = prevDoc?.memberDriverIds || [];
    // Removed users → clear teamId if it still matches
    prevUserIds.filter((u) => !form.memberUserIds.includes(u)).forEach((uid) => {
      batch.update(doc(db, "users", uid), { teamId: null });
    });
    prevDriverIds.filter((d) => !form.memberDriverIds.includes(d)).forEach((did) => {
      batch.update(doc(db, "drivers", did), { teamId: null });
    });
    // Added/kept users → set teamId
    form.memberUserIds.forEach((uid) => batch.update(doc(db, "users", uid), { teamId }));
    form.memberDriverIds.forEach((did) => batch.update(doc(db, "drivers", did), { teamId }));
    // Leader also gets teamId
    if (form.leaderUserId) batch.update(doc(db, "users", form.leaderUserId), { teamId });
    await batch.commit();
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error("Informe o nome da equipe.");
    if (!form.leaderUserId) return toast.error("Selecione o encarregado responsável.");
    setBusy(true);
    try {
      const leader = users.find((u) => u.id === form.leaderUserId);
      const payload = {
        name: form.name.trim(),
        leaderUserId: form.leaderUserId,
        leaderName: leader?.name || leader?.email || "",
        memberUserIds: form.memberUserIds,
        memberDriverIds: form.memberDriverIds,
        updatedAt: serverTimestamp(),
        updatedBy: profile.name,
      };
      let teamId;
      let prevDoc = null;
      if (editingId) {
        prevDoc = teams.find((t) => t.id === editingId);
        await updateDoc(doc(db, "teams", editingId), payload);
        teamId = editingId;
      } else {
        const ref = await addDoc(collection(db, "teams"), {
          ...payload,
          createdAt: serverTimestamp(),
          createdBy: profile.name,
        });
        teamId = ref.id;
      }
      await cascadeTeamId(teamId, prevDoc);
      toast.success(editingId ? "Equipe atualizada." : "Equipe criada.");
      reset();
    } catch (e) {
      toast.error(e.message);
    } finally { setBusy(false); }
  };

  const remove = async (t) => {
    if (!confirm(`Excluir a equipe "${t.name}"? Os vínculos dos membros serão removidos.`)) return;
    try {
      const batch = writeBatch(db);
      (t.memberUserIds || []).forEach((uid) => batch.update(doc(db, "users", uid), { teamId: null }));
      (t.memberDriverIds || []).forEach((did) => batch.update(doc(db, "drivers", did), { teamId: null }));
      if (t.leaderUserId) batch.update(doc(db, "users", t.leaderUserId), { teamId: null });
      await batch.commit();
      await deleteDoc(doc(db, "teams", t.id));
      toast.success("Equipe excluída.");
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-[#708278] font-bold">Departamento Pessoal</div>
          <h1 className="font-[Outfit,sans-serif] text-3xl font-black tracking-tight text-[#0F1411] mt-2 flex items-center gap-3">
            <Stack size={28} weight="duotone" className="text-[#2563EB]" /> Equipes
          </h1>
          <p className="text-sm text-[#4A564F] mt-2">Agrupe encarregados, motoristas e colaboradores em equipes operacionais (ex.: <em>Asfalto</em>, <em>Drenagem</em>). O encarregado só visualiza os requerimentos e checklists da sua equipe.</p>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)} data-testid="btn-nova-equipe"
            className="flex items-center gap-2 bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] text-white px-5 py-3 rounded-md text-sm font-bold uppercase tracking-[0.1em] hover:from-[#1D4ED8] hover:to-[#1E40AF] shadow-md shadow-blue-900/20">
            <Plus size={16} weight="bold" /> Nova Equipe
          </button>
        )}
      </div>

      {showForm && (
        <div className="mt-8 bg-white border border-[#E2E8E4] rounded-md p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-[#0F2542] font-[Outfit,sans-serif]">{editingId ? "Editar Equipe" : "Nova Equipe"}</h3>
            <button onClick={reset} className="text-[#708278] hover:text-[#0F1411]"><X size={20} /></button>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field l="Nome da equipe">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex.: Equipe Asfalto" className={inp} data-testid="team-name" />
            </Field>
            <Field l="Encarregado responsável" hint="Apenas usuários com perfil Encarregado ou Admin.">
              <select value={form.leaderUserId} onChange={(e) => setForm({ ...form, leaderUserId: e.target.value })}
                className={inp} data-testid="team-leader">
                <option value="">— Selecione —</option>
                {leaders.map((u) => <option key={u.id} value={u.id}>{u.name || u.email} ({ROLE_LABELS[u.role]})</option>)}
              </select>
            </Field>
          </div>

          <div className="text-xs font-bold text-[#0F2542]">
            Total selecionados: {totalSelecionados}
          </div>

          <div className="grid md:grid-cols-2 gap-5 pt-4 border-t border-[#E2E8E4]">
            <PickerList
              title="Motoristas (usuários do sistema)"
              icon={<UserCircle size={18} className="text-[#2563EB]" weight="duotone" />}
              items={motoristaUsers}
              labelFor={(u) => u.name || u.email}
              metaFor={(u) => u.phone || u.email}
              selected={form.memberUserIds}
              onToggle={(id) => toggleArr("memberUserIds", id)}
              empty="Nenhum motorista com login cadastrado."
              testid="team-userlist"
            />

            {/* Está vindo todo ao invés de somente os pré-cadastro */}
            <PickerList
              title="Motoristas (sem login — pré-cadastro)"
              icon={<IdentificationCard size={18} className="text-[#2563EB]" weight="duotone" />}
              items={driversNoLogin}
              labelFor={(d) => d.name}
              metaFor={(d) => d.cnh ? `CNH ${d.cnh}` : d.phone || ""}
              selected={form.memberDriverIds}
              onToggle={(id) => toggleArr("memberDriverIds", id)}
              empty="Nenhum motorista pré-cadastrado."
              testid="team-driverlist"
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-[#E2E8E4]">
            <button onClick={save} disabled={busy} data-testid="team-save"
              className="flex items-center gap-2 bg-[#0F2542] text-white px-6 py-3 rounded-md text-sm font-bold uppercase tracking-[0.1em] hover:bg-[#16294A] disabled:opacity-60">
              <FloppyDisk size={16} /> {busy ? "Salvando…" : "Salvar"}
            </button>
            <button onClick={reset}
              className="border border-[#E2E8E4] text-[#4A564F] px-6 py-3 rounded-md text-sm font-bold uppercase tracking-[0.1em] hover:bg-[#F5F7FA]">
              Cancelar
            </button>
          </div>
        </div>
      )}

      <TeamsListSection teams={teams} editingId={editingId} totalSelecionados={totalSelecionados} startEdit={startEdit} remove={remove} />
    </div>
  );
}

function TeamsListSection({ teams, editingId, totalSelecionados, startEdit, remove }) {
  // Lista pequena → 10/pág default.
  const { paged, ...pag } = usePagination(teams, { defaultPerPage: 10 });
  return (
    <div className="mt-8 space-y-2">
      {teams.length === 0 && (
        <div className="border border-dashed border-[#E2E8E4] rounded-md p-10 text-center">
          <Users size={32} className="mx-auto text-[#708278]" weight="duotone" />
          <div className="text-sm text-[#4A564F] mt-2">Nenhuma equipe criada ainda.</div>
        </div>
      )}
      {paged.map((t) => (
          <div
            key={t.id}
            data-testid={`team-${t.id}`}
            className="bg-white border border-[#E2E8E4] rounded-md p-5 flex items-center justify-between gap-4 hover:border-[#2563EB]/40 transition-all"
          >
            <div className="flex-1">
              <div className="font-[Outfit,sans-serif] text-lg font-bold tracking-tight text-[#0F1411]">
                {t.name}
              </div>

              <div className="text-xs text-[#708278] mt-0.5 flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-1">
                  <UserCircle size={12} />
                  Encarregado:{" "}
                  <b className="text-[#0F2542]">{t.leaderName || "—"}</b>
                </span>

                <span>·</span>

                <span>
                  {editingId === t.id
                    ? totalSelecionados
                    : (() => {
                      const total =
                        (t.memberUserIds?.length || 0) +
                        (t.memberDriverIds?.length || 0) +
                        (t.leaderUserId ? 1 : 0);

                      return total === 0 ? 1 : total;
                    })()} membros
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => startEdit(t)}
                data-testid={`team-edit-${t.id}`}
                className="border border-[#E2E8E4] text-[#0F2542] px-4 py-2 rounded-md text-xs font-bold uppercase tracking-[0.1em] hover:bg-[#F5F7FA]"
              >
                Editar
              </button>

              <button
                onClick={() => remove(t)}
                data-testid={`team-del-${t.id}`}
                className="border border-[#C25D41]/40 text-[#8B3A26] px-3 py-2 rounded-md text-xs font-bold uppercase tracking-[0.1em] hover:bg-[#C25D41]/10"
              >
                <Trash size={14} />
              </button>
            </div>
          </div>
        ))}
      <Pagination {...pag} testid="teams-pag" />
    </div>
  );
}

function Field({ l, hint, children }) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-[0.2em] font-bold text-[#708278] block mb-1.5">{l}</label>
      {children}
      {hint && <div className="text-[11px] text-[#708278] mt-1 italic">{hint}</div>}
    </div>
  );
}

function PickerList({ title, icon, items, labelFor, metaFor, selected, onToggle, empty, testid }) {
  return (
    <div className="bg-[#F5F7FA] border border-[#E2E8E4] rounded-md p-4">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h4 className="text-xs uppercase tracking-[0.2em] font-bold text-[#0F2542]">{title}</h4>
        <span className="ml-auto text-[10px] uppercase tracking-[0.15em] font-bold text-[#708278]">{selected.length} sel.</span>
      </div>
      <div className="space-y-1 max-h-64 overflow-y-auto" data-testid={testid}>
        {items.length === 0 && <div className="text-xs text-[#708278] italic py-3">{empty}</div>}
        {items.map((it) => {
          const checked = selected.includes(it.id);
          return (
            <label key={it.id}
              className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer text-sm transition-all ${checked ? "bg-[#2563EB]/10 border border-[#2563EB]/40" : "border border-transparent hover:bg-white"}`}>
              <input type="checkbox" checked={checked} onChange={() => onToggle(it.id)} className="accent-[#2563EB]" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[#0F1411] truncate">{labelFor(it)}</div>
                <div className="text-[11px] text-[#708278] truncate">{metaFor(it)}</div>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
