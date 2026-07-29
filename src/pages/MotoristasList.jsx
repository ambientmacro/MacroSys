import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { collection, onSnapshot, orderBy, query, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { DRIVER_STATUS, DRIVER_STATUS_LABEL, VEHICLE_STATUS } from "../lib/constants";
import { isPendingDriver } from "../lib/drivers";
import { canCreateRequerimento } from "../lib/roles";
import { User, PlusCircle, Truck, Info, Clock } from "@phosphor-icons/react";
import Pagination, { usePagination } from "../components/Pagination";



function MainCollapse({ children }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-8 border border-[#E2E8E4] rounded-md bg-white">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 text-left text-xs uppercase tracking-[0.15em] font-bold text-[#0F2542] flex items-center justify-between"
      >
        Filtros Avançados
        <span>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-4 py-4">
          {children}
        </div>
      )}
    </div>
  );
}



function CardGroup({ title, children }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-[#E2E8E4] rounded-md bg-white">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 text-left text-xs uppercase tracking-[0.15em] font-bold text-[#0F2542] flex items-center justify-between"
      >
        {title}
        <span>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-4 py-4 space-y-2">
          {children}
        </div>
      )}
    </div>
  );
}



const STATUS_BADGE = {
  PENDING_APPROVAL: "bg-[#D9A05B]/20 text-[#8B5E2B] border-[#D9A05B]/50",
  NO_LOGIN_USER: "bg-[#2E7D32]/15 text-[#1B5E20] border-[#2E7D32]/40",
  ACTIVE: "bg-[#2563EB]/15 text-[#0A1A2E] border-[#2563EB]/40",
  INACTIVE: "bg-[#C25D41]/15 text-[#8B3A26] border-[#C25D41]/40",
};

const CARD_GROUP_TITLE = "text-[10px] uppercase tracking-[0.2em] font-bold text-[#708278] mb-2";
const CARD_BASE =
  "bg-white border border-[#E2E8E4] rounded-md p-3 flex items-center gap-2 w-full text-xs hover:border-[#2563EB]/50 transition-all";

function FilterCard({ label, value, active, color, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${CARD_BASE} ${active ? "ring-2 ring-offset-1" : ""}`}
      style={active ? { borderColor: color, boxShadow: `0 0 0 1px ${color}` } : undefined}
    >
      <div
        className="w-8 h-8 rounded-md flex items-center justify-center text-[11px] font-bold"
        style={{ backgroundColor: `${color}15`, color }}
      >
        {value}
      </div>
      <div className="text-[11px] font-semibold text-[#0F1411]">{label}</div>
    </button>
  );
}

export default function MotoristasList() {
  const { profile } = useAuth();
  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [teams, setTeams] = useState([]);

  const [search, setSearch] = useState("");


  // filtros
  const [statusFilter, setStatusFilter] = useState("TODOS");
  const [cnhFilter, setCnhFilter] = useState(null); // "VENCIDA" | "30DIAS" | "VALIDA"
  const [vehicleFilter, setVehicleFilter] = useState(null); // "COM" | "SEM"
  const [funcaoFilter, setFuncaoFilter] = useState(null); // "MOTORISTA" | "OPERADOR" | "AJUDANTE" | "OUTRO"
  const [teamFilter, setTeamFilter] = useState(null); // teamId | "SEM"

  const canRequest = canCreateRequerimento(profile.role);

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "drivers"), orderBy("createdAt", "desc")), (snap) => {
      setDrivers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    (async () => {
      const vSnap = await getDocs(query(collection(db, "vehicles"), orderBy("createdAt", "desc")));
      const vList = vSnap.docs.map((x) => ({ id: x.id, ...x.data() }));
      setVehicles(vList);

      const tSnap = await getDocs(collection(db, "teams"));
      setTeams(tSnap.docs.map((t) => ({ id: t.id, ...t.data() })));
    })();
    return () => unsub();
  }, []);

  // helpers
  const getVehicleForDriver = (d) =>
    d.defaultVehicleId ? vehicles.find((v) => v.id === d.defaultVehicleId) || null : null;

  const getTeamForDriver = (d) => {
    const veh = getVehicleForDriver(d);
    if (!veh || !veh.teamId) return null;
    return teams.find((t) => t.id === veh.teamId) || null;
  };

  const computeCNHInfo = (d) => {
    const cnhDateStr = d.cnhValidade || d.validade_cnh;
    const cnhDate = cnhDateStr ? new Date(cnhDateStr) : null;
    const daysCNH = cnhDate && !isNaN(cnhDate) ? Math.floor((cnhDate - new Date()) / 86400000) : null;
    if (daysCNH === null) return { daysCNH: null, status: null };
    if (daysCNH < 0) return { daysCNH, status: "VENCIDA" };
    if (daysCNH <= 30) return { daysCNH, status: "30DIAS" };
    return { daysCNH, status: "VALIDA" };
  };

  // contadores para cards
  const counters = useMemo(() => {
    let total = drivers.length;
    let ativos = 0;
    let inativos = 0;
    let semLogin = 0;
    let aguardandoDP = 0;

    let cnhVencida = 0;
    let cnh30dias = 0;
    let cnhValida = 0;

    let comVeiculo = 0;
    let semVeiculo = 0;

    let funcMotorista = 0;
    let funcOperador = 0;
    let funcAjudante = 0;
    let funcOutro = 0;

    const teamCounts = {};
    let semEquipe = 0;

    drivers.forEach((d) => {
      const isPending = isPendingDriver(d);
      const status = d.status;

      if (status === DRIVER_STATUS.ACTIVE) ativos++;
      else if (status === DRIVER_STATUS.INACTIVE) inativos++;
      else if (status === DRIVER_STATUS.NO_LOGIN_USER) semLogin++;
      if (isPending) aguardandoDP++;

      const { status: cnhStatus } = computeCNHInfo(d);
      if (cnhStatus === "VENCIDA") cnhVencida++;
      else if (cnhStatus === "30DIAS") cnh30dias++;
      else if (cnhStatus === "VALIDA") cnhValida++;

      const veh = getVehicleForDriver(d);
      if (veh) comVeiculo++;
      else semVeiculo++;

      const func = (d.funcao || "").toLowerCase();
      if (func.includes("motorista")) funcMotorista++;
      else if (func.includes("operador")) funcOperador++;
      else if (func.includes("ajudante")) funcAjudante++;
      else if (func) funcOutro++;

      const team = getTeamForDriver(d);
      if (team) {
        teamCounts[team.id] = (teamCounts[team.id] || 0) + 1;
      } else {
        semEquipe++;
      }
    });

    return {
      total,
      ativos,
      inativos,
      semLogin,
      aguardandoDP,
      cnhVencida,
      cnh30dias,
      cnhValida,
      comVeiculo,
      semVeiculo,
      funcMotorista,
      funcOperador,
      funcAjudante,
      funcOutro,
      teamCounts,
      semEquipe,
    };
  }, [drivers, vehicles, teams]);

  // filtros ativos (para banner)
  const activeFilters = {
    status: statusFilter !== "TODOS" ? statusFilter : null,
    cnh: cnhFilter,
    vehicle: vehicleFilter,
    funcao: funcaoFilter,
    team: teamFilter,
  };
  const hasActiveFilters = Object.values(activeFilters).some(Boolean);

  // aplicação dos filtros
  const filteredDrivers = useMemo(() => {
    let list = [...drivers];

    if (statusFilter !== "TODOS") {
      list = list.filter((d) => {
        const isPending = isPendingDriver(d);
        if (statusFilter === "ATIVOS") return d.status === DRIVER_STATUS.ACTIVE;
        if (statusFilter === "INATIVOS") return d.status === DRIVER_STATUS.INACTIVE;
        if (statusFilter === "SEM_LOGIN") return d.status === DRIVER_STATUS.NO_LOGIN_USER;
        if (statusFilter === "AGUARDANDO_DP") return isPending;
        return true;
      });
    }

    if (cnhFilter) {
      list = list.filter((d) => {
        const { status } = computeCNHInfo(d);
        return status === cnhFilter;
      });
    }

    if (vehicleFilter) {
      list = list.filter((d) => {
        const veh = getVehicleForDriver(d);
        if (vehicleFilter === "COM") return !!veh;
        if (vehicleFilter === "SEM") return !veh;
        return true;
      });
    }

    if (funcaoFilter) {
      list = list.filter((d) => {
        const func = (d.funcao || "").toLowerCase();

        const isMotorista = func.includes("motorista");
        const isOperador = !isMotorista && func.includes("operador");
        const isAjudante = !isMotorista && !isOperador && func.includes("ajudante");
        const isOutro = func && !isMotorista && !isOperador && !isAjudante;

        if (funcaoFilter === "MOTORISTA") return isMotorista;
        if (funcaoFilter === "OPERADOR") return isOperador;
        if (funcaoFilter === "AJUDANTE") return isAjudante;
        if (funcaoFilter === "OUTRO") return isOutro;

        return true;
      });
    }


    if (teamFilter) {
      list = list.filter((d) => {
        const team = getTeamForDriver(d);
        if (teamFilter === "SEM") return !team;
        return team && team.id === teamFilter;
      });
    }

    if (search.trim()) {
      const term = search.toLowerCase();

      list = list.filter((d) => {
        const veh = getVehicleForDriver(d);
        const team = getTeamForDriver(d);

        const fields = [
          d.name,
          d.funcao,
          d.phone,
          d.cnh,
          d.cnhCategoria,
          d.categoria,
          formatDateBR(d.cnhValidade),
          formatDateBR(d.validade_cnh),
          d.status,
          veh?.tag,
          veh?.placa,
          veh?.marca,
          veh?.modelo,
          veh?.ano,
          team?.name,
        ];

        return fields.some((f) => f && String(f).toLowerCase().includes(term));
      });
    }


    return list;
  }, [drivers, statusFilter, cnhFilter, vehicleFilter, funcaoFilter, teamFilter, vehicles, teams, search,]);

  const { paged, ...pag } = usePagination(filteredDrivers, { defaultPerPage: 50 });

  const toggle = (current, value) => (current === value ? null : value);
  const toggleStatus = (value) => setStatusFilter(statusFilter === value ? "TODOS" : value);

  function formatDateBR(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d)) return "";
    return d.toLocaleDateString("pt-BR"); // ex: 05/07/2026
  }


  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-[#708278] font-bold">Operação</div>
          <h1 className="font-[Outfit,sans-serif] text-3xl font-black tracking-tight text-[#0F1411] mt-2">Motoristas</h1>
          <p className="text-sm text-[#4A564F] mt-2">Motoristas / funcionários ativos no sistema.</p>
        </div>
        {canRequest && (
          <Link
            to="/requerimentos/novo?tipo=motorista"
            data-testid="btn-req-motorista"
            className="flex items-center gap-2 bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] text-white px-5 py-3 rounded-md text-sm font-bold uppercase tracking-[0.1em] hover:from-[#1D4ED8] hover:to-[#1E40AF] transition-all shadow-md shadow-blue-900/20"
          >
            <PlusCircle size={16} /> Novo Requerimento de Motorista
          </Link>
        )}
      </div>

      {canRequest && (
        <div className="mt-6 bg-[#EFF3F8] border border-[#2563EB]/20 rounded-md p-4 flex gap-3">
          <Info size={18} className="text-[#2563EB] mt-0.5 shrink-0" weight="duotone" />
          <div className="text-xs text-[#0F2542] leading-relaxed">
            <strong>Cadastro direto não está disponível.</strong> Para incluir um novo motorista (com ou sem login), abra um <strong>Requerimento</strong>. O fluxo passa pelo DP para análise e aprovação. Enquanto aguarda o DP, o motorista fica em <strong>Aguardando DP</strong> e <strong>não pode</strong> ser selecionado em checklists nem como titular de veículo.
          </div>
        </div>
      )}

      <div className="mt-8">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, CNH, função, veículo, equipe, validade..."
          className="w-full px-4 py-3 border border-[#E2E8E4] rounded-md text-sm focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] outline-none"
        />
      </div>


      {/* CARDS EM GRUPOS */}
      <MainCollapse>
        <div className="grid lg:grid-cols-5 gap-4">

          {/* STATUS */}
          <div>
            <div className={CARD_GROUP_TITLE}>Status</div>
            <div className="space-y-2">
              <FilterCard label="Todos" value={counters.total} color="#1E3A5F"
                active={statusFilter === "TODOS"} onClick={() => setStatusFilter("TODOS")} />

              <FilterCard label="Ativos" value={counters.ativos} color="#2E7D32"
                active={statusFilter === "ATIVOS"} onClick={() => toggleStatus("ATIVOS")} />

              <FilterCard label="Inativos" value={counters.inativos} color="#C25D41"
                active={statusFilter === "INATIVOS"} onClick={() => toggleStatus("INATIVOS")} />

              <FilterCard label="Sem login" value={counters.semLogin} color="#2563EB"
                active={statusFilter === "SEM_LOGIN"} onClick={() => toggleStatus("SEM_LOGIN")} />

              <FilterCard label="Aguardando DP" value={counters.aguardandoDP} color="#D9A05B"
                active={statusFilter === "AGUARDANDO_DP"} onClick={() => toggleStatus("AGUARDANDO_DP")} />
            </div>
          </div>

          {/* CNH */}
          <div>
            <div className={CARD_GROUP_TITLE}>CNH</div>
            <div className="space-y-2">
              <FilterCard label="CNH vencida" value={counters.cnhVencida} color="#C25D41"
                active={cnhFilter === "VENCIDA"} onClick={() => setCnhFilter(toggle(cnhFilter, "VENCIDA"))} />

              <FilterCard label="Vence em até 30 dias" value={counters.cnh30dias} color="#D9A05B"
                active={cnhFilter === "30DIAS"} onClick={() => setCnhFilter(toggle(cnhFilter, "30DIAS"))} />

              <FilterCard label="CNH válida" value={counters.cnhValida} color="#2E7D32"
                active={cnhFilter === "VALIDA"} onClick={() => setCnhFilter(toggle(cnhFilter, "VALIDA"))} />
            </div>
          </div>

          {/* VEÍCULO */}
          <div>
            <div className={CARD_GROUP_TITLE}>Veículo vinculado</div>
            <div className="space-y-2">
              <FilterCard label="Com veículo" value={counters.comVeiculo} color="#2563EB"
                active={vehicleFilter === "COM"} onClick={() => setVehicleFilter(toggle(vehicleFilter, "COM"))} />

              <FilterCard label="Sem veículo" value={counters.semVeiculo} color="#708278"
                active={vehicleFilter === "SEM"} onClick={() => setVehicleFilter(toggle(vehicleFilter, "SEM"))} />
            </div>
          </div>

          {/* FUNÇÃO */}
          <div>
            <div className={CARD_GROUP_TITLE}>Função</div>
            <div className="space-y-2">
              <FilterCard label="Motorista" value={counters.funcMotorista} color="#1E3A5F"
                active={funcaoFilter === "MOTORISTA"} onClick={() => setFuncaoFilter(toggle(funcaoFilter, "MOTORISTA"))} />

              <FilterCard label="Operador" value={counters.funcOperador} color="#2563EB"
                active={funcaoFilter === "OPERADOR"} onClick={() => setFuncaoFilter(toggle(funcaoFilter, "OPERADOR"))} />

              <FilterCard label="Ajudante" value={counters.funcAjudante} color="#8EA694"
                active={funcaoFilter === "AJUDANTE"} onClick={() => setFuncaoFilter(toggle(funcaoFilter, "AJUDANTE"))} />

              <FilterCard label="Outro" value={counters.funcOutro} color="#708278"
                active={funcaoFilter === "OUTRO"} onClick={() => setFuncaoFilter(toggle(funcaoFilter, "OUTRO"))} />
            </div>
          </div>

          {/* EQUIPE */}
          <div>
            <div className={CARD_GROUP_TITLE}>Equipe</div>
            <div className="space-y-2">
              {teams.map((t) => (
                <FilterCard
                  key={t.id}
                  label={t.name}
                  value={counters.teamCounts[t.id] || 0}
                  color="#2563EB"
                  active={teamFilter === t.id}
                  onClick={() => setTeamFilter(toggle(teamFilter, t.id))}
                />
              ))}

              <FilterCard label="Sem equipe" value={counters.semEquipe} color="#708278"
                active={teamFilter === "SEM"} onClick={() => setTeamFilter(toggle(teamFilter, "SEM"))} />
            </div>
          </div>

        </div>
      </MainCollapse>





      {/* BANNER DE FILTROS ATIVOS */}
      {hasActiveFilters && (
        <div className="mt-4 mb-4 flex items-center gap-2 text-[11px] text-[#4A564F] flex-wrap">
          <span className="font-bold uppercase tracking-[0.15em] text-[#708278]">Filtros ativos:</span>

          {activeFilters.status && (
            <span className="bg-[#0F2542] text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-[0.1em]">
              Status: {activeFilters.status.replace("_", " ")}
            </span>
          )}

          {activeFilters.cnh && (
            <span className="bg-[#D9A05B] text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-[0.1em]">
              CNH: {activeFilters.cnh === "VENCIDA" ? "Vencida" : activeFilters.cnh === "30DIAS" ? "Vence em até 30 dias" : "Válida"}
            </span>
          )}

          {activeFilters.vehicle && (
            <span className="bg-[#2563EB] text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-[0.1em]">
              Veículo: {activeFilters.vehicle === "COM" ? "Com veículo" : "Sem veículo"}
            </span>
          )}

          {activeFilters.funcao && (
            <span className="bg-[#1E3A5F] text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-[0.1em]">
              Função: {activeFilters.funcao.toLowerCase()}
            </span>
          )}

          {activeFilters.team && (
            <span className="bg-[#2563EB] text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-[0.1em]">
              Equipe:{" "}
              {activeFilters.team === "SEM"
                ? "Sem equipe"
                : teams.find((t) => t.id === activeFilters.team)?.name || activeFilters.team}
            </span>
          )}

          <button
            onClick={() => {
              setStatusFilter("TODOS");
              setCnhFilter(null);
              setVehicleFilter(null);
              setFuncaoFilter(null);
              setTeamFilter(null);
            }}
            className="text-[#1E3A5F] font-bold uppercase tracking-[0.15em] hover:underline ml-2"
          >
            Limpar
          </button>
        </div>
      )}

      {/* LISTA */}
      <div className="mt-6 space-y-2">
        {drivers.length === 0 && (
          <div className="border border-dashed border-[#E2E8E4] rounded-md p-10 text-center text-sm text-[#708278]">
            Nenhum motorista cadastrado ainda. Abra um requerimento para cadastrar.
          </div>
        )}

        {paged.length === 0 && drivers.length > 0 && (
          <div className="border border-dashed border-[#E2E8E4] rounded-md p-10 text-center text-sm text-[#708278]">
            Nenhum motorista encontrado com os filtros atuais.
          </div>
        )}

        {paged.map((d) => (
          <DriverRow key={d.id} d={d} vehicles={vehicles} />
        ))}
      </div>

      <Pagination {...pag} testid="motoristas-pag" />
    </div>
  );
}

function DriverRow({ d, vehicles }) {
  const veh = d.defaultVehicleId ? vehicles.find((v) => v.id === d.defaultVehicleId) || null : null;
  const isPending = isPendingDriver(d);
  const badgeClass = isPending ? STATUS_BADGE.PENDING_APPROVAL : (STATUS_BADGE[d.status] || STATUS_BADGE.NO_LOGIN_USER);
  const badgeLabel = isPending ? DRIVER_STATUS_LABEL.PENDING_APPROVAL : (DRIVER_STATUS_LABEL[d.status] || "—");

  const cnhDateStr = d.cnhValidade || d.validade_cnh;
  const cnhDate = cnhDateStr ? new Date(cnhDateStr) : null;
  const daysCNH = cnhDate && !isNaN(cnhDate) ? Math.floor((cnhDate - new Date()) / 86400000) : null;
  const cnhAlert =
    daysCNH === null
      ? null
      : daysCNH < 0
        ? { label: `CNH vencida há ${Math.abs(daysCNH)}d`, cls: "bg-[#C25D41]/15 text-[#8B3A26] border-[#C25D41]/40" }
        : daysCNH <= 30
          ? { label: `CNH vence em ${daysCNH}d`, cls: "bg-[#D9A05B]/15 text-[#8B5E2B] border-[#D9A05B]/40" }
          : null;

  return (
    <div
      data-testid={`m-row-${d.id}`}
      className="bg-white border border-[#E2E8E4] rounded-md p-5 flex items-center justify-between flex-wrap gap-3"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-[#EFF3F8] rounded-md flex items-center justify-center">
          <User size={18} className="text-[#2563EB]" weight="duotone" />
        </div>
        <div>
          <div className="text-sm font-bold text-[#0F1411]">{d.name}</div>
          <div className="text-xs text-[#708278] mt-0.5">
            {d.funcao || "—"} · {d.phone || "—"}
          </div>
          {(d.cnh || d.cnhCategoria) && (
            <div className="text-xs text-[#0F2542] mt-1">
              CNH {d.cnh || "—"}{" "}
              {d.cnhCategoria || d.categoria ? `· cat. ${d.cnhCategoria || d.categoria}` : ""}
              {cnhDateStr && (
                <span className="text-[#708278]">
                  {" "}
                  · validade {new Date(cnhDateStr).toLocaleDateString("pt-BR")}
                </span>
              )}
            </div>
          )}
          {veh && (
            <div className="text-xs text-[#2563EB] mt-1 flex items-center gap-1">
              <Truck size={12} /> {veh.tag}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap justify-end">
        {cnhAlert && (
          <span
            className={`text-[10px] uppercase tracking-[0.1em] font-bold px-2 py-1 rounded border ${cnhAlert.cls}`}
          >
            {cnhAlert.label}
          </span>
        )}
        <span
          className={`text-[10px] uppercase tracking-[0.15em] font-bold px-2.5 py-1 rounded-md border ${badgeClass}`}
        >
          {badgeLabel}
        </span>
      </div>
    </div>
  );
}
