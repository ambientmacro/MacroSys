import { useEffect, useState, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import { collection, query, where, getDocs, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { ROLES, REQ_STATUS, VEHICLE_STATUS, REQ_STATUS_LABEL, VEHICLE_STATUS_LABEL } from "../lib/constants";
import { getTemplateRevisionStatus } from "../lib/templateRevision";
import { buildWaLink } from "../lib/whatsapp";
import { Link } from "react-router-dom";
import {
  Truck, ClipboardText, FileText, Users, ShieldWarning, CheckCircle, Hourglass,
  PlusCircle, Stack, ListChecks, Devices, ClockClockwise, Warning, X, CarProfile, IdentificationCard,
  WhatsappLogo,
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

  // ─── Veículos parados hoje ──────────────────────────────────────────────
  // Veículos ACTIVE que NÃO tiveram nenhum checklist entre 00:00 e 23:59 do
  // dia atual (timezone do navegador). Aplicamos a subtração em memória
  // porque o Firestore não permite consultas "sem match" nativamente.
  //
  // Enriquecemos cada veículo parado com o nome do **encarregado** (via
  // `vehicle.teamId → teams.leaderUserId → users.name`) e a lista de
  // **motoristas titulares** (do próprio doc do veículo em
  // `motoristasTitularesNomes[]`) para que o Adm de Frota já veja no card
  // quem é responsável, sem precisar clicar em cada um.
  const [paradosHoje, setParadosHoje] = useState({ count: 0, list: [] });
  // Contador dos checklists efetivamente preenchidos hoje (contraponto ao
  // card "Parados hoje"). Reflete a produtividade real do dia.
  const [checklistsHoje, setChecklistsHoje] = useState(0);
  useEffect(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    const unsubV = onSnapshot(query(collection(db, "vehicles"), where("status", "==", VEHICLE_STATUS.ACTIVE)), (vSnap) => {
      const ativos = vSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      (async () => {
        // Checklists do dia (leitura pontual — evita listener aninhado).
        const cSnap = await getDocs(query(
          collection(db, "checklists"),
          where("createdAt", ">=", start),
          where("createdAt", "<", end),
        ));
        setChecklistsHoje(cSnap.size);
        const vehIdsChecados = new Set();
        cSnap.forEach((doc) => {
          const c = doc.data();
          if (c.vehicleId) vehIdsChecados.add(c.vehicleId);
        });
        const parados = ativos.filter((v) => !vehIdsChecados.has(v.id));

        // Carrega equipes referenciadas + nomes/telefones dos encarregados
        // e dos motoristas titulares para permitir o botão "Cobrar via
        // WhatsApp" direto na lista, sem clicar em cada veículo.
        const teamIds = Array.from(new Set(parados.map((v) => v.teamId).filter(Boolean)));
        const driverIds = Array.from(new Set(parados.flatMap((v) => Array.isArray(v.motoristasTitularesIds) ? v.motoristasTitularesIds : [])));
        let teamMap = new Map(); // teamId → { name, leaderName, leaderPhone }
        let driverMap = new Map(); // driverId → { name, phone }
        // Users e drivers são pequenas o suficiente pra serem carregados
        // por inteiro em uma leitura. Firestore cacheia (persistência local).
        if (teamIds.length > 0 || driverIds.length > 0) {
          const [teamsSnap, usersSnap, driversSnap] = await Promise.all([
            teamIds.length > 0 ? getDocs(collection(db, "teams")) : Promise.resolve(null),
            teamIds.length > 0 ? getDocs(collection(db, "users")) : Promise.resolve(null),
            driverIds.length > 0 ? getDocs(collection(db, "drivers")) : Promise.resolve(null),
          ]);
          const usersById = new Map();
          usersSnap?.forEach((u) => usersById.set(u.id, u.data()));
          teamsSnap?.docs
            ?.map((t) => ({ id: t.id, ...t.data() }))
            ?.filter((t) => teamIds.includes(t.id))
            ?.forEach((t) => {
              const leader = usersById.get(t.leaderUserId);
              teamMap.set(t.id, {
                name: t.name,
                leaderName: leader?.name || null,
                leaderPhone: leader?.phone || null,
              });
            });
          driversSnap?.forEach((d) => {
            if (driverIds.includes(d.id)) {
              const data = d.data();
              driverMap.set(d.id, { name: data.name || null, phone: data.phone || null });
            }
          });
        }

        const enriched = parados.map((v) => {
          const teamInfo = v.teamId ? teamMap.get(v.teamId) : null;
          // Motoristas: cruza IDs (fonte de verdade do telefone) com nomes
          // cacheados no doc do veículo. Se algum id não estiver no map,
          // faz fallback para o nome cache sem telefone.
          const ids = Array.isArray(v.motoristasTitularesIds) ? v.motoristasTitularesIds : (v.motoristaTitularId ? [v.motoristaTitularId] : []);
          const nomes = Array.isArray(v.motoristasTitularesNomes) ? v.motoristasTitularesNomes : (v.motoristaTitularNome ? [v.motoristaTitularNome] : []);
          const motoristas = ids.length > 0
            ? ids.map((id, i) => ({ id, name: driverMap.get(id)?.name || nomes[i] || null, phone: driverMap.get(id)?.phone || null }))
            : nomes.map((n) => ({ id: null, name: n, phone: null }));
          return {
            ...v,
            _encarregadoNome: teamInfo?.leaderName || null,
            _encarregadoPhone: teamInfo?.leaderPhone || null,
            _equipeNome: teamInfo?.name || null,
            _motoristas: motoristas,
          };
        });
        setParadosHoje({ count: enriched.length, list: enriched });
      })().catch(() => setParadosHoje({ count: 0, list: [] }));
    });
    return () => unsubV();
  }, []);

  // ─── Documentos vencidos + a vencer em 30 dias ──────────────────────────
  // Junta CNH (drivers.cnhValidade / validade_cnh) e CRLV
  // (vehicles.vencimentoCRLV / vencimento_crlv). Um card único somando os
  // dois, com modal detalhado ao clicar.
  const [docsAlerta, setDocsAlerta] = useState({ cnh: [], crlv: [], total: 0 });
  useEffect(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const in30 = new Date(today); in30.setDate(in30.getDate() + 30);
    const parseDate = (raw) => {
      if (!raw) return null;
      const d = raw?.toDate?.() || new Date(raw);
      return isNaN(d?.getTime?.()) ? null : d;
    };
    const isAtRisk = (d) => d && d <= in30; // vencidos (<today) + a vencer 30d
    const unsubD = onSnapshot(collection(db, "drivers"), (dSnap) => {
      const cnh = dSnap.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .map((d) => ({
          id: d.id, name: d.name, cpf: d.cpf,
          date: parseDate(d.cnhValidade || d.validade_cnh),
        }))
        .filter((d) => isAtRisk(d.date))
        .sort((a, b) => a.date - b.date);
      setDocsAlerta((prev) => ({ ...prev, cnh, total: cnh.length + prev.crlv.length }));
    });
    const unsubV = onSnapshot(collection(db, "vehicles"), (vSnap) => {
      const crlv = vSnap.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .map((v) => ({
          id: v.id, tag: v.tag, placa: v.placa || v.placaNormalizada, marca: v.marca, modelo: v.modelo,
          date: parseDate(v.vencimentoCRLV || v.vencimento_crlv),
        }))
        .filter((v) => isAtRisk(v.date))
        .sort((a, b) => a.date - b.date);
      setDocsAlerta((prev) => ({ ...prev, crlv, total: prev.cnh.length + crlv.length }));
    });
    return () => { unsubD(); unsubV(); };
  }, []);

  const [docsModalOpen, setDocsModalOpen] = useState(false);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard icon={Truck} label={VEHICLE_STATUS_LABEL.ACTIVE} value={veicAtivos} accent="#1E3A5F" to="/veiculos" testId="stat-veic-ativos" />
        <StatCard icon={Hourglass} label={VEHICLE_STATUS_LABEL.PENDING_ACTIVATION} value={veicAguardando} accent="#D9A05B" to="/veiculos" testId="stat-veic-aguardando" />
        <StatCard icon={FileText} label="Requerimentos totais" value={reqs} accent="#4A7A8C" to="/requerimentos" testId="stat-reqs" />
        <StatCard
          icon={ClipboardText}
          label="Checklists preenchidos hoje"
          value={checklistsHoje}
          accent="#10B981"
          to="/checklists"
          testId="stat-checklists-hoje"
        />
        <StatCard
          icon={CarProfile}
          label="Parados hoje (sem checklist)"
          value={paradosHoje.count}
          accent={paradosHoje.count > 0 ? "#DC2626" : "#10B981"}
          to="/veiculos"
          testId="stat-parados-hoje"
        />
        <button
          type="button"
          onClick={() => setDocsModalOpen(true)}
          data-testid="stat-docs-vencendo"
          className="text-left block border border-[#E2E8E4] bg-white rounded-md p-5 transition-all duration-200 hover:-translate-y-[1px] hover:border-[#DC2626]/40"
        >
          <div className="flex items-start justify-between">
            <div
              className="w-10 h-10 rounded-md flex items-center justify-center"
              style={{ background: `${docsAlerta.total > 0 ? "#DC2626" : "#10B981"}15` }}
            >
              <IdentificationCard size={20} weight="duotone" style={{ color: docsAlerta.total > 0 ? "#DC2626" : "#10B981" }} />
            </div>
            {docsAlerta.total > 0 && (
              <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#DC2626]">Clique p/ ver</span>
            )}
          </div>
          <div className="mt-4 text-[11px] uppercase tracking-[0.2em] font-bold text-[#708278]">Docs vencidos / 30d</div>
          <div className="text-3xl font-[Outfit,sans-serif] font-black tracking-tight text-[#0F1411] mt-1">{docsAlerta.total}</div>
          <div className="text-[10px] text-[#708278] mt-1">
            CNH: <b className="text-[#0F2542]">{docsAlerta.cnh.length}</b> · CRLV: <b className="text-[#0F2542]">{docsAlerta.crlv.length}</b>
          </div>
        </button>
      </div>

      {/* Alerta contextual: veículos parados — mostra Equipe/Encarregado,
          motoristas titulares e um botão de WhatsApp Click-to-Chat na frente
          de cada pessoa (mensagem pré-preenchida cobrando o checklist). */}
      {paradosHoje.count > 0 && (
        <div className="mt-4 bg-[#FEF2F2] border border-[#DC2626]/30 rounded-md p-4" data-testid="alerta-parados-hoje">
          <div className="text-xs uppercase tracking-[0.2em] font-bold text-[#991B1B] mb-3">
            ⚠️ {paradosHoje.count} veículo(s) ativo(s) sem checklist hoje
          </div>
          <ul className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {paradosHoje.list.map((v) => {
              const vehLabel = v.tag || v.placa || v.id.slice(0, 8);
              const vehSubtitle = [v.marca, v.modelo].filter(Boolean).join(" ");
              const checklistUrl = `${window.location.origin}/checklist/digital`;
              const msgMotorista = `Olá! Notamos que o checklist do veículo ${vehLabel}${vehSubtitle ? ` (${vehSubtitle})` : ""} ainda não foi feito hoje. Por favor, preencha agora: ${checklistUrl}`;
              const msgEncarregado = `Olá! O veículo ${vehLabel}${vehSubtitle ? ` (${vehSubtitle})` : ""} da equipe "${v._equipeNome || ""}" está sem checklist hoje. Favor providenciar o preenchimento.`;
              return (
                <li key={v.id} className="flex flex-wrap items-start justify-between gap-3 border border-[#DC2626]/20 bg-white rounded px-3 py-2.5" data-testid={`parado-${v.id}`}>
                  <div className="min-w-0 flex-1">
                    <Link to={`/veiculos/${v.id}`} className="text-sm text-[#0F2542] font-bold hover:underline">
                      {vehLabel}{vehSubtitle ? ` — ${vehSubtitle}` : ""}
                    </Link>

                    {/* Encarregado */}
                    <div className="text-[11px] text-[#4A564F] mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span>
                        <b className="text-[#708278] uppercase tracking-[0.1em] text-[10px] mr-1">Encarregado:</b>
                        {v._encarregadoNome || <em className="text-[#9CA3AF]">não vinculado</em>}
                      </span>
                      {v._encarregadoNome && v._encarregadoPhone && (
                        <WhatsChip
                          phone={v._encarregadoPhone}
                          message={msgEncarregado}
                          testId={`wa-encarregado-${v.id}`}
                          title={`Cobrar ${v._encarregadoNome} via WhatsApp`}
                        />
                      )}
                      {v._equipeNome && (
                        <span className="ml-2">
                          <b className="text-[#708278] uppercase tracking-[0.1em] text-[10px] mr-1">Equipe:</b>
                          {v._equipeNome}
                        </span>
                      )}
                    </div>

                    {/* Motoristas */}
                    <div className="text-[11px] text-[#4A564F] mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <b className="text-[#708278] uppercase tracking-[0.1em] text-[10px] mr-1">Motoristas:</b>
                      {v._motoristas.length === 0
                        ? <em className="text-[#9CA3AF]">nenhum titular</em>
                        : v._motoristas.map((m, i) => (
                            <span key={m.id || `${m.name}-${i}`} className="inline-flex items-center gap-1">
                              {m.name || <em className="text-[#9CA3AF]">(sem nome)</em>}
                              {m.phone && (
                                <WhatsChip
                                  phone={m.phone}
                                  message={msgMotorista}
                                  testId={`wa-motorista-${v.id}-${i}`}
                                  title={`Enviar link do checklist para ${m.name || "motorista"}`}
                                />
                              )}
                              {i < v._motoristas.length - 1 && <span className="text-[#CBD5E1]">·</span>}
                            </span>
                          ))}
                    </div>
                  </div>
                  <span className="text-[#991B1B] text-[10px] uppercase tracking-[0.1em] font-bold shrink-0 self-center">sem checklist</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {docsModalOpen && (
        <DocsAlertaModal
          cnh={docsAlerta.cnh}
          crlv={docsAlerta.crlv}
          onClose={() => setDocsModalOpen(false)}
        />
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        <QuickAction icon={PlusCircle} label="Novo requerimento" to="/requerimentos/novo" testId="qa-novo-req" />
        <QuickAction icon={Truck} label="Veículos" to="/veiculos" testId="qa-veiculos" />
        <QuickAction icon={ListChecks} label="Painel de Checklists" to="/checklists/painel" testId="qa-painel-checklists" />
      </div>
    </>
  );
}

/**
 * Chip pequeno "abrir WhatsApp" — usado na lista de veículos parados para
 * cobrar encarregado/motorista via Click-to-Chat. Se o telefone não estiver
 * limpo, `buildWaLink` retorna null e o botão não é renderizado.
 */
function WhatsChip({ phone, message, testId, title }) {
  const url = buildWaLink(phone, message);
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      data-testid={testId}
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#128C7E] px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-[0.08em] transition-colors"
    >
      <WhatsappLogo size={12} weight="fill" />
      Cobrar
    </a>
  );
}

/**
 * Modal detalhado dos documentos vencidos / a vencer em 30 dias.
 * Duas seções: CNH (drivers) e CRLV (vehicles). Cada linha traz o nome/placa,
 * a data e um badge colorido conforme urgência:
 *  - VENCIDO (data < hoje): vermelho
 *  - ≤ 7 dias: laranja
 *  - ≤ 30 dias: amarelo
 */
function DocsAlertaModal({ cnh, crlv, onClose }) {
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const badge = (d) => {
    const daysLeft = Math.floor((d - today) / 86400000);
    if (daysLeft < 0) return { txt: `Vencido há ${-daysLeft}d`, cls: "bg-[#FEE2E2] text-[#991B1B]" };
    if (daysLeft <= 7) return { txt: `Vence em ${daysLeft}d`, cls: "bg-[#FED7AA] text-[#9A3412]" };
    return { txt: `Vence em ${daysLeft}d`, cls: "bg-[#FEF3C7] text-[#92400E]" };
  };
  const fmt = (d) => d.toLocaleDateString("pt-BR");
  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
      data-testid="docs-alerta-modal"
    >
      <div
        className="bg-white rounded-lg max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-[#E2E8E4] flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] font-bold text-[#708278]">Atenção</div>
            <h3 className="font-[Outfit,sans-serif] text-xl font-black tracking-tight text-[#0F1411] mt-1">
              Documentos vencidos ou a vencer (≤30 dias)
            </h3>
          </div>
          <button onClick={onClose} data-testid="docs-modal-close" className="p-2 rounded-md hover:bg-[#EFF3F8]">
            <X size={20} className="text-[#708278]" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto space-y-6">
          <section>
            <h4 className="text-sm font-black uppercase tracking-[0.15em] text-[#0F2542] mb-3">
              CNH · {cnh.length} motorista{cnh.length !== 1 ? "s" : ""}
            </h4>
            {cnh.length === 0 ? (
              <div className="text-sm text-[#708278] italic border border-dashed border-[#E2E8E4] rounded-md p-4 text-center">
                Nenhuma CNH vencida ou vencendo. ✅
              </div>
            ) : (
              <ul className="space-y-2">
                {cnh.map((d) => {
                  const b = badge(d.date);
                  return (
                    <li key={d.id} className="flex items-center justify-between gap-3 border border-[#E2E8E4] rounded-md px-4 py-2.5">
                      <div>
                        <div className="text-sm font-bold text-[#0F1411]">{d.name || "(sem nome)"}</div>
                        {d.cpf && <div className="text-[11px] text-[#708278] font-mono">{d.cpf}</div>}
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-[#0F2542]">{fmt(d.date)}</div>
                        <span className={`inline-block text-[10px] uppercase tracking-[0.1em] font-bold px-2 py-0.5 rounded mt-1 ${b.cls}`}>
                          {b.txt}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          <section>
            <h4 className="text-sm font-black uppercase tracking-[0.15em] text-[#0F2542] mb-3">
              CRLV · {crlv.length} veículo{crlv.length !== 1 ? "s" : ""}
            </h4>
            {crlv.length === 0 ? (
              <div className="text-sm text-[#708278] italic border border-dashed border-[#E2E8E4] rounded-md p-4 text-center">
                Nenhum CRLV vencido ou vencendo. ✅
              </div>
            ) : (
              <ul className="space-y-2">
                {crlv.map((v) => {
                  const b = badge(v.date);
                  return (
                    <li key={v.id} className="flex items-center justify-between gap-3 border border-[#E2E8E4] rounded-md px-4 py-2.5">
                      <div>
                        <Link to={`/veiculos/${v.id}`} onClick={onClose} className="text-sm font-bold text-[#0F1411] hover:text-[#2563EB]">
                          {v.tag || v.placa || v.id.slice(0, 8)}
                        </Link>
                        <div className="text-[11px] text-[#708278]">
                          {[v.placa, v.marca, v.modelo].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-[#0F2542]">{fmt(v.date)}</div>
                        <span className={`inline-block text-[10px] uppercase tracking-[0.1em] font-bold px-2 py-0.5 rounded mt-1 ${b.cls}`}>
                          {b.txt}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
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
