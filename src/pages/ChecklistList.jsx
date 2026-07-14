import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { collection, onSnapshot, orderBy, query, where, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { ROLES } from "../lib/constants";
import { ClipboardText, CaretRight, Truck, User } from "@phosphor-icons/react";
import Pagination, { usePagination } from "../components/Pagination";
import FilterCard from "../components/FilterCard";

function MainCollapse({ children }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-4 border border-[#E2E8E4] rounded-md bg-white">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 text-left text-xs uppercase tracking-[0.15em] font-bold text-[#0F2542] flex items-center justify-between"
      >
        Filtros Avançados
        <span>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-4 py-4 space-y-4">
          {children}
        </div>
      )}
    </div>
  );
}

export default function ChecklistList() {
  const { profile } = useAuth();
  const [items, setItems] = useState([]);
  const [team, setTeam] = useState(null);

  const [search, setSearch] = useState("");

  // período
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");

  // filtros avançados
  const [typeFilter, setTypeFilter] = useState(null);
  const [sourceFilter, setSourceFilter] = useState(null);
  const [vehicleFilter, setVehicleFilter] = useState(null);
  const [driverFilter, setDriverFilter] = useState(null);

  // carregar equipe do encarregado
  useEffect(() => {
    if (profile.role !== ROLES.ENCARREGADO) { setTeam(null); return; }
    (async () => {
      const snap = await getDocs(query(collection(db, "teams"), where("leaderUserId", "==", profile.id)));
      if (snap.empty) setTeam({ memberUserIds: [], memberDriverIds: [], _empty: true });
      else {
        const d = snap.docs[0];
        setTeam({ id: d.id, ...d.data() });
      }
    })();
  }, [profile]);

  // carregar checklists
  useEffect(() => {
    let q;
    if (profile.role === ROLES.MOTORISTA) {
      q = query(collection(db, "checklists"), where("filledByUserId", "==", profile.id));
    } else {
      q = query(collection(db, "checklists"), orderBy("createdAt", "desc"));
    }

    const unsub = onSnapshot(q, (snap) => {
      let list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      if (profile.role === ROLES.ENCARREGADO && team) {
        const members = new Set([...(team.memberUserIds || []), profile.id]);
        const driverMembers = new Set(team.memberDriverIds || []);

        list = list.filter((c) =>
          members.has(c.filledByUserId) ||
          members.has(c.driverId) ||
          driverMembers.has(c.driverId)
        );
      }

      list.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setItems(list);
    });

    return () => unsub();
  }, [profile, team]);

  const showTeamBanner = profile.role === ROLES.ENCARREGADO && team;
  const isMotorista = profile.role === ROLES.MOTORISTA;

  // validação período
  const invalidDateRange =
    dateStart &&
    dateEnd &&
    new Date(dateStart) > new Date(dateEnd);

  // filtros
  const filteredItems = useMemo(() => {
    let list = [...items];

    // período
    if (dateStart || dateEnd) {
      list = list.filter((c) => {
        const d = c.createdAt?.toDate?.();
        if (!d) return false;

        const iso = d.toISOString().slice(0, 10);

        if (dateStart && iso < dateStart) return false;
        if (dateEnd && iso > dateEnd) return false;

        return true;
      });
    }

    // tipo
    if (typeFilter) {
      list = list.filter((c) => {
        const isVistoria =
          c.isFirstExecution ||
          c.type === "vistoria" ||
          c.type === "vistoria_entrada";

        if (typeFilter === "VISTORIA") return isVistoria;
        if (typeFilter === "DIARIO") return !isVistoria;
        return true;
      });
    }

    // origem
    if (sourceFilter) {
      list = list.filter((c) => {
        const src = c.source || (c.type === "manual" ? "manual" : "digital");
        if (sourceFilter === "APP") return src === "digital";
        if (sourceFilter === "PAPEL") return src === "manual";
        return true;
      });
    }

    // veículo
    if (vehicleFilter) {
      list = list.filter((c) => c.vehicleTag === vehicleFilter);
    }

    // motorista
    if (driverFilter) {
      list = list.filter((c) => (c.driverName || c.filledByName) === driverFilter);
    }

    // busca global
    if (search.trim()) {
      const term = search.toLowerCase();
      list = list.filter((c) => {
        const d = c.createdAt?.toDate?.();
        const fields = [
          c.templateName,
          c.vehicleTag,
          c.driverName,
          c.filledByName,
          c.source,
          c.type,
          d?.toLocaleString("pt-BR"),
        ];
        return fields.some((f) => f && String(f).toLowerCase().includes(term));
      });
    }

    return list;
  }, [items, dateStart, dateEnd, typeFilter, sourceFilter, vehicleFilter, driverFilter, search]);

  const { paged, ...pag } = usePagination(filteredItems, { defaultPerPage: 10 });

  const vehicleTags = Array.from(new Set(items.map((c) => c.vehicleTag).filter(Boolean)));
  const driverNames = Array.from(new Set(items.map((c) => (c.driverName || c.filledByName)).filter(Boolean)));

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">

      <div className="text-xs uppercase tracking-[0.25em] text-[#708278] font-bold">
        {isMotorista ? "Seus registros" : profile.role === ROLES.ENCARREGADO ? "Sua equipe" : "Operação"}
      </div>

      <h1 className="font-[Outfit,sans-serif] text-3xl font-black tracking-tight text-[#0F1411] mt-2">
        {isMotorista ? "Meus Checklists" : "Checklists"}
      </h1>

      <p className="text-sm text-[#4A564F] mt-2">
        {isMotorista
          ? "Histórico dos checklists que você enviou."
          : "Histórico de checklists registrados."}
      </p>

      {showTeamBanner && (
        <div className="mt-4 bg-[#EFF3F8] border border-[#2563EB]/30 rounded-md px-4 py-3 text-xs text-[#0F2542] flex items-center gap-2">
          <User size={16} weight="duotone" className="text-[#2563EB]" />
          {team._empty ? (
            <span>Você ainda não foi atribuído a uma equipe pelo DP.</span>
          ) : (
            <span>
              Filtrando pela equipe: <b>{team.name}</b> ·{" "}
              {(team.memberUserIds?.length || 0) + (team.memberDriverIds?.length || 0)} membros
            </span>
          )}
        </div>
      )}

      {/* busca */}
      <div className="mt-8">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por veículo, motorista, data, tipo, origem..."
          className="w-full px-4 py-3 border border-[#E2E8E4] rounded-md text-sm focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
        />
      </div>

      {/* período */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">

        <div>
          <label className="text-xs font-bold uppercase tracking-[0.15em] text-[#708278]">
            Data início
          </label>
          <input
            type="date"
            value={dateStart}
            onChange={(e) => setDateStart(e.target.value)}
            className="w-full mt-1 px-3 py-2 border border-[#E2E8E4] rounded-md text-sm focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
          />
        </div>

        <div>
          <label className="text-xs font-bold uppercase tracking-[0.15em] text-[#708278]">
            Data fim
          </label>
          <input
            type="date"
            value={dateEnd}
            onChange={(e) => setDateEnd(e.target.value)}
            className="w-full mt-1 px-3 py-2 border border-[#E2E8E4] rounded-md text-sm focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
          />
        </div>

        <div className="flex items-end">
          <button
            onClick={() => {
              setDateStart("");
              setDateEnd("");
            }}
            className="w-full px-3 py-2 bg-[#1E3A5F] text-white rounded-md text-xs font-bold uppercase tracking-[0.15em] hover:bg-[#162a45]"
          >
            Limpar período
          </button>
        </div>

      </div>

      {invalidDateRange && (
        <div className="mt-2 text-red-600 text-xs font-bold">
          A data de início não pode ser maior que a data de fim.
        </div>
      )}

      {/* filtros avançados */}
      <MainCollapse>
        <div className="grid lg:grid-cols-4 gap-4">

          {/* tipo */}
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#708278] mb-2">Tipo</div>
            <div className="space-y-2">
              <FilterCard
                label="Vistoria"
                value={items.filter((c) =>
                  c.isFirstExecution ||
                  c.type === "vistoria" ||
                  c.type === "vistoria_entrada"
                ).length}
                color="#4A7A8C"
                active={typeFilter === "VISTORIA"}
                onClick={() => setTypeFilter(typeFilter === "VISTORIA" ? null : "VISTORIA")}
              />

              <FilterCard
                label="Diário"
                value={items.filter((c) =>
                  !(c.isFirstExecution ||
                    c.type === "vistoria" ||
                    c.type === "vistoria_entrada")
                ).length}
                color="#1E3A5F"
                active={typeFilter === "DIARIO"}
                onClick={() => setTypeFilter(typeFilter === "DIARIO" ? null : "DIARIO")}
              />
            </div>
          </div>

          {/* origem */}
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#708278] mb-2">Origem</div>
            <div className="space-y-2">
              <FilterCard
                label="App"
                value={items.filter((c) =>
                  (c.source || (c.type === "manual" ? "manual" : "digital")) === "digital"
                ).length}
                color="#2563EB"
                active={sourceFilter === "APP"}
                onClick={() => setSourceFilter(sourceFilter === "APP" ? null : "APP")}
              />

              <FilterCard
                label="Papel"
                value={items.filter((c) =>
                  (c.source || (c.type === "manual" ? "manual" : "digital")) === "manual"
                ).length}
                color="#8EA694"
                active={sourceFilter === "PAPEL"}
                onClick={() => setSourceFilter(sourceFilter === "PAPEL" ? null : "PAPEL")}
              />
            </div>
          </div>

          {/* veículo */}
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#708278] mb-2">Veículo</div>
            <div className="space-y-2">
              {vehicleTags.map((tag) => (
                <FilterCard
                  key={tag}
                  label={tag}
                  value={items.filter((c) => c.vehicleTag === tag).length}
                  color="#1E3A5F"
                  active={vehicleFilter === tag}
                  onClick={() => setVehicleFilter(vehicleFilter === tag ? null : tag)}
                />
              ))}
            </div>
          </div>

          {/* motorista */}
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#708278] mb-2">Motorista</div>
            <div className="space-y-2">
              {driverNames.map((name) => (
                <FilterCard
                  key={name}
                  label={name}
                  value={items.filter((c) => (c.driverName || c.filledByName) === name).length}
                  color="#2563EB"
                  active={driverFilter === name}
                  onClick={() => setDriverFilter(driverFilter === name ? null : name)}
                />
              ))}
            </div>
          </div>

        </div>
      </MainCollapse>

      {/* banner filtros ativos */}
      {(typeFilter || sourceFilter || vehicleFilter || driverFilter || dateStart || dateEnd || search.trim()) && (
        <div className="mt-4 mb-4 flex items-center gap-2 text-[11px] text-[#4A564F] flex-wrap">
          <span className="font-bold uppercase tracking-[0.15em] text-[#708278]">Filtros ativos:</span>

          {typeFilter && <span className="bg-[#1E3A5F] text-white px-2 py-0.5 rounded-full">Tipo: {typeFilter}</span>}
          {sourceFilter && <span className="bg-[#2563EB] text-white px-2 py-0.5 rounded-full">Origem: {sourceFilter}</span>}
          {vehicleFilter && <span className="bg-[#4A7A8C] text-white px-2 py-0.5 rounded-full">Veículo: {vehicleFilter}</span>}
          {driverFilter && <span className="bg-[#2E7D32] text-white px-2 py-0.5 rounded-full">Motorista: {driverFilter}</span>}

          {dateStart && <span className="bg-[#D9A05B] text-white px-2 py-0.5 rounded-full">Início: {dateStart}</span>}
          {dateEnd && <span className="bg-[#D9A05B] text-white px-2 py-0.5 rounded-full">Fim: {dateEnd}</span>}

          {search.trim() && <span className="bg-[#708278] text-white px-2 py-0.5 rounded-full">Busca: {search}</span>}

          <button
            onClick={() => {
              setSearch("");
              setDateStart("");
              setDateEnd("");
              setTypeFilter(null);
              setSourceFilter(null);
              setVehicleFilter(null);
              setDriverFilter(null);
            }}
            className="text-[#1E3A5F] font-bold uppercase tracking-[0.15em] hover:underline ml-2"
          >
            Limpar
          </button>
        </div>
      )}

      {/* lista */}
      <div className="mt-4 space-y-2">
        {filteredItems.length === 0 && (
          <div className="border border-dashed border-[#E2E8E4] rounded-md p-10 text-center">
            <ClipboardText size={32} className="mx-auto text-[#708278]" weight="duotone" />
            <div className="text-sm text-[#4A564F] mt-2">Nenhum checklist encontrado.</div>
          </div>
        )}

        {paged.map((c) => {
          const isVistoria =
            c.isFirstExecution ||
            c.type === "vistoria" ||
            c.type === "vistoria_entrada";

          const src = c.source || (c.type === "manual" ? "manual" : "digital");

          const sourceLabel = isVistoria
            ? "Vistoria de Entrada"
            : src === "manual"
              ? "Diário · papel"
              : "Diário · app";

          return (
            <Link
              to={`/checklists/${c.id}`}
              key={c.id}
              className="group bg-white border border-[#E2E8E4] rounded-md p-5 flex items-center justify-between hover:border-[#2563EB]/60 hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-md flex items-center justify-center ${isVistoria ? "bg-[#4A7A8C]/15" : "bg-[#1E3A5F]/15"
                    }`}
                >
                  <ClipboardText
                    size={18}
                    weight="duotone"
                    className={isVistoria ? "text-[#2E4F5C]" : "text-[#1E3A5F]"}
                  />
                </div>

                <div>
                  <div className="text-sm font-bold text-[#0F1411]">
                    {c.templateName || "Checklist"}
                  </div>

                  <div className="text-xs text-[#708278] mt-0.5 flex items-center gap-2 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Truck size={12} /> {c.vehicleTag || "—"}
                    </span>

                    <span>·</span>

                    <span className="flex items-center gap-1">
                      <User size={12} /> {c.driverName || c.filledByName}
                    </span>

                    <span>·</span>

                    <span>
                      {c.createdAt?.toDate?.()?.toLocaleString?.("pt-BR") || c.date || ""}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span
                  className={`text-[10px] uppercase tracking-[0.15em] font-bold px-2.5 py-1 rounded-md border ${isVistoria
                      ? "bg-[#4A7A8C]/15 text-[#2E4F5C] border-[#4A7A8C]/40"
                      : "bg-[#1E3A5F]/15 text-[#0A1A2E] border-[#1E3A5F]/40"
                    }`}
                >
                  {sourceLabel}
                </span>

                <CaretRight
                  size={16}
                  className="text-[#708278] group-hover:text-[#2563EB] group-hover:translate-x-0.5 transition-all"
                />
              </div>
            </Link>
          );
        })}
      </div>

      <Pagination {...pag} testid="checklists-pagination" />
    </div>
  );
}
