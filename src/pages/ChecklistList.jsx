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
  const isMotorista = profile.role === ROLES.MOTORISTA;
  const [items, setItems] = useState([]);
  const [team, setTeam] = useState(null);

  const [search, setSearch] = useState("");

  // Janela permitida para o MOTORISTA: 3 dias anteriores + hoje.
  // Calculada com base no relógio do cliente, mas o filtro `where(createdAt >= cutoff)`
  // é aplicado no servidor — mesmo que o motorista mude o clock local, o
  // Firestore só devolve o que atende à condição. Reduz também as leituras
  // (motorista puxa no máximo ~4 dias, não histórico completo).
  const motoristaCutoffISO = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - 3);
    return d.toISOString().slice(0, 10);
  }, []);
  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // período — o motorista inicia com a janela travada (últimos 3 dias) e
  // não consegue mover os inputs para fora dessa janela (min/max no <input>).
  const [dateStart, setDateStart] = useState(isMotorista ? motoristaCutoffISO : "");
  const [dateEnd, setDateEnd] = useState(isMotorista ? todayISO : "");

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
    if (isMotorista) {
      // Motorista: query no servidor limitada aos últimos 3 dias (economia de
      // leitura + trava anti-burla). Cutoff calculado uma vez ao montar.
      const cutoff = new Date(motoristaCutoffISO + "T00:00:00");
      q = query(
        collection(db, "checklists"),
        where("filledByUserId", "==", profile.id),
        where("createdAt", ">=", cutoff),
      );
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
  }, [profile, team, isMotorista, motoristaCutoffISO]);

  const showTeamBanner = profile.role === ROLES.ENCARREGADO && team;

  // validação período
  const invalidDateRange =
    dateStart &&
    dateEnd &&
    new Date(dateStart) > new Date(dateEnd);

  // ─── Predicados de cada dimensão ────────────────────────────────────────
  // Isolados para permitir "facet counting": cada card de filtro é contado
  // sobre a lista já filtrada por TODAS as outras dimensões (menos a dele),
  // fazendo os contadores serem dinâmicos e coerentes com o que o usuário vê.
  const inDateRange = (c) => {
    if (!dateStart && !dateEnd) return true;
    const d = c.createdAt?.toDate?.();
    if (!d) return false;
    const iso = d.toISOString().slice(0, 10);
    if (dateStart && iso < dateStart) return false;
    if (dateEnd && iso > dateEnd) return false;
    return true;
  };
  const isVistoria = (c) => c.isFirstExecution || c.type === "vistoria" || c.type === "vistoria_entrada";
  const matchType = (c) => {
    if (!typeFilter) return true;
    return typeFilter === "VISTORIA" ? isVistoria(c) : !isVistoria(c);
  };
  const srcOf = (c) => c.source || (c.type === "manual" ? "manual" : "digital");
  const matchSource = (c) => {
    if (!sourceFilter) return true;
    return sourceFilter === "APP" ? srcOf(c) === "digital" : srcOf(c) === "manual";
  };
  const matchVehicle = (c) => !vehicleFilter || c.vehicleTag === vehicleFilter;
  const driverOf = (c) => c.driverName || c.filledByName;
  const matchDriver = (c) => !driverFilter || driverOf(c) === driverFilter;
  const matchSearch = (c) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    const d = c.createdAt?.toDate?.();
    return [c.templateName, c.vehicleTag, c.driverName, c.filledByName, c.source, c.type, d?.toLocaleString("pt-BR")]
      .some((f) => f && String(f).toLowerCase().includes(term));
  };

  // Lista final (para tabela) — todos os filtros aplicados.
  const filteredItems = useMemo(() => {
    return items.filter((c) => inDateRange(c) && matchType(c) && matchSource(c) && matchVehicle(c) && matchDriver(c) && matchSearch(c));
     
  }, [items, dateStart, dateEnd, typeFilter, sourceFilter, vehicleFilter, driverFilter, search]);

  // Para cada dimensão dos filtros avançados, aplicamos TODOS os filtros
  // EXCETO o da própria dimensão — assim o número em cada card reflete
  // "quantos apareceriam se eu clicasse aqui, mantendo os outros filtros".
  const listForType = useMemo(
    () => items.filter((c) => inDateRange(c) && matchSource(c) && matchVehicle(c) && matchDriver(c) && matchSearch(c)),
     
    [items, dateStart, dateEnd, sourceFilter, vehicleFilter, driverFilter, search]
  );
  const listForSource = useMemo(
    () => items.filter((c) => inDateRange(c) && matchType(c) && matchVehicle(c) && matchDriver(c) && matchSearch(c)),
     
    [items, dateStart, dateEnd, typeFilter, vehicleFilter, driverFilter, search]
  );
  const listForVehicle = useMemo(
    () => items.filter((c) => inDateRange(c) && matchType(c) && matchSource(c) && matchDriver(c) && matchSearch(c)),
     
    [items, dateStart, dateEnd, typeFilter, sourceFilter, driverFilter, search]
  );
  const listForDriver = useMemo(
    () => items.filter((c) => inDateRange(c) && matchType(c) && matchSource(c) && matchVehicle(c) && matchSearch(c)),
     
    [items, dateStart, dateEnd, typeFilter, sourceFilter, vehicleFilter, search]
  );

  // Resumo dinâmico (respeita TODOS os filtros ativos — inclusive período).
  const summary = useMemo(() => {
    const total = filteredItems.length;
    const vistorias = filteredItems.filter(isVistoria).length;
    return { total, vistorias, diarios: total - vistorias };
  }, [filteredItems]);

  const { paged, ...pag } = usePagination(filteredItems, { defaultPerPage: 10 });

  // As opções de veículo/motorista mostradas nos cards saem das listas
  // facetadas — assim, ao aplicar um filtro de período que exclui o veículo,
  // ele some da lista de opções também (não fica card "morto").
  const vehicleTags = Array.from(new Set(listForVehicle.map((c) => c.vehicleTag).filter(Boolean))).sort();
  const driverNames = Array.from(new Set(listForDriver.map(driverOf).filter(Boolean))).sort();

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
            min={isMotorista ? motoristaCutoffISO : undefined}
            max={isMotorista ? todayISO : undefined}
            data-testid="date-start"
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
            min={isMotorista ? motoristaCutoffISO : undefined}
            max={isMotorista ? todayISO : undefined}
            data-testid="date-end"
            className="w-full mt-1 px-3 py-2 border border-[#E2E8E4] rounded-md text-sm focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
          />
        </div>

        <div className="flex items-end">
          <button
            onClick={() => {
              // Motorista sempre volta para a janela travada; demais perfis
              // limpam de fato (visão completa do banco).
              if (isMotorista) {
                setDateStart(motoristaCutoffISO);
                setDateEnd(todayISO);
              } else {
                setDateStart("");
                setDateEnd("");
              }
            }}
            className="w-full px-3 py-2 bg-[#1E3A5F] text-white rounded-md text-xs font-bold uppercase tracking-[0.15em] hover:bg-[#162a45]"
          >
            {isMotorista ? "Voltar aos 3 dias" : "Limpar período"}
          </button>
        </div>

      </div>

      {isMotorista && (
        <div className="mt-2 text-[11px] text-[#0F2542] bg-[#EFF3F8] border border-[#2563EB]/30 rounded px-3 py-2" data-testid="hint-janela-motorista">
          Você consulta apenas os <b>3 dias anteriores + hoje</b>. Para históricos mais longos, procure o Adm de Frota.
        </div>
      )}

      {invalidDateRange && (
        <div className="mt-2 text-red-600 text-xs font-bold">
          A data de início não pode ser maior que a data de fim.
        </div>
      )}

      {/* filtros avançados — ocultos para o motorista. Ele consulta só o
          próprio histórico dos últimos 3 dias; segmentar por Tipo/Origem/
          Veículo/Motorista não faz sentido no perfil dele. */}
      {!isMotorista && (
        <MainCollapse>
          <div className="grid lg:grid-cols-4 gap-4">

          {/* tipo */}
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#708278] mb-2">Tipo</div>
            <div className="space-y-2">
              <FilterCard
                label="Vistoria"
                value={listForType.filter(isVistoria).length}
                color="#4A7A8C"
                active={typeFilter === "VISTORIA"}
                onClick={() => setTypeFilter(typeFilter === "VISTORIA" ? null : "VISTORIA")}
              />

              <FilterCard
                label="Diário"
                value={listForType.filter((c) => !isVistoria(c)).length}
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
                value={listForSource.filter((c) => srcOf(c) === "digital").length}
                color="#2563EB"
                active={sourceFilter === "APP"}
                onClick={() => setSourceFilter(sourceFilter === "APP" ? null : "APP")}
              />

              <FilterCard
                label="Papel"
                value={listForSource.filter((c) => srcOf(c) === "manual").length}
                color="#8EA694"
                active={sourceFilter === "PAPEL"}
                onClick={() => setSourceFilter(sourceFilter === "PAPEL" ? null : "PAPEL")}
              />
            </div>
          </div>

          {/* veículo */}
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#708278] mb-2">Veículo</div>
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {vehicleTags.length === 0 && (
                <div className="text-[11px] italic text-[#708278] py-2">Nenhum veículo no período.</div>
              )}
              {vehicleTags.map((tag) => (
                <FilterCard
                  key={tag}
                  label={tag}
                  value={listForVehicle.filter((c) => c.vehicleTag === tag).length}
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
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {driverNames.length === 0 && (
                <div className="text-[11px] italic text-[#708278] py-2">Nenhum motorista no período.</div>
              )}
              {driverNames.map((name) => (
                <FilterCard
                  key={name}
                  label={name}
                  value={listForDriver.filter((c) => driverOf(c) === name).length}
                  color="#2563EB"
                  active={driverFilter === name}
                  onClick={() => setDriverFilter(driverFilter === name ? null : name)}
                />
              ))}
            </div>
          </div>

          </div>
        </MainCollapse>
      )}

      {/* Resumo dinâmico — só faz sentido quando os filtros avançados estão
          disponíveis (Encarregado/Frota/Admin). Para motorista não exibimos. */}
      {!isMotorista && (
      <div className="mt-4 grid grid-cols-3 gap-3" data-testid="checklists-summary">
        <div className="bg-white border border-[#E2E8E4] rounded-md px-4 py-3">
          <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#708278]">Total no filtro</div>
          <div className="text-2xl font-black text-[#0F1411] leading-none mt-1" data-testid="summary-total">{summary.total}</div>
        </div>
        <div className="bg-white border border-[#E2E8E4] rounded-md px-4 py-3">
          <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#708278]">Vistorias</div>
          <div className="text-2xl font-black text-[#2E4F5C] leading-none mt-1" data-testid="summary-vistorias">{summary.vistorias}</div>
        </div>
        <div className="bg-white border border-[#E2E8E4] rounded-md px-4 py-3">
          <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#708278]">Diários</div>
          <div className="text-2xl font-black text-[#1E3A5F] leading-none mt-1" data-testid="summary-diarios">{summary.diarios}</div>
        </div>
      </div>
      )}

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
              // Motorista mantém a janela travada (3 dias); demais limpam.
              if (isMotorista) {
                setDateStart(motoristaCutoffISO);
                setDateEnd(todayISO);
              } else {
                setDateStart("");
                setDateEnd("");
              }
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
