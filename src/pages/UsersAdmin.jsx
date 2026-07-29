// =============================================================================
// pages/UsersAdmin.jsx — Gestão de usuários do sistema
// -----------------------------------------------------------------------------
// Esta tela atende QUATRO perfis com escopos diferentes:
//
//   ADMIN (TI):         vê tudo, cria qualquer perfil, aprova, edita roles.
//   ENCARREGADO/FROTA:  vê só MOTORISTAS — restritos à(s) sua(s) equipe(s).
//   DP:                 vê todos os MOTORISTAS, sem restrição de equipe.
//
// FUNÇÕES DA TELA
//
//   1. CRIAR LOGIN para motorista JÁ APROVADO pelo DP.
//      Esta é a regra principal: o motorista entrou via Requerimento, o DP
//      aprovou (status ∈ {ACTIVE, NO_LOGIN_USER} + approvedAt), e agora o
//      gestor precisa entregar o acesso ao sistema.
//      Opções de identificador:
//        a) E-MAIL (Firebase Auth nativo, reset de senha pelo Firebase)
//        b) MATRÍCULA 7 dígitos (sistema interno → pseudo-email transparente)
//
//   2. CRIAR USUÁRIO DO ZERO (exceção administrativa — Admin e Encarregado).
//      Pula o fluxo do DP. Documentado no banner amarelo.
//
//   3. APROVAR / REJEITAR / EDITAR ROLE (apenas Admin).
// =============================================================================

import { useEffect, useMemo, useState } from "react";
import {
  collection, doc, onSnapshot, orderBy, query, setDoc, updateDoc, deleteDoc,
  serverTimestamp, getDoc, getDocs, where,
} from "firebase/firestore";
import { createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { db, secondaryAuth } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { ROLE_LABELS, USER_STATUS, ROLES, DRIVER_STATUS } from "../lib/constants";
import { filterOperationalDrivers } from "../lib/drivers";
import {
  matriculaToPseudoEmail, isMatricula, describeIdentifier, MATRICULA_DOMAIN,
} from "../lib/auth-identifier";
import { toast } from "sonner";
import {
  User, CheckCircle, XCircle, Plus, Trash, Info, Key, IdentificationCard,
  EnvelopeSimple, X, UserGear, UserCircle, ShieldCheck,
} from "@phosphor-icons/react";
import Pagination, { usePagination } from "../components/Pagination";

const inp = "w-full border border-[#E2E8E4] bg-white px-4 py-3 rounded-md text-sm text-[#0F1411] focus:outline-none focus:border-[#2563EB] focus:border-2 transition-all";

// =============================================================================
// Helpers de espelhamento driver ⇄ user
// =============================================================================

/**
 * Garante que existe documento em `drivers/<userId>` ESPELHANDO um user que
 * foi criado direto via "criar do zero" (exceção administrativa).
 *
 * Quando o admin cria do nada um login com role=MOTORISTA, o sistema precisa
 * de um driver operacional já aprovado — senão o motorista não aparece em
 * checklists. Para motoristas que já vieram via Requerimento + DP (caminho
 * padrão), use `linkLoginToExistingDriver` em vez disto.
 */
async function ensureDriverMirror(userId, { name, phone, email, adminName, loginType, matricula }) {
  const ref = doc(db, "drivers", userId);
  const snap = await getDoc(ref);
  const payload = {
    name,
    phone: phone || "",
    email: email || "",
    matricula: matricula || null,
    loginType: loginType || "email",
    hasLogin: true,
    userId,
    status: DRIVER_STATUS.ACTIVE,
    approvedAt: serverTimestamp(),
    approvedBy: `Admin (${adminName || "criação direta"})`,
    updatedAt: serverTimestamp(),
  };
  if (snap.exists()) await updateDoc(ref, payload);
  else await setDoc(ref, { ...payload, createdAt: serverTimestamp() });
}

/**
 * Vincula o login Firebase recém-criado a um driver que JÁ EXISTE (aprovado
 * pelo DP via Requerimento). Atualiza o driver com `hasLogin: true`, `userId`,
 * e dados do identificador. Status do driver vira ACTIVE.
 */
async function linkLoginToExistingDriver(driverId, { userId, email, loginType, matricula, adminName }) {
  await updateDoc(doc(db, "drivers", driverId), {
    hasLogin: true,
    userId,
    email: email || null,
    matricula: matricula || null,
    loginType: loginType || "email",
    status: DRIVER_STATUS.ACTIVE,
    linkedLoginAt: serverTimestamp(),
    linkedLoginBy: adminName,
    updatedAt: serverTimestamp(),
  });
}

// =============================================================================
// Componente principal
// =============================================================================
export default function UsersAdmin() {
  const { profile } = useAuth();
  const isAdmin = profile.role === ROLES.ADMIN;
  const isEncarregado = profile.role === ROLES.ENCARREGADO;
  const isFrota = profile.role === ROLES.FROTA;
  const isDP = profile.role === ROLES.DP;
  // DP é coadministrador: gestão completa de usuários (sem precisar ser TI).
  const canManageUsers = isAdmin || isDP;
  // Quem tem permissão de criar do zero (exceção administrativa):
  const canCreateFromScratch = isAdmin || isDP || isEncarregado;
  // Quem precisa de filtro por equipe (vê só motoristas das suas equipes):
  const needsTeamFilter = isEncarregado || isFrota;

  const [users, setUsers] = useState([]);
  const [drivers, setDrivers] = useState([]); // motoristas operacionais (aprovados pelo DP)
  const [myTeams, setMyTeams] = useState([]); // equipes do usuário logado (encarregado/frota)
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: ROLES.MOTORISTA, phone: "" });
  const [busy, setBusy] = useState(false);

  // Modal "Criar login" (para driver já aprovado)
  const [loginModal, setLoginModal] = useState(null); // { driver }

  // ---- Carrega usuários do sistema ----
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "users"), orderBy("createdAt", "desc")), (snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // Encarregado/Frota só enxergam motoristas — DP/Admin veem todos os
      // usuários do sistema (gerenciar acessos é responsabilidade compartilhada).
      setUsers(canManageUsers ? all : all.filter((u) => u.role === ROLES.MOTORISTA));
    });
    return () => unsub();
  }, [canManageUsers]);

  // ---- Carrega motoristas operacionais (aprovados pelo DP, com ou sem login) ----
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "drivers"), (snap) => {
      const raw = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setDrivers(filterOperationalDrivers(raw));
    });
    return () => unsub();
  }, []);

  // ---- Carrega equipes nas quais o usuário logado é leader OU membro ----
  // (apenas para encarregado/frota, que precisam ver só motoristas da sua equipe).
  useEffect(() => {
    if (!needsTeamFilter) { setMyTeams([]); return; }
    (async () => {
      const leaderQ = await getDocs(query(collection(db, "teams"), where("leaderUserId", "==", profile.id)));
      const memberQ = await getDocs(query(collection(db, "teams"), where("memberUserIds", "array-contains", profile.id)));
      const merged = new Map();
      [...leaderQ.docs, ...memberQ.docs].forEach((d) => merged.set(d.id, { id: d.id, ...d.data() }));
      setMyTeams([...merged.values()]);
    })();
  }, [needsTeamFilter, profile.id]);

  // Conjunto de driverIds + userIds permitidos para encarregado/frota.
  const teamDriverIds = useMemo(() => {
    if (!needsTeamFilter) return null; // null = sem restrição
    const ids = new Set();
    myTeams.forEach((t) => {
      (t.memberUserIds || []).forEach((id) => ids.add(id));
      (t.memberDriverIds || []).forEach((id) => ids.add(id));
    });
    return ids;
  }, [needsTeamFilter, myTeams]);

  // Drivers aprovados SEM login que aparecem nesta tela.
  const driversWithoutLogin = useMemo(() => {
    let list = drivers.filter((d) => !d.hasLogin);
    if (teamDriverIds) {
      list = list.filter((d) => teamDriverIds.has(d.id) || teamDriverIds.has(d.userId));
    }
    return list;
  }, [drivers, teamDriverIds]);

  // Drivers COM login (apenas info — não há ação aqui).
  const driversWithLogin = useMemo(() => {
    let list = drivers.filter((d) => d.hasLogin);
    if (teamDriverIds) list = list.filter((d) => teamDriverIds.has(d.id) || teamDriverIds.has(d.userId));
    return list;
  }, [drivers, teamDriverIds]);

  // Modal de edição completa dos dados do usuário (Admin/DP).
  const [editUserModal, setEditUserModal] = useState(null); // { user }

  // Paginação — 3 blocos (default 10/pág, lista pequena).
  const pagWithoutLogin = usePagination(driversWithoutLogin, { defaultPerPage: 10 });
  const pagWithLogin = usePagination(driversWithLogin, { defaultPerPage: 10 });
  const pagUsers = usePagination(users, { defaultPerPage: 10 });

  // ==========================================================================
  // Ações
  // ==========================================================================

  const setStatus = async (id, status, role) => {
    try {
      const userSnap = await getDoc(doc(db, "users", id));
      const prevRole = userSnap.exists() ? userSnap.data().role : null;
      const updates = { status };
      if (role) updates.role = role;
      await updateDoc(doc(db, "users", id), updates);

      // ────────────────────────────────────────────────────────────────
      // Sincroniza coleção `drivers` ao trocar o papel:
      //   • para MOTORISTA  → procura driver existente vinculado ao user
      //     (via `userId == id`); se houver, reativa (hasLogin/ACTIVE);
      //     senão cria espelhamento administrativo.
      //   • para outro role  → desativa todos os drivers vinculados ao
      //     user (hasLogin:false, status:INACTIVE) para sumir da lista
      //     "Motoristas com login ativo" e evitar duplicação ao voltar.
      // ────────────────────────────────────────────────────────────────
      if (role && role !== prevRole) {
        const linkedSnap = await getDocs(query(collection(db, "drivers"), where("userId", "==", id)));
        if (role === ROLES.MOTORISTA) {
          if (!linkedSnap.empty) {
            // Reativa o(s) driver(s) existente(s).
            await Promise.all(linkedSnap.docs.map((d) => updateDoc(doc(db, "drivers", d.id), {
              hasLogin: true,
              status: DRIVER_STATUS.ACTIVE,
              reactivatedAt: serverTimestamp(),
              reactivatedBy: profile.name,
            })));
          } else if (userSnap.exists()) {
            // Não havia driver vinculado → cria espelhamento (caminho exceção).
            const u = userSnap.data();
            await ensureDriverMirror(id, { name: u.name, phone: u.phone, email: u.email, adminName: "alteração de perfil", loginType: u.loginType || "email", matricula: u.matricula || null });
          }
        } else {
          // Saiu de motorista → desativa drivers vinculados.
          await Promise.all(linkedSnap.docs.map((d) => updateDoc(doc(db, "drivers", d.id), {
            hasLogin: false,
            status: DRIVER_STATUS.INACTIVE,
            deactivatedAt: serverTimestamp(),
            deactivatedBy: profile.name,
            deactivationReason: `Perfil alterado para ${ROLE_LABELS[role] || role}`,
          })));
        }
      }

      toast.success("Atualizado.");
    } catch (e) { toast.error(e.message); }
  };

  const removeUser = async (id) => {
    if (!window.confirm("Excluir usuário?")) return;
    await deleteDoc(doc(db, "users", id));
    toast.success("Removido.");
  };

  /**
   * Edita dados básicos do usuário (nome, telefone, e-mail).
   * Email aqui é só metadado da UI — o e-mail de login do Firebase não muda.
   * Espelha o driver, se houver, para manter os dois consistentes.
   */
  const saveUserEdits = async (id, patch) => {
    try {
      await updateDoc(doc(db, "users", id), patch);
      // Se o usuário é motorista, atualiza o driver correspondente também.
      const target = users.find((u) => u.id === id);
      if (target?.role === ROLES.MOTORISTA) {
        const drv = drivers.find((d) => d.userId === id || d.id === id);
        if (drv) {
          await updateDoc(doc(db, "drivers", drv.id), {
            name: patch.name ?? drv.name,
            phone: patch.phone ?? drv.phone,
            updatedAt: serverTimestamp(),
          });
        }
      }
      toast.success("Dados atualizados.");
      setEditUserModal(null);
    } catch (e) { toast.error("Falha ao atualizar", { description: e.message }); }
  };

  /**
   * Ativa/desativa o acesso do usuário ao sistema. Não exclui o registro —
   * apenas muda o `status` (REJECTED bloqueia o login pelo guard de auth).
   */
  const toggleUserActive = async (u) => {
    const next = u.status === USER_STATUS.APPROVED ? USER_STATUS.REJECTED : USER_STATUS.APPROVED;
    const label = next === USER_STATUS.APPROVED ? "Reativar acesso" : "Desativar acesso";
    if (!window.confirm(`${label} de ${u.name}?`)) return;
    try {
      await updateDoc(doc(db, "users", u.id), { status: next, statusChangedAt: serverTimestamp(), statusChangedBy: profile.name });
      toast.success(`${label} concluído.`);
    } catch (e) { toast.error(e.message); }
  };

  /** Criação de usuário DO ZERO (exceção administrativa). */
  const createUserFromScratch = async () => {
    if (!form.name || !form.email || form.password.length < 6) {
      toast.error("Preencha nome, e-mail e senha (mínimo 6 caracteres)."); return;
    }
    const finalRole = isEncarregado ? ROLES.MOTORISTA : form.role;
    setBusy(true);
    try {
      const cred = await createUserWithEmailAndPassword(secondaryAuth, form.email, form.password);
      await setDoc(doc(db, "users", cred.user.uid), {
        email: form.email, name: form.name, role: finalRole, phone: form.phone || "",
        status: USER_STATUS.APPROVED,
        loginType: "email",
        createdAt: serverTimestamp(),
        createdBy: profile.name, createdByRole: profile.role,
      });
      if (finalRole === ROLES.MOTORISTA) {
        await ensureDriverMirror(cred.user.uid, {
          name: form.name, phone: form.phone, email: form.email,
          adminName: `${profile.name} (${ROLE_LABELS[profile.role]})`,
          loginType: "email",
        });
      }
      await signOut(secondaryAuth);
      toast.success(`Usuário criado: ${form.name}`);
      setForm({ name: "", email: "", password: "", role: ROLES.MOTORISTA, phone: "" });
      setShowForm(false);
    } catch (e) {
      toast.error("Falha ao criar usuário", { description: e.message });
    } finally { setBusy(false); }
  };

  /**
   * Cria login para um driver JÁ APROVADO pelo DP. Esta é a função usada no
   * modal "Criar login". Aceita:
   *   - kind: "email" | "matricula"
   *   - identifier: e-mail real OU matrícula 7 dígitos
   *   - password: senha (mínimo 6)
   */
  const createLoginForDriver = async ({ driver, kind, identifier, password }) => {
    if (!password || password.length < 6) { toast.error("Senha mínima de 6 caracteres."); return; }
    if (kind === "matricula" && !isMatricula(identifier)) {
      toast.error("Matrícula inválida (esperado 7 dígitos numéricos)."); return;
    }
    if (kind === "email" && !identifier.includes("@")) {
      toast.error("E-mail inválido."); return;
    }
    const firebaseEmail = kind === "matricula" ? matriculaToPseudoEmail(identifier) : identifier.trim().toLowerCase();
    setBusy(true);
    try {
      const cred = await createUserWithEmailAndPassword(secondaryAuth, firebaseEmail, password);
      await setDoc(doc(db, "users", cred.user.uid), {
        email: firebaseEmail,
        matricula: kind === "matricula" ? identifier.trim() : null,
        loginType: kind,
        name: driver.name,
        role: ROLES.MOTORISTA,
        phone: driver.phone || "",
        status: USER_STATUS.APPROVED,
        linkedDriverId: driver.id,
        createdAt: serverTimestamp(),
        createdBy: profile.name,
        createdByRole: profile.role,
      });
      await linkLoginToExistingDriver(driver.id, {
        userId: cred.user.uid,
        email: kind === "email" ? firebaseEmail : null,
        loginType: kind,
        matricula: kind === "matricula" ? identifier.trim() : null,
        adminName: `${profile.name} (${ROLE_LABELS[profile.role]})`,
      });
      await signOut(secondaryAuth);
      toast.success(`Login criado para ${driver.name}.`,
        { description: kind === "matricula" ? `Matrícula: ${identifier}` : firebaseEmail });
      setLoginModal(null);
    } catch (e) {
      toast.error("Falha ao criar login", { description: e.message });
    } finally { setBusy(false); }
  };

  // ==========================================================================
  // UI
  // ==========================================================================

  // Título dinâmico
  const pageTitle = canManageUsers ? "Usuários do Sistema" : "Criar Login do Motorista";
  const pageHeadline = isAdmin ? "Administração · TI" : isDP ? "Administração · DP" : `${ROLE_LABELS[profile.role]}`;

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-[#708278] font-bold">{pageHeadline}</div>
          <h1 className="font-[Outfit,sans-serif] text-3xl font-black tracking-tight text-[#0F1411] mt-2">{pageTitle}</h1>
          <p className="text-sm text-[#4A564F] mt-2">
            {canManageUsers
              ? "Crie, aprove, edite e ative/desative acessos ao sistema. Você também pode criar logins (e-mail ou matrícula) para motoristas já aprovados pelo DP."
              : "Forneça login (e-mail ou matrícula) aos motoristas da sua equipe já aprovados pelo DP."}
          </p>
        </div>
        {canCreateFromScratch && (
          <button onClick={() => setShowForm(!showForm)} data-testid="btn-novo-user"
            className="flex items-center gap-2 bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] text-white px-5 py-3 rounded-md text-sm font-bold uppercase tracking-[0.1em] hover:from-[#1D4ED8] hover:to-[#1E40AF] transition-all">
            <Plus size={16} /> {showForm ? "Cancelar" : isEncarregado ? "Criar do zero" : "Novo usuário"}
          </button>
        )}
      </div>

      {/* Banner: explicação contextual da regra de negócio */}
      <div className="mt-6 bg-[#EFF3F8] border border-[#2563EB]/30 rounded-md p-4 flex gap-3" data-testid="users-admin-info">
        <Info size={18} className="text-[#2563EB] mt-0.5 shrink-0" weight="duotone" />
        <div className="text-xs text-[#0F2542] leading-relaxed">
          <strong>Como funciona:</strong> motoristas entram via <strong>Requerimento → DP aprova</strong>.
          Depois de aprovados, eles aparecem aqui no bloco <em>"Aprovados pelo DP · sem login"</em> e você pode entregar o acesso
          ao sistema com <strong>e-mail</strong> (reset de senha pelo próprio sistema) ou <strong>matrícula de 7 dígitos</strong>
          (login interno da empresa).
          {canCreateFromScratch && (
            <span className="block mt-2 text-[#8B5E2B]">
              <strong>Exceção administrativa:</strong> você também pode <em>criar do zero</em> — esses usuários ficam ativos
              imediatamente e pulam a aprovação do DP.
            </span>
          )}
        </div>
      </div>


      {/* ============================================================== */}
      {/* FORM — Criação do zero (exceção administrativa)                  */}
      {/* ============================================================== */}
      {showForm && canCreateFromScratch && (
        <section className="mt-8 bg-white border border-[#E2E8E4] rounded-md p-6 space-y-4" data-testid="form-create-scratch">
          <div className="flex items-center gap-2">
            <UserGear size={18} className="text-[#8B5E2B]" weight="duotone" />
            <h3 className="font-[Outfit,sans-serif] text-lg font-bold text-[#0F2542]">Criar usuário do zero</h3>
            <span className="text-[10px] uppercase tracking-[0.15em] font-bold px-2 py-1 rounded bg-[#FFF8E7] text-[#8B5E2B] border border-[#D9A05B]/50">
              Exceção administrativa
            </span>
          </div>
          <p className="text-xs text-[#4A564F]">
            Cria um login que pula o DP. Use apenas quando o motorista já está trabalhando e precisa de acesso urgente.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Nome completo"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inp} data-testid="u-name" /></Field>
            <Field label="E-mail"><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inp} data-testid="u-email" /></Field>
            <Field label="Senha (mín. 6 chars)"><input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={inp} data-testid="u-pwd" /></Field>
            <Field label="Telefone (opcional)"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inp} data-testid="u-phone" /></Field>
            {!isEncarregado && (
              <Field label="Perfil">
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={inp} data-testid="u-role">
                  {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
            )}
            {isEncarregado && (
              <Field label="Perfil">
                <div className={`${inp} bg-[#F5F7FA] flex items-center justify-between`}>
                  <span>Motorista</span>
                  <span className="text-[10px] uppercase tracking-[0.15em] text-[#708278] font-bold">fixo</span>
                </div>
              </Field>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={createUserFromScratch} disabled={busy} data-testid="u-create"
              className="bg-[#0F2542] text-white px-6 py-3 rounded-md text-sm font-bold uppercase tracking-[0.1em] hover:bg-[#16294A] disabled:opacity-60">
              {busy ? "Criando…" : "Criar usuário"}
            </button>
          </div>
        </section>
      )}





      {/* ============================================================== */}
      {/* BLOCO 1 — Motoristas APROVADOS sem login (ação principal)        */}
      {/* ============================================================== */}
      <section className="mt-8" data-testid="block-aprovados-sem-login">
        <div className="flex items-center gap-2 mb-3">
          <Key size={18} weight="duotone" className="text-[#2563EB]" />
          <h3 className="text-xs uppercase tracking-[0.2em] font-bold text-[#0F2542]">
            Aprovados pelo DP · sem login ({driversWithoutLogin.length})
          </h3>
        </div>
        {driversWithoutLogin.length === 0 ? (
          <div className="border border-dashed border-[#E2E8E4] rounded-md p-8 text-center text-sm text-[#708278]">
            Nenhum motorista aprovado aguardando criação de login.
          </div>
        ) : (
          <div className="space-y-2">
            {pagWithoutLogin.paged.map((d) => (
              <div key={d.id} data-testid={`drv-nolg-${d.id}`}
                className="bg-white border border-[#E2E8E4] rounded-md p-4 flex items-center justify-between flex-wrap gap-3 hover:border-[#2563EB]/40 transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#EFF3F8] rounded-md flex items-center justify-center">
                    <UserCircle size={20} weight="duotone" className="text-[#2563EB]" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-[#0F1411]">{d.name}</div>
                    <div className="text-xs text-[#708278]">{d.funcao || "—"} · {d.phone || "sem telefone"}</div>
                  </div>
                </div>
                <button onClick={() => setLoginModal({ driver: d })} data-testid={`btn-criar-login-${d.id}`}
                  className="flex items-center gap-2 bg-[#0F2542] text-white px-4 py-2 rounded-md text-xs font-bold uppercase tracking-[0.1em] hover:bg-[#16294A]">
                  <Key size={14} /> Criar login
                </button>
              </div>
            ))}
          </div>
        )}
        {driversWithoutLogin.length > 0 && <Pagination {...pagWithoutLogin} testid="users-nolg-pag" />}
      </section>

      {/* ============================================================== */}
      {/* BLOCO 2 — Motoristas que JÁ TÊM login (informativo)              */}
      {/* ============================================================== */}
      {driversWithLogin.length > 0 && (
        <section className="mt-8" data-testid="block-com-login">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck size={18} weight="duotone" className="text-[#1B5E20]" />
            <h3 className="text-xs uppercase tracking-[0.2em] font-bold text-[#1B5E20]">
              Motoristas com login ativo ({driversWithLogin.length})
            </h3>
          </div>
          <div className="space-y-2">
            {pagWithLogin.paged.map((d) => {
              const u = users.find((x) => x.id === d.userId);
              const identifier = u?.matricula ? `Matrícula ${u.matricula}` : u?.email || "—";
              return (
                <div key={d.id} className="bg-white border border-[#E2E8E4] rounded-md p-4 flex items-center justify-between flex-wrap gap-3 opacity-90">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#2E7D32]/15 rounded-md flex items-center justify-center">
                      <UserCircle size={20} weight="duotone" className="text-[#1B5E20]" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-[#0F1411]">{d.name}</div>
                      <div className="text-xs text-[#708278] flex items-center gap-1">
                        {u?.loginType === "matricula" ? <IdentificationCard size={12} /> : <EnvelopeSimple size={12} />}
                        {identifier}
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] uppercase tracking-[0.15em] font-bold px-2.5 py-1 rounded-md bg-[#2E7D32]/15 text-[#1B5E20] border border-[#2E7D32]/40">
                    Ativo
                  </span>
                </div>
              );
            })}
          </div>
          <Pagination {...pagWithLogin} testid="users-wlg-pag" />
        </section>
      )}



      {/* ============================================================== */}
      {/* BLOCO 3 — Todos os usuários do sistema (Admin TI + DP)           */}
      {/* ============================================================== */}
      {canManageUsers && (
        <section className="mt-10">
          <div className="flex items-center gap-2 mb-3">
            <UserGear size={18} weight="duotone" className="text-[#708278]" />
            <h3 className="text-xs uppercase tracking-[0.2em] font-bold text-[#708278]">Todos os usuários do sistema ({users.length})</h3>
          </div>
          <div className="space-y-2">
            {pagUsers.paged.map((u) => (
              <div key={u.id} data-testid={`u-row-${u.id}`}
                className={`bg-white border border-[#E2E8E4] rounded-md p-4 flex items-center justify-between flex-wrap gap-3 ${u.status === USER_STATUS.REJECTED ? "opacity-60" : ""}`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#EFF3F8] rounded-md flex items-center justify-center">
                    <User size={18} className="text-[#2563EB]" weight="duotone" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-[#0F1411]">{u.name}</div>
                    <div className="text-xs text-[#708278]">{describeIdentifier(u.email)} · {u.phone || "—"} · {ROLE_LABELS[u.role] || u.role}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <select value={u.role || ""} onChange={(e) => setStatus(u.id, u.status, e.target.value)} data-testid={`u-role-${u.id}`}
                    className="text-xs font-bold border border-[#E2E8E4] px-3 py-2 rounded-md focus:outline-none focus:border-[#2563EB]">
                    {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <span className={`text-[10px] uppercase tracking-[0.15em] font-bold px-2.5 py-1 rounded-md border ${u.status === USER_STATUS.APPROVED ? "bg-[#2E7D32]/15 text-[#1B5E20] border-[#2E7D32]/40" :
                      u.status === USER_STATUS.PENDING ? "bg-[#D9A05B]/15 text-[#8B5E2B] border-[#D9A05B]/40" :
                        "bg-[#C25D41]/15 text-[#8B3A26] border-[#C25D41]/40"
                    }`}>
                    {u.status === "approved" ? "Ativo" : u.status === "pending" ? "Pendente" : "Inativo"}
                  </span>
                  <button onClick={() => setEditUserModal({ user: u })} data-testid={`u-edit-${u.id}`}
                    title="Editar dados (nome, telefone)"
                    className="border border-[#E2E8E4] text-[#0F2542] px-3 py-2 rounded-md text-xs font-bold uppercase tracking-[0.1em] hover:bg-[#F5F7FA]">
                    Editar
                  </button>
                  {u.status === USER_STATUS.PENDING && (
                    <button onClick={() => setStatus(u.id, USER_STATUS.APPROVED)}
                      className="flex items-center gap-1 bg-[#2E7D32] text-white px-3 py-2 rounded-md text-xs font-bold uppercase tracking-[0.1em] hover:opacity-90">
                      <CheckCircle size={14} /> Aprovar
                    </button>
                  )}
                  {u.status !== USER_STATUS.PENDING && (
                    <button onClick={() => toggleUserActive(u)} data-testid={`u-toggle-${u.id}`}
                      className={`flex items-center gap-1 px-3 py-2 rounded-md text-xs font-bold uppercase tracking-[0.1em] hover:opacity-90 ${u.status === USER_STATUS.APPROVED
                          ? "bg-[#C25D41] text-white"
                          : "bg-[#2E7D32] text-white"
                        }`}>
                      {u.status === USER_STATUS.APPROVED ? <><XCircle size={14} /> Desativar</> : <><CheckCircle size={14} /> Reativar</>}
                    </button>
                  )}
                  {isAdmin && (
                    <button onClick={() => removeUser(u.id)} title="Excluir registro" className="text-[#C25D41] p-1 hover:bg-[#C25D41]/10 rounded">
                      <Trash size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <Pagination {...pagUsers} testid="users-all-pag" />
        </section>
      )}

      {/* MODAL — Editar dados do usuário (nome, telefone, e-mail UI) */}
      {editUserModal && (
        <UserEditModal
          user={editUserModal.user}
          busy={busy}
          onClose={() => setEditUserModal(null)}
          onSubmit={(patch) => saveUserEdits(editUserModal.user.id, patch)}
        />
      )}

      {/* MODAL — Criar login para motorista aprovado                      */}
      {loginModal && (
        <CreateLoginModal
          driver={loginModal.driver}
          busy={busy}
          onClose={() => setLoginModal(null)}
          onSubmit={(payload) => createLoginForDriver({ driver: loginModal.driver, ...payload })}
        />
      )}
    </div>
  );
}

// =============================================================================
// Modal de criação de login (e-mail OU matrícula 7 dígitos)
// =============================================================================
function CreateLoginModal({ driver, busy, onClose, onSubmit }) {
  // OPÇÃO DE LOGIN POR E-MAIL DESATIVADA TEMPORARIAMENTE — decisão do
  // usuário (operação atual da empresa usa apenas matrícula). Para reativar
  // no futuro: descomente o bloco "Tabs — escolha do tipo de identificador",
  // o branch `kind === "email"` no input e a dica de reset por Firebase, e
  // troque a linha abaixo para `useState("email")`.
  const [kind /* , setKind */] = useState("matricula"); // "email" | "matricula"
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  const pseudoPreview = kind === "matricula" && isMatricula(identifier)
    ? `m${identifier}@${MATRICULA_DOMAIN}` : "";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-md max-w-md w-full p-6 shadow-2xl" data-testid="modal-criar-login">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-[#708278] font-bold">Motorista aprovado</div>
            <h3 className="font-[Outfit,sans-serif] text-xl font-black text-[#0F1411] mt-1">{driver.name}</h3>
            <p className="text-xs text-[#4A564F] mt-1">{driver.phone || "—"}</p>
          </div>
          <button onClick={onClose} className="text-[#708278] hover:text-[#0F1411]"><X size={20} /></button>
        </div>

        {/* ───────── Tabs — escolha do tipo de identificador (DESATIVADO) ─────────
            Mantemos o JSX comentado para reativar futuramente sem reescrita.
        <div className="mt-5 grid grid-cols-2 gap-2 bg-[#F5F7FA] rounded-md p-1">
          <button onClick={() => { setKind("email"); setIdentifier(""); }} data-testid="tab-login-email"
            className={`flex items-center justify-center gap-2 py-2.5 rounded text-xs font-bold uppercase tracking-[0.1em] transition-all ${kind === "email" ? "bg-white shadow text-[#0F2542]" : "text-[#708278]"}`}>
            <EnvelopeSimple size={14} /> E-mail
          </button>
          <button onClick={() => { setKind("matricula"); setIdentifier(""); }} data-testid="tab-login-matricula"
            className={`flex items-center justify-center gap-2 py-2.5 rounded text-xs font-bold uppercase tracking-[0.1em] transition-all ${kind === "matricula" ? "bg-white shadow text-[#0F2542]" : "text-[#708278]"}`}>
            <IdentificationCard size={14} /> Matrícula
          </button>
        </div>
        ─────────────────────────────────────────────────────────────────────── */}

        {/* Indicador visível de que o login é por matrícula (substitui as tabs). */}
        <div className="mt-5 bg-[#EFF3F8] border border-[#2563EB]/30 rounded-md p-3 flex items-center gap-2" data-testid="login-only-matricula">
          <IdentificationCard size={16} className="text-[#2563EB]" weight="duotone" />
          <div className="text-[11px] text-[#0F2542] font-bold uppercase tracking-[0.1em]">Login por Matrícula</div>
        </div>

        {/* Campo identificador */}
        <div className="mt-4">
          <label className="text-[11px] uppercase tracking-[0.2em] font-bold text-[#708278] block mb-1.5">
            {/* Branch "E-mail" mantido comentado para retomada futura:
                {kind === "email" ? "E-mail do motorista" : "Matrícula …"} */}
            Matrícula (letras maiúsculas e números, mín. 7 chars)
          </label>
          <input
            value={identifier}
            onChange={(e) => setIdentifier(kind === "matricula" ? e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") : e.target.value)}
            placeholder={kind === "matricula" ? "MOT12345 ou 1234567" : "exemplo@empresa.com"}
            inputMode={kind === "matricula" ? "numeric" : "email"}
            className={inp}
            data-testid="modal-identifier"
          />
          {kind === "matricula" && pseudoPreview && (
            <div className="text-[11px] text-[#708278] mt-1 italic">
              Login interno: <code>{pseudoPreview}</code> (transparente — motorista digita só os 7 dígitos)
            </div>
          )}
          {/* Hint de reset por Firebase (e-mail) — comentado:
          {kind === "email" && (
            <div className="text-[11px] text-[#708278] mt-1 italic">Reset de senha funciona via Firebase.</div>
          )} */}
        </div>

        {/* Senha */}
        <div className="mt-4">
          <label className="text-[11px] uppercase tracking-[0.2em] font-bold text-[#708278] block mb-1.5">Senha inicial (mín. 6 chars)</label>
          <input type="text" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="Anote essa senha — você vai entregar para o motorista"
            className={inp} data-testid="modal-password" />
          <div className="text-[11px] text-[#8B5E2B] mt-1 italic">
            Anote esta senha e entregue ao motorista. Ele poderá trocá-la depois (futuro).
          </div>
        </div>

        <div className="mt-6 flex gap-2 justify-end">
          <button onClick={onClose}
            className="border border-[#E2E8E4] text-[#4A564F] px-5 py-2.5 rounded-md text-xs font-bold uppercase tracking-[0.1em] hover:bg-[#F5F7FA]">
            Cancelar
          </button>
          <button onClick={() => onSubmit({ kind, identifier, password })} disabled={busy} data-testid="modal-submit"
            className="bg-[#0F2542] text-white px-5 py-2.5 rounded-md text-xs font-bold uppercase tracking-[0.1em] hover:bg-[#16294A] disabled:opacity-60">
            {busy ? "Criando…" : "Criar login"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-[0.2em] font-bold text-[#708278] block mb-1.5">{label}</label>
      {children}
    </div>
  );
}

// =============================================================================
// Modal de edição de dados básicos (nome, telefone, e-mail-meta).
// O e-mail Firebase Auth NÃO é alterado por aqui (limitação do client SDK).
// =============================================================================
function UserEditModal({ user, busy, onClose, onSubmit }) {
  const [form, setForm] = useState({
    name: user.name || "",
    phone: user.phone || "",
    funcao: user.funcao || "",
  });
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const isMatriculaLogin = user.loginType === "matricula";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-md max-w-md w-full p-6 shadow-2xl" data-testid="modal-edit-user">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-[#708278] font-bold">Editar dados do usuário</div>
            <h3 className="font-[Outfit,sans-serif] text-xl font-black text-[#0F1411] mt-1">{user.name}</h3>
            <p className="text-xs text-[#4A564F] mt-1">{describeIdentifier(user.email)}</p>
          </div>
          <button onClick={onClose} className="text-[#708278] hover:text-[#0F1411]"><X size={20} /></button>
        </div>

        <div className="mt-5 space-y-4">
          <Field label="Nome completo">
            <input value={form.name} onChange={(e) => set("name", e.target.value)} className={inp} data-testid="edit-name" />
          </Field>
          <Field label="Telefone">
            <input value={form.phone} onChange={(e) => set("phone", e.target.value)} className={inp} placeholder="(00) 00000-0000" data-testid="edit-phone" />
          </Field>
          <Field label="Função / Cargo (opcional)">
            <input value={form.funcao} onChange={(e) => set("funcao", e.target.value)} className={inp} placeholder="Ex.: Operador de Máquinas" data-testid="edit-funcao" />
          </Field>
          <div className="text-[11px] text-[#708278] italic leading-relaxed">
            {isMatriculaLogin
              ? "Login por matrícula — não é alterado por aqui. Para mudar, crie um novo login."
              : "O e-mail/login do Firebase Auth não é alterado por esta tela."}
          </div>
        </div>

        <div className="mt-6 flex gap-2 justify-end">
          <button onClick={onClose}
            className="border border-[#E2E8E4] text-[#4A564F] px-5 py-2.5 rounded-md text-xs font-bold uppercase tracking-[0.1em] hover:bg-[#F5F7FA]">
            Cancelar
          </button>
          <button onClick={() => onSubmit(form)} disabled={busy} data-testid="edit-save"
            className="bg-[#0F2542] text-white px-5 py-2.5 rounded-md text-xs font-bold uppercase tracking-[0.1em] hover:bg-[#16294A] disabled:opacity-60">
            {busy ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
