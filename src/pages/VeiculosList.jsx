import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { collection, onSnapshot, orderBy, query, where, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { ROLES, VEHICLE_STATUS_LABEL } from "../lib/constants";
import { Truck, CaretRight, User } from "@phosphor-icons/react";
import Pagination, { usePagination } from "../components/Pagination";

/* ---------------------------------------------------------
   STATUS COLORS
--------------------------------------------------------- */
const STATUS_COLOR = {
  PRE_REGISTERED: "bg-[#D9A05B]/15 text-[#8B5E2B] border-[#D9A05B]/40",
  PENDING_ACTIVATION: "bg-[#8EA694]/20 text-[#3D4F44] border-[#8EA694]/50",
  ACTIVE: "bg-[#2E7D32]/15 text-[#1B5E20] border-[#2E7D32]/40",
  INACTIVE: "bg-[#C25D41]/15 text-[#8B3A26] border-[#C25D41]/40",
};

/* ---------------------------------------------------------
   CARD COMPONENT
--------------------------------------------------------- */
function Card({ label, value, color, icon: Icon, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`bg-white border rounded-md p-4 flex items-center gap-3 w-full transition-all ${active ? "ring-2 ring-offset-1" : "border-[#E2E8E4] hover:border-[#1E3A5F]/30"
        }`}
      style={active ? { borderColor: color, boxShadow: `0 0 0 1px ${color}` } : undefined}
    >
      <div className="w-11 h-11 rounded-md flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
        <Icon size={20} weight="duotone" style={{ color }} />
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-[0.15em] font-bold text-[#708278]">{label}</div>
        <div className="text-2xl font-black tracking-tight" style={{ color }}>{value}</div>
      </div>
    </button>
  );
}


/* ---------------------------------------------------------
   ADVANCED FILTERS (COLAPSÁVEL)
--------------------------------------------------------- */
function AdvancedFilters({ filters, setFilters, teams, drivers }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-6 border border-[#E2E8E4] rounded-md bg-white">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 text-left text-xs uppercase tracking-[0.15em] font-bold text-[#0F2542] flex items-center justify-between"
      >
        Filtros avançados
        <span>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-4 py-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">

          {/* Equipe responsável */}
          <div>
            <label className="text-[10px] uppercase tracking-[0.15em] text-[#708278] font-bold">
              Equipe responsável
            </label>
            <select
              value={filters.teamId || ""}
              onChange={(e) => setFilters({ ...filters, teamId: e.target.value })}
              className="mt-1 w-full border border-[#E2E8E4] rounded-md px-2 py-1 text-sm"
            >
              <option value="">Todas</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Motorista titular */}
          <div>
            <label className="text-[10px] uppercase tracking-[0.15em] text-[#708278] font-bold">
              Motorista titular
            </label>
            <select
              value={filters.driverId || ""}
              onChange={(e) => setFilters({ ...filters, driverId: e.target.value })}
              className="mt-1 w-full border border-[#E2E8E4] rounded-md px-2 py-1 text-sm"
            >
              <option value="">Todos</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Origem */}
          <div>
            <label className="text-[10px] uppercase tracking-[0.15em] text-[#708278] font-bold">
              Origem
            </label>
            <select
              value={filters.origem || ""}
              onChange={(e) => setFilters({ ...filters, origem: e.target.value })}
              className="mt-1 w-full border border-[#E2E8E4] rounded-md px-2 py-1 text-sm"
            >
              <option value="">Todas</option>
              <option value="proprio">Próprio</option>
              <option value="alugado">Alugado</option>
              <option value="prestacao">Prestação</option>
            </select>
          </div>

          {/* CRLV */}
          <div>
            <label className="text-[10px] uppercase tracking-[0.15em] text-[#708278] font-bold">
              CRLV
            </label>
            <select
              value={filters.crlv || ""}
              onChange={(e) => setFilters({ ...filters, crlv: e.target.value })}
              className="mt-1 w-full border border-[#E2E8E4] rounded-md px-2 py-1 text-sm"
            >
              <option value="">Todos</option>
              <option value="vencido">Vencido</option>
              <option value="vence30">Vence em até 30 dias</option>
            </select>
          </div>

          {/* Ano */}
          <div>
            <label className="text-[10px] uppercase tracking-[0.15em] text-[#708278] font-bold">
              Ano
            </label>
            <input
              type="number"
              value={filters.ano || ""}
              onChange={(e) => setFilters({ ...filters, ano: e.target.value })}
              className="mt-1 w-full border border-[#E2E8E4] rounded-md px-2 py-1 text-sm"
            />
          </div>

        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   MAIN PAGE
--------------------------------------------------------- */
export default function VeiculosList() {
  const { profile } = useAuth();
  const [items, setItems] = useState([]);
  const [team, setTeam] = useState(null);

  // Filtros avançados
  const [filters, setFilters] = useState({
    teamId: "",
    driverId: "",
    origem: "",
    crlv: "",
    ano: "",
  });

  // Filtro por status (cards)
  const [filter, setFilter] = useState("todos");

  // Carregar equipes
  const [teamsList, setTeamsList] = useState([]);
  const [driversList, setDriversList] = useState([]);

  // 🔵 AQUI — depois dos estados, antes dos useEffect
  const activeFilters = {
    status: filter !== "todos" ? filter : null,
    team: filters.teamId || null,
    driver: filters.driverId || null,
    origem: filters.origem || null,
    crlv: filters.crlv || null,
    ano: filters.ano || null,
  };

  const hasActiveFilters = Object.values(activeFilters).some(Boolean);

  /* ---------------------------------------------------------
     Carregar equipes e motoristas
  --------------------------------------------------------- */
  useEffect(() => {
    (async () => {
      const teamsSnap = await getDocs(collection(db, "teams"));
      setTeamsList(teamsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

      const driversSnap = await getDocs(collection(db, "drivers"));
      setDriversList(driversSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    })();
  }, []);

  /* ---------------------------------------------------------
     Carregar equipe do encarregado
  --------------------------------------------------------- */
  useEffect(() => {
    if (profile.role !== ROLES.ENCARREGADO) { setTeam(null); return; }
    (async () => {
      const snap = await getDocs(query(collection(db, "teams"), where("leaderUserId", "==", profile.id)));
      if (snap.empty) setTeam({ memberUserIds: [], memberDriverIds: [], _empty: true });
      else { const d = snap.docs[0]; setTeam({ id: d.id, ...d.data() }); }
    })();
  }, [profile]);

  /* ---------------------------------------------------------
     Carregar veículos
  --------------------------------------------------------- */
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "vehicles"), orderBy("createdAt", "desc")), (snap) => {
      let list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Filtrar encarregado
      if (profile.role === ROLES.ENCARREGADO && team) {
        const driverMembers = new Set([...(team.memberDriverIds || []), ...(team.memberUserIds || [])]);
        list = list.filter((v) => v.motoristaTitularId && driverMembers.has(v.motoristaTitularId));
      }

      setItems(list);
    });
    return () => unsub();
  }, [profile, team]);

  const showTeamBanner = profile.role === ROLES.ENCARREGADO && team;

  /* ---------------------------------------------------------
     Filtro por status (cards)
  --------------------------------------------------------- */
  const filteredItems = useMemo(() => {
    if (filter === "todos") return items;
    return items.filter((v) => v.status === filter);
  }, [items, filter]);

  /* ---------------------------------------------------------
     Filtros avançados
  --------------------------------------------------------- */
  const advancedFiltered = useMemo(() => {
    let list = filteredItems;

    if (filters.teamId) {
      list = list.filter(v => v.teamId === filters.teamId);
    }

    if (filters.driverId) {
      list = list.filter(v => v.motoristaTitularId === filters.driverId);
    }

    if (filters.origem) {
      list = list.filter(v => v.origem === filters.origem);
    }

    if (filters.crlv === "vencido") {
      list = list.filter(v => {
        const d = v.vencimentoCRLV ? new Date(v.vencimentoCRLV) : null;
        return d && d < new Date();
      });
    }

    if (filters.crlv === "vence30") {
      list = list.filter(v => {
        const d = v.vencimentoCRLV ? new Date(v.vencimentoCRLV) : null;
        const diff = d ? Math.floor((d - new Date()) / 86400000) : null;
        return diff !== null && diff <= 30 && diff >= 0;
      });
    }

    if (filters.ano) {
      list = list.filter(v => String(v.ano) === String(filters.ano));
    }

    return list;
  }, [filteredItems, filters]);

  /* ---------------------------------------------------------
     Paginação
  --------------------------------------------------------- */
  const { paged, ...pag } = usePagination(advancedFiltered, { defaultPerPage: 50 });

  /* ---------------------------------------------------------
     RENDER
  --------------------------------------------------------- */
  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto">

      <div className="text-xs uppercase tracking-[0.25em] text-[#708278] font-bold">Frota</div>
      <h1 className="font-[Outfit,sans-serif] text-3xl font-black tracking-tight text-[#0F1411] mt-2">Veículos</h1>
      <p className="text-sm text-[#4A564F] mt-2">Veículos criados via Requerimento. Só ficam ativos após aprovação do Departamento Pessoal.</p>

      {showTeamBanner && (
        <div className="mt-4 bg-[#EFF3F8] border border-[#2563EB]/30 rounded-md px-4 py-3 text-xs text-[#0F2542] flex items-center gap-2">
          <User size={16} weight="duotone" className="text-[#2563EB]" />
          {team._empty
            ? <span>Você ainda não foi atribuído a uma equipe pelo DP.</span>
            : <span>Filtrando pela sua equipe: <b>{team.name}</b> (veículos com motorista titular da equipe).</span>}
        </div>
      )}

      {/* CARDS */}
      <div className="grid sm:grid-cols-4 gap-3 mt-6">
        <Card
          label="Todos"
          value={items.length}
          color="#1E3A5F"
          icon={Truck}
          active={filter === "todos"}
          onClick={() => setFilter("todos")}
        />

        <Card
          label="Ativos"
          value={items.filter(v => v.status === "ACTIVE").length}
          color="#2E7D32"
          icon={Truck}
          active={filter === "ACTIVE"}
          onClick={() => setFilter(filter === "ACTIVE" ? "todos" : "ACTIVE")}
        />

        <Card
          label="Aguardando Ativação"
          value={items.filter(v => v.status === "PENDING_ACTIVATION").length}
          color="#8EA694"
          icon={Truck}
          active={filter === "PENDING_ACTIVATION"}
          onClick={() => setFilter(filter === "PENDING_ACTIVATION" ? "todos" : "PENDING_ACTIVATION")}
        />

        <Card
          label="Pré-Cadastro"
          value={items.filter(v => v.status === "PRE_REGISTERED").length}
          color="#D9A05B"
          icon={Truck}
          active={filter === "PRE_REGISTERED"}
          onClick={() => setFilter(filter === "PRE_REGISTERED" ? "todos" : "PRE_REGISTERED")}
        />
      </div>

      {/* BANNER DE FILTRO ATIVO */}
      {hasActiveFilters && (
        <div className="mt-3 mb-3 flex items-center gap-2 text-[11px] text-[#4A564F] flex-wrap">

          <span className="font-bold uppercase tracking-[0.15em] text-[#708278]">
            Filtros ativos:
          </span>

          {/* Status */}
          {activeFilters.status && (
            <span className="bg-[#0F2542] text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-[0.1em]">
              {VEHICLE_STATUS_LABEL[activeFilters.status] || activeFilters.status}
            </span>
          )}

          {/* Equipe */}
          {activeFilters.team && (
            <span className="bg-[#2563EB] text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-[0.1em]">
              Equipe: {teamsList.find(t => t.id === activeFilters.team)?.name || activeFilters.team}
            </span>
          )}

          {/* Motorista */}
          {activeFilters.driver && (
            <span className="bg-[#10B981] text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-[0.1em]">
              Motorista: {driversList.find(d => d.id === activeFilters.driver)?.name || activeFilters.driver}
            </span>
          )}

          {/* Origem */}
          {activeFilters.origem && (
            <span className="bg-[#D9A05B] text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-[0.1em]">
              Origem: {activeFilters.origem}
            </span>
          )}

          {/* CRLV */}
          {activeFilters.crlv && (
            <span className="bg-[#C25D41] text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-[0.1em]">
              CRLV: {activeFilters.crlv === "vencido" ? "Vencido" : "Vence em até 30 dias"}
            </span>
          )}

          {/* Ano */}
          {activeFilters.ano && (
            <span className="bg-[#1E3A5F] text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-[0.1em]">
              Ano: {activeFilters.ano}
            </span>
          )}

          {/* Botão limpar */}
          <button
            onClick={() => {
              setFilter("todos");
              setFilters({
                teamId: "",
                driverId: "",
                origem: "",
                crlv: "",
                ano: "",
              });
            }}
            className="text-[#1E3A5F] font-bold uppercase tracking-[0.15em] hover:underline ml-2"
          >
            Limpar
          </button>

        </div>
      )}


      {/* FILTROS AVANÇADOS */}
      <AdvancedFilters
        filters={filters}
        setFilters={setFilters}
        teams={teamsList}
        drivers={driversList}
      />

      {/* LISTA */}
      <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {advancedFiltered.length === 0 && (
          <div className="col-span-full border border-dashed border-[#E2E8E4] rounded-md p-10 text-center">
            <Truck size={32} className="mx-auto text-[#708278]" weight="duotone" />
            <div className="text-sm text-[#4A564F] mt-2">Nenhum veículo nessa categoria.</div>
          </div>
        )}

        {paged.map((v) => {
          const crlvDate = v.vencimentoCRLV ? new Date(v.vencimentoCRLV) : null;
          const daysToCRLV = crlvDate ? Math.floor((crlvDate - new Date()) / 86400000) : null;
          const crlvLabel = daysToCRLV === null ? null
            : daysToCRLV < 0 ? `CRLV vencido há ${Math.abs(daysToCRLV)}d`
              : daysToCRLV <= 30 ? `CRLV vence em ${daysToCRLV}d` : null;

          const crlvClass = daysToCRLV < 0
            ? "bg-[#C25D41]/15 text-[#8B3A26] border-[#C25D41]/40"
            : "bg-[#D9A05B]/15 text-[#8B5E2B] border-[#D9A05B]/40";

          return (
            <Link
              to={`/veiculos/${v.id}`}
              key={v.id}
              className="group bg-white border border-[#E2E8E4] rounded-md p-5 hover:border-[#2563EB]/60 hover:shadow-md transition-all block"
            >
              <div className="flex items-start justify-between">
                <Truck size={22} className="text-[#1E3A5F]" weight="duotone" />
                <span className={`text-[10px] uppercase tracking-[0.15em] font-bold px-2 py-1 rounded-md border ${STATUS_COLOR[v.status] || ""}`}>
                  {VEHICLE_STATUS_LABEL[v.status] || v.status}
                </span>
              </div>

              <div className="mt-3 text-xs uppercase tracking-[0.15em] text-[#708278] font-bold">TAG · Placa</div>

              <div className="font-[Outfit,sans-serif] text-xl font-black tracking-tight text-[#0F1411] flex items-center gap-2 flex-wrap">
                <span>{v.tag}</span>
                {v.placa && (
                  <span className="text-sm font-bold bg-[#1E3A5F] text-white px-2 py-0.5 rounded">
                    {v.placa}
                  </span>
                )}
              </div>

              <div className="text-sm text-[#4A564F] mt-1">
                {v.marca} {v.modelo} · {v.ano}
              </div>

              {v.valorAluguelMensal > 0 && (
                <div className="text-xs text-[#1B5E20] mt-2 font-bold">
                  R$ {Number(v.valorAluguelMensal).toLocaleString("pt-BR")}/mês · {
                    v.origem === "alugado"
                      ? "Alugado"
                      : v.origem === "prestacao"
                        ? "Prestação"
                        : "Próprio"
                  }
                </div>
              )}

              {crlvLabel && (
                <div
                  className={`mt-2 inline-block text-[10px] uppercase tracking-[0.1em] font-bold px-2 py-1 rounded border ${crlvClass}`}
                >
                  {crlvLabel}
                </div>
              )}

              <div className="text-xs text-[#708278] mt-2 flex items-center justify-between">
                <span>
                  {v.centro_custo || ""} {v.unidade ? `· ${v.unidade}` : ""}
                </span>
                <CaretRight
                  size={14}
                  className="text-[#708278] group-hover:text-[#2563EB] group-hover:translate-x-0.5 transition-all"
                />
              </div>
            </Link>
          );
        })}
      </div>

      <Pagination {...pag} />
    </div>
  );
}
