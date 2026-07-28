import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { collection, onSnapshot, orderBy, query, where, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { ROLES, VEHICLE_STATUS } from "../lib/constants";
import { ClipboardText, CaretRight, Truck, User, Warning, WhatsappLogo } from "@phosphor-icons/react";
import Pagination, { usePagination } from "../components/Pagination";
import FilterCard from "../components/FilterCard";
import { buildWaLink } from "../lib/whatsapp";

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

  // ─── Auditoria: Veículos sem checklist no período ───────────────────────
  // Cruzamos os veículos ativos com os `filteredItems` (checklists no
  // período selecionado). Os veículos ativos que NÃO aparecem na lista de
  // vehicleId dos filteredItems são o "gap" — foco da auditoria do Frota.
  //
  // Enriquecemos com nome do encarregado (via team + users) e telefones
  // para permitir cobrança direta via WhatsApp (mesmo padrão do dashboard).
  // Só executa quando: (1) usuário não é motorista; (2) há filtro de data
  // ativo (auditoria "cega" sobre todo o histórico não faz sentido).
  const [ativosMap, setAtivosMap] = useState(null); // Map<vehicleId, veh+enriched> | null
  useEffect(() => {
    if (isMotorista) { setAtivosMap(null); return; }
    let cancelled = false;
    (async () => {
      const vSnap = await getDocs(query(collection(db, "vehicles"), where("status", "==", VEHICLE_STATUS.ACTIVE)));
      const ativos = vSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const teamIds = Array.from(new Set(ativos.map((v) => v.teamId).filter(Boolean)));
      const driverIds = Array.from(new Set(ativos.flatMap((v) => Array.isArray(v.motoristasTitularesIds) ? v.motoristasTitularesIds : [])));
      const [teamsSnap, usersSnap, driversSnap] = await Promise.all([
        teamIds.length > 0 ? getDocs(collection(db, "teams")) : Promise.resolve(null),
        teamIds.length > 0 ? getDocs(collection(db, "users")) : Promise.resolve(null),
        driverIds.length > 0 ? getDocs(collection(db, "drivers")) : Promise.resolve(null),
      ]);
      const usersById = new Map();
      usersSnap?.forEach((u) => usersById.set(u.id, u.data()));
      const teamMap = new Map();
      teamsSnap?.docs
        ?.map((t) => ({ id: t.id, ...t.data() }))
        ?.filter((t) => teamIds.includes(t.id))
        ?.forEach((t) => {
          const leader = usersById.get(t.leaderUserId);
          teamMap.set(t.id, { name: t.name, leaderName: leader?.name || null, leaderPhone: leader?.phone || null });
        });
      const driverMap = new Map();
      driversSnap?.forEach((d) => {
        if (driverIds.includes(d.id)) {
          const data = d.data();
          driverMap.set(d.id, { name: data.name || null, phone: data.phone || null });
        }
      });
      if (cancelled) return;
      const map = new Map();
      ativos.forEach((v) => {
        const teamInfo = v.teamId ? teamMap.get(v.teamId) : null;
        const ids = Array.isArray(v.motoristasTitularesIds) ? v.motoristasTitularesIds : (v.motoristaTitularId ? [v.motoristaTitularId] : []);
        const nomes = Array.isArray(v.motoristasTitularesNomes) ? v.motoristasTitularesNomes : (v.motoristaTitularNome ? [v.motoristaTitularNome] : []);
        const motoristas = ids.length > 0
          ? ids.map((id, i) => ({ id, name: driverMap.get(id)?.name || nomes[i] || null, phone: driverMap.get(id)?.phone || null }))
          : nomes.map((n) => ({ id: null, name: n, phone: null }));
        map.set(v.id, {
          ...v,
          _equipeNome: teamInfo?.name || null,
          _encarregadoNome: teamInfo?.leaderName || null,
          _encarregadoPhone: teamInfo?.leaderPhone || null,
          _motoristas: motoristas,
        });
      });
      setAtivosMap(map);
    })();
    return () => { cancelled = true; };
  }, [isMotorista]);

  // Só faz sentido mostrar auditoria com um período delimitado (evita listar
  // veículos sem checklist "de sempre" — pesado e sem contexto).
  const auditingPeriod = !isMotorista && (dateStart || dateEnd);

  // Cálculo dia-a-dia: para cada veículo ativo, montamos a lista de datas
  // esperadas no período (limitada superiormente por HOJE — não contamos
  // "checklists no futuro") e comparamos com as datas em que ele
  // efetivamente teve checklist. O total é a soma dessas pendências.
  //
  // Também respeita `activatedAt` do veículo: se o equipamento só entrou
  // ativo no meio do período, expected começa a partir dessa data.
  const auditoria = useMemo(() => {
    if (!auditingPeriod || !ativosMap) return { list: [], totalPendencias: 0, endEffISO: null };
    // Janela real (capada em hoje):
    const startISO = dateStart || todayISO; // sem dateStart faz auditoria só de hoje
    const endISO = (!dateEnd || dateEnd > todayISO) ? todayISO : dateEnd;
    if (startISO > endISO) return { list: [], totalPendencias: 0, endEffISO: endISO };

    // Gera todas as datas ISO no intervalo [startISO, endISO] — considerando
    // APENAS dias úteis (segunda a sexta). Sábado (getDay=6) e domingo
    // (getDay=0) são ignorados para não inflar o total de "checklists
    // faltantes" com dias em que a operação está parada.
    const allDates = [];
    const cur = new Date(startISO + "T00:00:00");
    const end = new Date(endISO + "T00:00:00");
    while (cur <= end) {
      const dow = cur.getDay();
      if (dow !== 0 && dow !== 6) {
        allDates.push(cur.toISOString().slice(0, 10));
      }
      cur.setDate(cur.getDate() + 1);
    }

    // Agrupa checklists do período por veículo → Set de datas distintas.
    const datesByVeh = new Map();
    filteredItems.forEach((c) => {
      if (!c.vehicleId) return;
      const cd = c.createdAt?.toDate?.();
      if (!cd) return;
      const iso = cd.toISOString().slice(0, 10);
      if (!datesByVeh.has(c.vehicleId)) datesByVeh.set(c.vehicleId, new Set());
      datesByVeh.get(c.vehicleId).add(iso);
    });

    const toISO = (v) => {
      const d = v?.toDate ? v.toDate() : (v ? new Date(v) : null);
      return d && !isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : null;
    };

    let totalPendencias = 0;
    const list = [];
    for (const v of ativosMap.values()) {
      const activatedISO = toISO(v.activatedAt);
      // datas esperadas para ESTE veículo: só a partir da ativação.
      const expected = activatedISO
        ? allDates.filter((d) => d >= activatedISO)
        : allDates;
      if (expected.length === 0) continue;
      const filled = datesByVeh.get(v.id) || new Set();
      const missing = expected.filter((d) => !filled.has(d));
      if (missing.length > 0) {
        totalPendencias += missing.length;
        list.push({
          ...v,
          _expectedCount: expected.length,
          _missingCount: missing.length,
          _filledCount: expected.length - missing.length,
        });
      }
    }
    // Ordena por criticidade (mais dias faltando primeiro).
    list.sort((a, b) => b._missingCount - a._missingCount);
    return { list, totalPendencias, endEffISO: endISO };
  }, [auditingPeriod, ativosMap, filteredItems, dateStart, dateEnd, todayISO]);
  const veiculosSemChecklist = auditoria.list;

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

      {/* Auditoria — veículos ativos SEM checklist no período selecionado.
          Só aparece para não-motorista quando há filtro de data ativo.
          Cálculo é dia-a-dia (respeita activatedAt do veículo) e capa em
          HOJE — não conta "checklists no futuro". */}
      {auditingPeriod && ativosMap && (
        <div className="mt-4 border border-[#DC2626]/30 bg-[#FEF2F2] rounded-md p-4" data-testid="auditoria-sem-checklist">
          <div className="flex items-start gap-2 mb-3">
            <Warning size={18} weight="duotone" className="text-[#991B1B] mt-0.5" />
            <div className="flex-1">
              <div className="text-xs uppercase tracking-[0.2em] font-bold text-[#991B1B]" data-testid="auditoria-titulo">
                {veiculosSemChecklist.length} veículo(s) sem preenchimento — {auditoria.totalPendencias} checklist(s) faltante(s)
              </div>
              <div className="text-[11px] text-[#7F1D1D] mt-1">
                Período apurado: {dateStart || todayISO} → {auditoria.endEffISO || todayISO}
                {" · considerando apenas dias úteis (seg-sex)"}
                {dateEnd && dateEnd > todayISO && (
                  <span className="ml-1 italic">
                    (fim solicitado {dateEnd} foi capado em hoje — não contamos dias futuros)
                  </span>
                )}
              </div>
            </div>
          </div>
          {veiculosSemChecklist.length === 0 ? (
            <div className="text-sm text-[#166534] italic py-2">
              ✅ Todos os veículos ativos tiveram checklist em cada dia do período. Bom trabalho!
            </div>
          ) : (
            <ul className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {veiculosSemChecklist.map((v) => {
                const vehLabel = v.tag || v.placa || v.id.slice(0, 8);
                const vehSubtitle = [v.marca, v.modelo].filter(Boolean).join(" ");
                const checklistUrl = `${window.location.origin}/checklist/digital`;
                const periodoTxt = `${dateStart || "início"} a ${auditoria.endEffISO || "hoje"}`;
                const msgMotorista = `Olá! O veículo ${vehLabel}${vehSubtitle ? ` (${vehSubtitle})` : ""} está com ${v._missingCount} dia(s) sem checklist no período ${periodoTxt}. Por favor, preencha agora: ${checklistUrl}`;
                const msgEncarregado = `Olá! O veículo ${vehLabel}${vehSubtitle ? ` (${vehSubtitle})` : ""} da equipe "${v._equipeNome || ""}" está com ${v._missingCount} dia(s) sem checklist no período ${periodoTxt}. Favor providenciar.`;
                return (
                  <li key={v.id} className="border border-[#DC2626]/20 bg-white rounded px-3 py-2.5" data-testid={`sem-checklist-${v.id}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <Link to={`/veiculos/${v.id}`} className="text-sm text-[#0F2542] font-bold hover:underline">
                          {vehLabel}{vehSubtitle ? ` — ${vehSubtitle}` : ""}
                        </Link>
                        <div className="text-[11px] text-[#4A564F] mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span>
                            <b className="text-[#708278] uppercase tracking-[0.1em] text-[10px] mr-1">Encarregado:</b>
                            {v._encarregadoNome || <em className="text-[#9CA3AF]">não vinculado</em>}
                          </span>
                          {v._encarregadoNome && v._encarregadoPhone && (
                            <WaChip phone={v._encarregadoPhone} message={msgEncarregado} testId={`wa-enc-${v.id}`} />
                          )}
                          {v._equipeNome && (
                            <span className="ml-2">
                              <b className="text-[#708278] uppercase tracking-[0.1em] text-[10px] mr-1">Equipe:</b>
                              {v._equipeNome}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#4A564F] mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                          <b className="text-[#708278] uppercase tracking-[0.1em] text-[10px] mr-1">Motoristas:</b>
                          {v._motoristas.length === 0
                            ? <em className="text-[#9CA3AF]">nenhum titular</em>
                            : v._motoristas.map((m, i) => (
                                <span key={m.id || `${m.name}-${i}`} className="inline-flex items-center gap-1">
                                  {m.name || <em className="text-[#9CA3AF]">(sem nome)</em>}
                                  {m.phone && (
                                    <WaChip phone={m.phone} message={msgMotorista} testId={`wa-mot-${v.id}-${i}`} />
                                  )}
                                  {i < v._motoristas.length - 1 && <span className="text-[#CBD5E1]">·</span>}
                                </span>
                              ))}
                        </div>
                      </div>
                      <div className="text-right shrink-0 self-center">
                        <div className="text-[#991B1B] text-lg font-black leading-none" data-testid={`missing-count-${v.id}`}>
                          {v._missingCount}
                        </div>
                        <div className="text-[9px] uppercase tracking-[0.1em] font-bold text-[#991B1B]">
                          dia{v._missingCount > 1 ? "s" : ""} sem checklist
                        </div>
                        <div className="text-[10px] text-[#708278] mt-0.5">
                          {v._filledCount}/{v._expectedCount} feitos
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
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

/**
 * Chip pequeno "abrir WhatsApp" — usado na seção de auditoria "sem
 * checklist no período". Se o telefone estiver sujo, `buildWaLink` retorna
 * null e o botão simplesmente não é renderizado.
 */
function WaChip({ phone, message, testId }) {
  const url = buildWaLink(phone, message);
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title="Cobrar via WhatsApp"
      data-testid={testId}
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#128C7E] px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-[0.08em] transition-colors"
    >
      <WhatsappLogo size={12} weight="fill" />
      Cobrar
    </a>
  );
}
