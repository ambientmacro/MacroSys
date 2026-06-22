import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { collection, query, where, getDocs, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { ROLES, REQ_STATUS, VEHICLE_STATUS, REQ_STATUS_LABEL, VEHICLE_STATUS_LABEL } from "../lib/constants";
import { getTemplateRevisionStatus } from "../lib/templateRevision";
import { Link } from "react-router-dom";
import {
  Truck, ClipboardText, FileText, Users, ShieldWarning, CheckCircle, Hourglass,
  PlusCircle, Stack, ListChecks, Devices, ClockClockwise, Warning,
} from "@phosphor-icons/react";

export default function DashboardRouter() {
  const { profile } = useAuth();
  const role = profile?.role;

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto">
      <div className="text-xs uppercase tracking-[0.25em] text-[#708278] font-bold">Painel · {new Date().toLocaleDateString("pt-BR")}</div>
      <h1 className="font-[Outfit,sans-serif] text-3xl sm:text-4xl font-black tracking-tight text-[#0F1411] mt-2">
        Olá, {profile?.name?.split(" ")[0] || "operador"}.
      </h1>
      <p className="text-sm text-[#4A564F] mt-2 max-w-2xl">
        Acompanhe os indicadores e fluxos atribuídos ao seu perfil.
      </p>

      <div className="mt-8">
        {role === ROLES.MOTORISTA && <MotoristaDash uid={profile.id} />}
        {role === ROLES.ENCARREGADO && <EncarregadoDash />}
        {role === ROLES.FROTA && <FrotaDash />}
        {role === ROLES.DP && <DPDash />}
        {role === ROLES.SEGURANCA && <SegurancaDash />}
        {role === ROLES.ADMIN && <AdminDash />}
      </div>

      <ManualLinks role={role} />
    </div>
  );
}

// =============================================================================
// Manuais — bloco de download por perfil + manual completo
// -----------------------------------------------------------------------------
// Cada perfil baixa o seu manual focado nas funcionalidades que ele usa.
// O manual completo (denso, ~12 páginas) também fica disponível para todos.
// =============================================================================
const MANUAL_BY_ROLE = {
  [ROLES.MOTORISTA]:   { file: "manual-motorista.md",   label: "Manual do Motorista" },
  [ROLES.ENCARREGADO]: { file: "manual-encarregado.md", label: "Manual do Encarregado" },
  [ROLES.FROTA]:       { file: "manual-frota.md",       label: "Manual do Adm de Frota" },
  [ROLES.DP]:          { file: "manual-dp.md",          label: "Manual do DP" },
  [ROLES.SEGURANCA]:   { file: "manual-seguranca.md",   label: "Manual da Segurança" },
  [ROLES.ADMIN]:       { file: "manual-admin.md",       label: "Manual do Admin TI" },
};

function ManualLinks({ role }) {
  const m = MANUAL_BY_ROLE[role];
  return (
    <div className="mt-10 pt-6 border-t border-[#E2E8E4] flex flex-wrap gap-3 items-center justify-between" data-testid="dashboard-manuais">
      <div className="text-xs uppercase tracking-[0.2em] font-bold text-[#708278]">📘 Documentação</div>
      <div className="flex flex-wrap gap-2">
        {m && (
          <a href={`/manuais/${m.file}`} target="_blank" rel="noopener noreferrer"
            data-testid="manual-perfil"
            className="flex items-center gap-2 bg-[#0F2542] text-white px-4 py-2 rounded-md text-xs font-bold uppercase tracking-[0.1em] hover:bg-[#16294A]">
            Baixar {m.label}
          </a>
        )}
        <a href="/manuais/manual-completo.md" target="_blank" rel="noopener noreferrer"
          data-testid="manual-completo"
          className="flex items-center gap-2 border border-[#2563EB] text-[#2563EB] px-4 py-2 rounded-md text-xs font-bold uppercase tracking-[0.1em] hover:bg-[#EFF3F8]">
          Manual completo
        </a>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent = "#1E3A5F", to, testId }) {
  const Cmp = to ? Link : "div";
  return (
    <Cmp
      to={to}
      data-testid={testId}
      className="block border border-[#E2E8E4] bg-white rounded-md p-5 transition-all duration-200 hover:-translate-y-[1px] hover:border-[#1E3A5F]/40"
    >
      <div className="flex items-start justify-between">
        <div className="w-10 h-10 rounded-md flex items-center justify-center" style={{ background: `${accent}15` }}>
          <Icon size={20} weight="duotone" style={{ color: accent }} />
        </div>
      </div>
      <div className="mt-4 text-[11px] uppercase tracking-[0.2em] font-bold text-[#708278]">{label}</div>
      <div className="text-3xl font-[Outfit,sans-serif] font-black tracking-tight text-[#0F1411] mt-1">{value}</div>
    </Cmp>
  );
}

function QuickAction({ icon: Icon, label, to, testId }) {
  return (
    <Link to={to} data-testid={testId}
      className="flex items-center gap-3 border border-[#E2E8E4] bg-white px-4 py-3 rounded-md hover:bg-[#EFF3F8] hover:border-[#1E3A5F]/40 transition-all">
      <Icon size={18} className="text-[#1E3A5F]" weight="duotone" />
      <span className="text-sm font-bold text-[#0F1411]">{label}</span>
    </Link>
  );
}

function useCount(qFn, deps = []) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const snap = await getDocs(qFn());
        if (active) setN(snap.size);
      } catch (e) { /* ignore */ }
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return n;
}

function MotoristaDash({ uid }) {
  const myChecklists = useCount(() => query(collection(db, "checklists"), where("filledByUserId", "==", uid)), [uid]);
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard icon={ClipboardText} label="Meus checklists" value={myChecklists} accent="#1E3A5F" to="/checklists" testId="stat-my-checklists" />
        <StatCard icon={Devices} label="Ação rápida" value="Novo" accent="#4A7A8C" to="/checklist/digital" testId="stat-quick-checklist" />
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <QuickAction icon={Devices} label="Preencher checklist digital" to="/checklist/digital" testId="quick-checklist-digital" />
      </div>
    </>
  );
}

function EncarregadoDash() {
  const reqPendentes = useCount(() => query(collection(db, "requerimentos"), where("status", "==", REQ_STATUS.PENDENTE)));
  const veicAtivos = useCount(() => query(collection(db, "vehicles"), where("status", "==", VEHICLE_STATUS.ACTIVE)));
  const motoristas = useCount(() => collection(db, "drivers"));
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard icon={FileText} label="Requerimentos pendentes" value={reqPendentes} accent="#D9A05B" to="/requerimentos" testId="stat-req-pendentes" />
        <StatCard icon={Truck} label="Veículos ativos" value={veicAtivos} accent="#1E3A5F" to="/veiculos" testId="stat-veic-ativos" />
        <StatCard icon={Users} label="Motoristas" value={motoristas} accent="#4A7A8C" to="/motoristas" testId="stat-motoristas" />
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <QuickAction icon={PlusCircle} label="Novo requerimento" to="/requerimentos/novo" testId="qa-novo-req" />
        <QuickAction icon={ClipboardText} label="Checklist manual" to="/checklist/manual" testId="qa-cl-manual" />
        <QuickAction icon={Devices} label="Checklist digital" to="/checklist/digital" testId="qa-cl-digital" />
        <QuickAction icon={Users} label="Motoristas" to="/motoristas" testId="qa-motoristas" />
      </div>
    </>
  );
}

function FrotaDash() {
  const veicAtivos = useCount(() => query(collection(db, "vehicles"), where("status", "==", VEHICLE_STATUS.ACTIVE)));
  const veicAguardando = useCount(() => query(collection(db, "vehicles"), where("status", "==", VEHICLE_STATUS.PENDING_ACTIVATION)));
  const reqs = useCount(() => collection(db, "requerimentos"));
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard icon={Truck} label={VEHICLE_STATUS_LABEL.ACTIVE} value={veicAtivos} accent="#1E3A5F" to="/veiculos" testId="stat-veic-ativos" />
        <StatCard icon={Hourglass} label={VEHICLE_STATUS_LABEL.PENDING_ACTIVATION} value={veicAguardando} accent="#D9A05B" to="/veiculos" testId="stat-veic-aguardando" />
        <StatCard icon={FileText} label="Requerimentos totais" value={reqs} accent="#4A7A8C" to="/requerimentos" testId="stat-reqs" />
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <QuickAction icon={PlusCircle} label="Novo requerimento" to="/requerimentos/novo" testId="qa-novo-req" />
        <QuickAction icon={Truck} label="Veículos" to="/veiculos" testId="qa-veiculos" />
      </div>
    </>
  );
}

function DPDash() {
  const pendentes = useCount(() => query(collection(db, "requerimentos"), where("status", "==", REQ_STATUS.PENDENTE)));
  const aguardandoContrato = useCount(() => query(collection(db, "requerimentos"), where("status", "==", REQ_STATUS.AGUARDANDO_CONTRATO_DP)));
  const aprovados = useCount(() => query(collection(db, "requerimentos"), where("status", "==", REQ_STATUS.APROVADO)));
  const reprovados = useCount(() => query(collection(db, "requerimentos"), where("status", "==", REQ_STATUS.REPROVADO)));
  // Contratos vencendo: veículos ATIVOS com contratoDataFim entre hoje e +30 dias.
  const [vencendo, setVencendo] = useState({ count: 0, list: [] });
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "vehicles"), where("status", "==", VEHICLE_STATUS.ACTIVE)), (snap) => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const limit = new Date(today); limit.setDate(limit.getDate() + 30);
      const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        .filter((v) => v.contratoDataFim)
        .map((v) => ({ ...v, fim: new Date(v.contratoDataFim) }))
        .filter((v) => v.fim >= today && v.fim <= limit)
        .sort((a, b) => a.fim - b.fim);
      setVencendo({ count: arr.length, list: arr.slice(0, 5) });
    });
    return () => unsub();
  }, []);
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard icon={Hourglass} label={REQ_STATUS_LABEL.PENDENTE} value={pendentes} accent="#D9A05B" to="/requerimentos" testId="stat-pendentes" />
        <StatCard icon={Hourglass} label={REQ_STATUS_LABEL.AGUARDANDO_CONTRATO_DP} value={aguardandoContrato} accent="#8B5E2B" to="/requerimentos" testId="stat-aguardando-contrato" />
        <StatCard icon={CheckCircle} label={REQ_STATUS_LABEL.APROVADO} value={aprovados} accent="#2E7D32" to="/requerimentos" testId="stat-aprovados" />
        <StatCard icon={Warning} label="Contratos vencendo (30d)" value={vencendo.count} accent={vencendo.count > 0 ? "#DC2626" : "#10B981"} to="/veiculos" testId="stat-contratos-vencendo" />
      </div>
      {vencendo.count > 0 && (
        <div className="mt-4 bg-[#FEF2F2] border border-[#DC2626]/30 rounded-md p-4" data-testid="alerta-contratos-vencendo">
          <div className="text-xs uppercase tracking-[0.2em] font-bold text-[#991B1B] mb-2">
            ⚠️ Contratos vencendo nos próximos 30 dias
          </div>
          <ul className="text-sm space-y-1">
            {vencendo.list.map((v) => (
              <li key={v.id} className="flex justify-between gap-3" data-testid={`vencendo-${v.id}`}>
                <span className="text-[#0F2542] font-bold">{v.tag || v.placa || v.id.slice(0, 8)} — {v.marca} {v.modelo}</span>
                <span className="text-[#991B1B] font-black">{v.fim.toLocaleDateString("pt-BR")}</span>
              </li>
            ))}
            {vencendo.count > 5 && <li className="text-[11px] text-[#708278] italic">+ {vencendo.count - 5} outros</li>}
          </ul>
        </div>
      )}
    </>
  );
}

function SegurancaDash() {
  const emAnalise = useCount(() => query(collection(db, "requerimentos"), where("status", "==", REQ_STATUS.EM_ANALISE_SEGURANCA)));
  const aguardando = useCount(() => query(collection(db, "requerimentos"), where("status", "==", REQ_STATUS.AGUARDANDO_VISTORIA)));
  const templates = useCount(() => collection(db, "checklistTemplates"));
  // Templates vencidos / em alerta de revisão (6 meses).
  const [templatesAtencao, setTemplatesAtencao] = useState(0);
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "checklistTemplates"), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const need = list.filter((t) => {
        const s = getTemplateRevisionStatus(t).status;
        return s === "vencido" || s === "atencao";
      });
      setTemplatesAtencao(need.length);
    });
    return () => unsub();
  }, []);
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard icon={FileText} label={REQ_STATUS_LABEL.EM_ANALISE_SEGURANCA} value={emAnalise} accent="#4A7A8C" to="/requerimentos" testId="stat-em-analise" />
        <StatCard icon={Hourglass} label={REQ_STATUS_LABEL.AGUARDANDO_VISTORIA} value={aguardando} accent="#8EA694" to="/vistorias" testId="stat-aguardando-vist" />
        <StatCard icon={Stack} label="Templates" value={templates} accent="#1E3A5F" to="/templates" testId="stat-templates" />
        <StatCard icon={ClockClockwise} label="Revisões pendentes" value={templatesAtencao} accent={templatesAtencao > 0 ? "#DC2626" : "#10B981"} to="/templates/revisao" testId="stat-revisoes-pendentes" />
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <QuickAction icon={Stack} label="Templates de checklist" to="/templates" testId="qa-templates" />
        <QuickAction icon={ClockClockwise} label="Revisão de Templates" to="/templates/revisao" testId="qa-revisao" />
        <QuickAction icon={ClipboardText} label="Vistorias" to="/vistorias" testId="qa-vistorias" />
      </div>
    </>
  );
}

function AdminDash() {
  const users = useCount(() => collection(db, "users"));
  const usersPending = useCount(() => query(collection(db, "users"), where("status", "==", "pending")));
  const reqs = useCount(() => collection(db, "requerimentos"));
  const veiculos = useCount(() => collection(db, "vehicles"));
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Usuários" value={users} accent="#1E3A5F" to="/users" testId="stat-users" />
        <StatCard icon={Hourglass} label="Aguardando aprovação" value={usersPending} accent="#D9A05B" to="/users" testId="stat-users-pending" />
        <StatCard icon={FileText} label="Requerimentos" value={reqs} accent="#4A7A8C" to="/requerimentos" testId="stat-reqs" />
        <StatCard icon={Truck} label="Veículos" value={veiculos} accent="#2E7D32" to="/veiculos" testId="stat-veiculos" />
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <QuickAction icon={PlusCircle} label="Novo requerimento" to="/requerimentos/novo" testId="qa-novo-req" />
        <QuickAction icon={Stack} label="Templates" to="/templates" testId="qa-templates" />
        <QuickAction icon={ListChecks} label="Checklists" to="/checklists" testId="qa-checklists" />
      </div>
    </>
  );
}
