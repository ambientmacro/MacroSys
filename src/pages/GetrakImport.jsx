import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { canViewChecklistsPainel } from "../lib/roles";
import { toast } from "sonner";
import {
  FileXls, Upload, Warning, MapPin, Truck, User, Clock, Info, MagnifyingGlass,
  CheckCircle, XCircle, Funnel, X,
} from "@phosphor-icons/react";

/**
 * Importação do relatório GETRAK (sistema de rastreio terceiro).
 *
 * Como o usuário usa:
 *  1. Exporta o relatório no GETRAK (planilha .xlsx)
 *  2. Faz upload aqui na aplicação
 *  3. A tela cruza por PLACA com os veículos cadastrados e exibe:
 *      • Onde cada veículo estava (último Local final)
 *      • Quem está vinculado (titular do veículo) × motorista reportado pelo GETRAK
 *      • Total de deslocamentos, distância, tempo em movimento / parado
 *      • Alertas: veículo no GETRAK que não está cadastrado / motorista divergente
 *
 * O parser tenta extrair a placa do formato "C01 PINETTI - KOU2F89" pegando o
 * trecho após o último " - " (último hífen com espaços), normalizando para
 * uppercase sem hífen para casar com `vehicle.placaNormalizada`.
 */

const norm = (s) => String(s || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Extrai a placa do campo "Apelido/Placa" — espera "<apelido> - <PLACA>". */
const extractPlate = (apelidoPlaca) => {
  const txt = String(apelidoPlaca || "").trim();
  if (!txt) return "";
  // Aceita "X - PLACA" ou "X-PLACA" ou "X PLACA". Pega o último token plausível.
  const parts = txt.split(/\s*[-–]\s*/);
  const candidate = parts[parts.length - 1] || "";
  const cleaned = norm(candidate);
  // Placa BR: 7 caracteres alfanuméricos (LLLNNNN ou Mercosul LLLNLNN).
  if (cleaned.length >= 6 && cleaned.length <= 8) return cleaned;
  // Tenta achar substring com formato placa em qualquer parte do texto.
  const m = norm(txt).match(/[A-Z]{3}[0-9][A-Z0-9][0-9]{2}/);
  return m ? m[0] : cleaned;
};

/**
 * GETRAK grava lat/lng juntos em uma mesma célula, separados por espaços.
 * Ex: "-20.31886   -40.39393". Retorna { lat, lng } ou null.
 */
const parseLatLng = (s) => {
  if (!s) return null;
  const m = String(s).match(/(-?\d+[.,]\d+)\s+(-?\d+[.,]\d+)/);
  if (!m) return null;
  const lat = parseFloat(m[1].replace(",", "."));
  const lng = parseFloat(m[2].replace(",", "."));
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return { lat, lng };
};

const parseTime = (hms) => {
  if (!hms) return 0;
  const m = String(hms).match(/(\d+):(\d+):(\d+)/);
  if (!m) return 0;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
};

const fmtSeconds = (s) => {
  if (!s) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h${String(m).padStart(2, "0")}`;
  return `${m}min`;
};

/**
 * Detecta dinamicamente onde está o cabeçalho real e parseia os dados.
 *
 * O relatório GETRAK tem linhas de título/resumo no topo antes do header.
 * Procuramos a primeira linha que contém os marcadores "Apelido/Placa" +
 * "Motorista" + "Hora início". Tudo acima é descartado; o resto vira dado
 * (e linhas-resumo tipo "Tempo total parado" são filtradas a seguir).
 */
const parseGetrakSheet = (workbook) => {
  const ws = workbook.Sheets[workbook.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  // Acha a linha de cabeçalho.
  const headerIdx = matrix.findIndex((row) =>
    row.some((c) => /apelido\s*\/\s*placa/i.test(String(c))) &&
    row.some((c) => /motorista/i.test(String(c))) &&
    row.some((c) => /hora\s+in[ií]cio/i.test(String(c)))
  );
  if (headerIdx < 0) return [];
  const header = matrix[headerIdx].map((c) => String(c).trim());
  const dataRows = matrix.slice(headerIdx + 1);
  return dataRows
    .map((row) => {
      const obj = {};
      header.forEach((h, i) => { obj[h] = row[i] ?? ""; });
      return obj;
    })
    // Descarta linhas-resumo (totalização), sub-headers repetidos e linhas em branco.
    .filter((r) => {
      const apl = String(r["Apelido/Placa"] || "").trim();
      const hora = String(r["Hora início"] || "").trim();
      if (!apl || !hora) return false;
      if (/tempo\s+total/i.test(apl)) return false;

      const localIni = String(r["Local inicial"] || "").trim();
      const localFim = String(r["Local final"] || "").trim();
      // Linha de TOTALIZAÇÃO: os locais vêm como "-" (traço), NÃO vazios.
      // Sem esse filtro, a distância do veículo fica DUPLICADA (ex.: 22.9→45.7 km).
      if (localIni === "-" || localFim === "-") return false;
      // Sub-headers do bloco de resumo do próximo veículo. O GETRAK repete
      // "Local inicial do período", "Local inicial" etc. como se fossem dados.
      const isHeaderLike = (s) => /^local\s+(inicial|final)(\s+do\s+per[ií]odo)?$/i.test(s);
      if (isHeaderLike(localIni) || isHeaderLike(localFim)) return false;

      return true;
    });
};

export default function GetrakImport() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);     // linhas cruas do relatório
  const [vehicles, setVehicles] = useState([]); // veículos do banco
  const [drivers, setDrivers] = useState([]);   // motoristas do banco
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [filterTipo, setFilterTipo] = useState("todos"); // todos | identificados | nao_cadastrados | divergentes
  const [searchPlate, setSearchPlate] = useState("");
  const [openVehicle, setOpenVehicle] = useState(null); // veículo selecionado para o modal de eventos

  if (!canViewChecklistsPainel(profile.role)) {
    return (
      <div className="p-10 text-center text-sm text-[#4A564F]">
        Acesso restrito ao Administrador de Frota.
      </div>
    );
  }

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setFileName(file.name);
    try {
      // Lê a planilha + carrega frota em paralelo.
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const json = parseGetrakSheet(wb);
      const [vSnap, dSnap] = await Promise.all([
        getDocs(collection(db, "vehicles")),
        getDocs(collection(db, "drivers")),
      ]);
      setVehicles(vSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setDrivers(dSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setRows(json);
      if (json.length === 0) {
        toast.error("Não consegui localizar o cabeçalho do relatório. Confirme que é o relatório GETRAK em .xlsx.");
      } else {
        toast.success(`${json.length} eventos importados — cruzando com a frota…`);
      }
      e.target.value = "";
    } catch (err) {
      toast.error("Falha ao ler a planilha. Confirme que é o relatório GETRAK em .xlsx.");
    } finally { setLoading(false); }
  };

  // Cruzamento: agrupa linhas por placa, calcula totais, casa com veículos.
  const cruzamento = useMemo(() => {
    if (rows.length === 0) return [];
    const byPlate = new Map();
    rows.forEach((r) => {
      const plate = extractPlate(r["Apelido/Placa"]);
      if (!plate) return;
      // Descarta o "lixo" típico do header repetido do GETRAK ("Apelido/Placa"
      // → vira "APELIDOPLACA" após normalização). Não bloqueia placas reais.
      if (plate === "APELIDOPLACA" || plate.startsWith("APELIDO")) return;
      if (plate === "MOTORISTA") return;
      if (!byPlate.has(plate)) byPlate.set(plate, { plate, lines: [], driverNames: new Set() });
      const g = byPlate.get(plate);
      g.lines.push(r);
      if (r["Motorista"] && r["Motorista"] !== "Sem motorista") g.driverNames.add(r["Motorista"]);
    });
    return [...byPlate.values()].map((g) => {
      const vehicle = vehicles.find((v) => (v.placaNormalizada || norm(v.placa)) === g.plate);
      const titulares = vehicle ? (
        Array.isArray(vehicle.motoristasTitularesIds) ? vehicle.motoristasTitularesIds : (vehicle.motoristaTitularId ? [vehicle.motoristaTitularId] : [])
      ) : [];
      const titularesNomes = titulares.map((id) => drivers.find((d) => d.id === id)?.name).filter(Boolean);
      const driversReported = [...g.driverNames];
      // Detecta divergência: motorista reportado pelo GETRAK ≠ titular cadastrado.
      const divergente = vehicle && titularesNomes.length > 0 && driversReported.length > 0
        && !driversReported.some((rep) => titularesNomes.some((t) => norm(t).includes(norm(rep)) || norm(rep).includes(norm(t))));
      const naoCadastrado = !vehicle;
      // Totais.
      const totalKm = g.lines.reduce((acc, r) => acc + (Number(String(r["Distância (km)"] || "0").replace(",", ".")) || 0), 0);
      const totalMov = g.lines.reduce((acc, r) => acc + parseTime(r["Tempo em movimento"]), 0);
      const totalOcioso = g.lines.reduce((acc, r) => acc + parseTime(r["Tempo ocioso"]), 0);
      // Duração total = soma da coluna "Duração" da planilha (movimento + ocioso).
      // Fallback: se a planilha não trouxer, aproxima somando movimento+ocioso.
      const totalDuracaoExcel = g.lines.reduce((acc, r) => acc + parseTime(r["Duração"]), 0);
      const totalDuracao = totalDuracaoExcel || (totalMov + totalOcioso);
      const last = g.lines[g.lines.length - 1];
      const first = g.lines[0];
      const latLngFinal = parseLatLng(last?.["Latitude e longitude final"]);
      const latLngInicial = parseLatLng(first?.["Latitude e longitude inicial"]);
      return {
        plate: g.plate,
        vehicle,
        titularesNomes,
        driversReported,
        divergente,
        naoCadastrado,
        totalKm,
        totalMov,
        totalOcioso,
        totalDuracao,
        linhas: g.lines.length,
        ultimoLocal: last?.["Local final"] || "—",
        ultimoFim: last?.["Hora final"] || "—",
        primeiroLocal: first?.["Local inicial"] || "—",
        primeiroInicio: first?.["Hora início"] || "—",
        latLngFinal,
        latLngInicial,
        rawLines: g.lines,
      };
    }).sort((a, b) => (a.naoCadastrado === b.naoCadastrado) ? 0 : a.naoCadastrado ? 1 : -1);
  }, [rows, vehicles, drivers]);

  const filtered = useMemo(() => {
    let list = cruzamento;
    if (filterTipo === "identificados") list = list.filter((c) => c.vehicle && !c.divergente);
    if (filterTipo === "nao_cadastrados") list = list.filter((c) => c.naoCadastrado);
    if (filterTipo === "divergentes") list = list.filter((c) => c.divergente);
    // Busca livre: procura em QUALQUER campo relevante (placa, tag,
    // marca/modelo, motorista titular, motorista GETRAK, último/primeiro
    // local — inclusive nome de rua) para facilitar a vida do usuário.
    const q = searchPlate.trim().toLowerCase();
    if (q) {
      list = list.filter((c) => {
        const haystack = [
          c.plate,
          c.vehicle?.tag,
          c.vehicle?.placa,
          c.vehicle?.marca,
          c.vehicle?.modelo,
          ...(c.titularesNomes || []),
          ...(c.driversReported || []),
          c.ultimoLocal,
          c.primeiroLocal,
        ].filter(Boolean).join(" ").toLowerCase();
        return haystack.includes(q);
      });
    }
    return list;
  }, [cruzamento, filterTipo, searchPlate]);

  const stats = useMemo(() => ({
    total: cruzamento.length,
    identificados: cruzamento.filter((c) => c.vehicle && !c.divergente).length,
    naoCadastrados: cruzamento.filter((c) => c.naoCadastrado).length,
    divergentes: cruzamento.filter((c) => c.divergente).length,
  }), [cruzamento]);

  return (
    <div className="px-4 sm:px-8 py-8 max-w-none mx-auto" data-testid="page-getrak">
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-[#708278] font-bold">Frota · Localização</div>
          <h1 className="font-[Outfit,sans-serif] text-3xl font-black tracking-tight text-[#0F1411] mt-1 flex items-center gap-2">
            <FileXls size={28} className="text-[#10B981]" weight="duotone" /> Importação GETRAK
          </h1>
          <p className="text-sm text-[#4A564F] mt-1">
            Importe o relatório de Deslocamentos/Paradas e cruze automaticamente com a frota cadastrada (por placa).
          </p>
        </div>
      </div>

      {/* Banner de instruções */}
      <div className="bg-[#FEF3C7] border border-[#F59E0B]/40 rounded-md p-4 mb-6 flex gap-3" data-testid="getrak-aviso">
        <Warning size={22} weight="duotone" className="text-[#92400E] shrink-0 mt-0.5" />
        <div className="text-sm text-[#92400E]">
          <strong>Importação de relatório GETRAK.</strong> Exporte o relatório
          de <em>Deslocamentos e Paradas</em> no formato Excel (.xlsx) e faça
          upload abaixo. O sistema cruza pela <strong>placa</strong> dos
          veículos cadastrados — você poderá ver onde cada equipamento estava e
          conferir se o motorista que aparece no checklist está realmente
          operando o veículo. <em>Veículos não cadastrados aparecem em amarelo;
            motoristas divergentes em vermelho.</em>
        </div>
      </div>

      {/* Upload */}
      <div className="bg-white border border-[#E2E8E4] rounded-md p-5 mb-6">
        <label className="flex flex-col sm:flex-row items-center gap-4 cursor-pointer">
          <div className="flex-1 border-2 border-dashed border-[#10B981]/30 hover:border-[#10B981] hover:bg-[#ECFDF5] rounded-md py-5 px-6 text-center transition-all">
            <Upload size={26} className="mx-auto text-[#10B981]" weight="duotone" />
            <div className="text-sm font-bold text-[#0F1411] mt-2">Selecionar arquivo GETRAK (.xlsx)</div>
            <div className="text-[11px] text-[#708278] mt-1">{fileName ? `Último: ${fileName}` : "Nenhum arquivo carregado"}</div>
          </div>
          <input type="file" accept=".xlsx,.xls" onChange={onFile} className="hidden" disabled={loading} data-testid="getrak-input" />
        </label>
        {loading && <div className="text-xs text-[#708278] mt-3 italic">Lendo planilha…</div>}
      </div>

      {/* Métricas + filtros */}
      {cruzamento.length > 0 && (
        <>
          <div className="grid sm:grid-cols-4 gap-3 mb-4">
            <StatCard label="Veículos no relatório" value={stats.total} color="#1E3A5F" icon={Truck} testId="m-getrak-total"
              active={filterTipo === "todos"} onClick={() => setFilterTipo("todos")} />
            <StatCard label="Identificados" value={stats.identificados} color="#10B981" icon={CheckCircle} testId="m-getrak-ok"
              active={filterTipo === "identificados"} onClick={() => setFilterTipo(filterTipo === "identificados" ? "todos" : "identificados")} />
            <StatCard label="Não cadastrados" value={stats.naoCadastrados} color="#D9A05B" icon={Warning} testId="m-getrak-naocad"
              active={filterTipo === "nao_cadastrados"} onClick={() => setFilterTipo(filterTipo === "nao_cadastrados" ? "todos" : "nao_cadastrados")} />
            <StatCard label="Motorista divergente" value={stats.divergentes} color="#DC2626" icon={XCircle} testId="m-getrak-diverg"
              active={filterTipo === "divergentes"} onClick={() => setFilterTipo(filterTipo === "divergentes" ? "todos" : "divergentes")} />
          </div>

          <div className="flex flex-wrap gap-2 mb-3 items-center">
            {filterTipo !== "todos" && (
              <div className="flex items-center gap-2 text-[11px] text-[#4A564F]" data-testid="getrak-filter-info">
                <Funnel size={14} className="text-[#708278]" />
                <span className="font-bold uppercase tracking-[0.15em] text-[#708278]">Filtro ativo:</span>
                <span className="bg-[#0F2542] text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-[0.1em]">
                  {filterTipo === "identificados" ? "Identificados" : filterTipo === "nao_cadastrados" ? "Não cadastrados" : "Divergentes"}
                </span>
                <button onClick={() => setFilterTipo("todos")} data-testid="getrak-filter-clear" className="text-[#1E3A5F] font-bold uppercase tracking-[0.15em] hover:underline">
                  Limpar
                </button>
              </div>
            )}
            <div className="ml-auto flex items-center gap-2 bg-white border border-[#E2E8E4] rounded-md px-3 py-1.5">
              <MagnifyingGlass size={14} className="text-[#708278]" />
              <input value={searchPlate} onChange={(e) => setSearchPlate(e.target.value)} data-testid="getrak-search"
                placeholder="Buscar (placa, tag, motorista, rua…)" className="text-sm outline-none w-56" />
            </div>
          </div>

          {/* Tabela */}
          <div className="bg-white border border-[#E2E8E4] rounded-md overflow-hidden">
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#F5F7FA] border-b border-[#E2E8E4]">
                  <tr>
                    <th className="text-left text-[10px] uppercase tracking-[0.15em] font-bold text-[#708278] px-4 py-3">Placa</th>
                    <th className="text-left text-[10px] uppercase tracking-[0.15em] font-bold text-[#708278] px-4 py-3">Veículo cadastrado</th>
                    <th className="text-left text-[10px] uppercase tracking-[0.15em] font-bold text-[#708278] px-4 py-3">Titular (sistema)</th>
                    <th className="text-left text-[10px] uppercase tracking-[0.15em] font-bold text-[#708278] px-4 py-3">Motorista (GETRAK)</th>
                    <th className="text-left text-[10px] uppercase tracking-[0.15em] font-bold text-[#708278] px-4 py-3 hidden md:table-cell">Último local</th>
                    <th className="text-right text-[10px] uppercase tracking-[0.15em] font-bold text-[#708278] px-4 py-3">Distância</th>
                    <th className="text-right text-[10px] uppercase tracking-[0.15em] font-bold text-[#708278] px-2 py-3 hidden lg:table-cell">Em movim.</th>
                    <th className="text-right text-[10px] uppercase tracking-[0.15em] font-bold text-[#708278] px-2 py-3 hidden lg:table-cell">Ocioso</th>
                    <th className="text-right text-[10px] uppercase tracking-[0.15em] font-bold text-[#708278] pl-2 pr-4 py-3 hidden lg:table-cell">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => {
                    const bg = c.naoCadastrado ? "bg-[#FFFBEB]" : c.divergente ? "bg-[#FEF2F2]" : "";
                    return (
                      <tr key={c.plate} onClick={() => setOpenVehicle(c)}
                        className={`border-b border-[#E2E8E4] last:border-0 ${bg} hover:bg-[#F5F7FA] cursor-pointer`}
                        data-testid={`row-${c.plate}`}>
                        <td className="px-4 py-3 font-bold text-[#0F2542]">
                          {c.plate}
                          {c.naoCadastrado && <div className="text-[10px] uppercase tracking-[0.15em] font-bold text-[#92400E] mt-0.5">Não cadastrado</div>}
                          {c.divergente && <div className="text-[10px] uppercase tracking-[0.15em] font-bold text-[#991B1B] mt-0.5">Divergente</div>}
                        </td>
                        <td className="px-4 py-3">
                          {c.vehicle ? (
                            <button onClick={(e) => { e.stopPropagation(); navigate(`/veiculos/${c.vehicle.id}`); }} className="text-left hover:underline">
                              <div className="font-bold text-[#0F2542]">{c.vehicle.tag || "—"}</div>
                              <div className="text-[11px] text-[#708278]">{c.vehicle.marca} {c.vehicle.modelo}</div>
                            </button>
                          ) : <span className="text-[11px] text-[#92400E] italic">Não cadastrado</span>}
                        </td>
                        <td className="px-4 py-3 text-[#4A564F]">
                          {c.titularesNomes.length > 0 ? c.titularesNomes.join(", ") : <span className="italic text-[#708278]">— Nenhum —</span>}
                        </td>
                        <td className={`px-4 py-3 text-[#4A564F] ${c.divergente ? "font-bold text-[#991B1B]" : ""}`}>
                          {c.driversReported.length > 0 ? c.driversReported.join(", ") : <span className="italic text-[#708278]">Sem motorista</span>}
                        </td>
                        <td className="px-4 py-3 text-[11px] text-[#4A564F] hidden md:table-cell max-w-md" title={c.ultimoLocal}>
                          <div className="flex items-center gap-1 text-[#10B981]"><MapPin size={11} /> {c.ultimoFim}</div>
                          <div className="truncate text-[#0F2542] mt-0.5">{c.ultimoLocal}</div>
                          {c.latLngFinal && (
                            <a href={`https://www.google.com/maps?q=${c.latLngFinal.lat},${c.latLngFinal.lng}`}
                              target="_blank" rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              data-testid={`maps-${c.plate}`}
                              className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.15em] font-bold text-[#2563EB] hover:underline mt-0.5">
                              <MapPin size={10} weight="bold" /> {c.latLngFinal.lat.toFixed(5)}, {c.latLngFinal.lng.toFixed(5)}
                            </a>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-[#0F2542]">
                          {c.totalKm.toFixed(1)} km
                          <div className="text-[10px] text-[#708278] font-normal">{c.linhas} eventos</div>
                        </td>
                        <td className="px-2 py-3 text-right hidden lg:table-cell text-[11px] text-[#4A564F] whitespace-nowrap">
                          <span className="inline-flex items-center gap-1"><Clock size={11} /> {fmtSeconds(c.totalMov)}</span>
                        </td>
                        <td className="px-2 py-3 text-right hidden lg:table-cell text-[11px] text-[#708278] whitespace-nowrap">
                          {fmtSeconds(c.totalOcioso)}
                        </td>
                        <td className="pl-2 pr-4 py-3 text-right hidden lg:table-cell text-[11px] font-bold text-[#0F2542] whitespace-nowrap">
                          {fmtSeconds(c.totalDuracao)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filtered.length === 0 && (
              <div className="p-10 text-center text-sm text-[#708278]">Nenhum resultado para este filtro.</div>
            )}
          </div>
        </>
      )}

      {cruzamento.length === 0 && !loading && (
        <div className="bg-white border border-dashed border-[#E2E8E4] rounded-md p-10 text-center">
          <Info size={32} className="mx-auto text-[#708278]" weight="duotone" />
          <div className="text-sm text-[#4A564F] mt-3">
            Faça upload do relatório GETRAK para visualizar a localização e atividade dos veículos.
          </div>
        </div>
      )}

      {/* Modal: tabela de eventos do veículo selecionado */}
      {openVehicle && (
        <EventsModal item={openVehicle} onClose={() => setOpenVehicle(null)} />
      )}
    </div>
  );
}

function StatCard({ label, value, color, icon: Icon, testId, active, onClick }) {
  const clickable = typeof onClick === "function";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      data-testid={testId}
      data-active={active ? "true" : "false"}
      className={`bg-white border rounded-md p-4 flex items-center gap-3 text-left w-full transition-all ${active ? "" : "border-[#E2E8E4] hover:border-[#1E3A5F]/30"
        } ${clickable ? "cursor-pointer" : "cursor-default"}`}
      style={active ? { borderColor: color, boxShadow: `0 0 0 1px ${color}` } : undefined}
    >
      <div className="w-11 h-11 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}15` }}>
        <Icon size={20} weight="duotone" style={{ color }} />
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-[0.15em] font-bold text-[#708278]">{label}</div>
        <div className="text-2xl font-black tracking-tight" style={{ color }}>{value}</div>
      </div>
    </button>
  );
}

/**
 * Modal de detalhamento — exibe a tabela completa de eventos/paradas do
 * veículo clicado, com link para Google Maps em cada linha (lat/lng final).
 *
 * Reaproveita `rawLines` (linhas cruas da planilha agrupadas por placa).
 */
function EventsModal({ item, onClose }) {
  const lines = item.rawLines || [];
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose} data-testid="getrak-modal">
      <div className="bg-white rounded-md w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="border-b border-[#E2E8E4] px-6 py-4 flex items-center justify-between gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-[#708278] font-bold">Eventos GETRAK</div>
            <h2 className="font-[Outfit,sans-serif] text-xl font-black tracking-tight text-[#0F1411] mt-0.5 flex items-center gap-2">
              <MapPin size={20} className="text-[#10B981]" weight="duotone" />
              {item.plate}
              {item.vehicle && <span className="text-sm font-bold text-[#4A564F]">· {item.vehicle.tag}</span>}
            </h2>
            <div className="text-[11px] text-[#708278] mt-0.5">
              {lines.length} eventos · {item.totalKm.toFixed(1)} km · Em movim.: {fmtSeconds(item.totalMov)} · Ocioso: {fmtSeconds(item.totalOcioso)} · <strong className="text-[#0F2542]">Total: {fmtSeconds(item.totalDuracao)}</strong> · Motorista GETRAK: {item.driversReported.join(", ") || "—"}
            </div>
          </div>
          <button onClick={onClose} className="text-[#708278] hover:text-[#0F1411] p-2 rounded-md hover:bg-[#F5F7FA]" data-testid="getrak-modal-close">
            <X size={20} />
          </button>
        </div>

        {/* Tabela de eventos */}
        <div className="overflow-auto flex-1">
          <table className="w-full text-xs">
            <thead className="bg-[#F5F7FA] border-b border-[#E2E8E4] sticky top-0">
              <tr>
                <th className="text-left text-[10px] uppercase tracking-[0.15em] font-bold text-[#708278] px-4 py-3">#</th>
                <th className="text-left text-[10px] uppercase tracking-[0.15em] font-bold text-[#708278] px-4 py-3">Início</th>
                <th className="text-left text-[10px] uppercase tracking-[0.15em] font-bold text-[#708278] px-4 py-3">Fim</th>
                <th className="text-left text-[10px] uppercase tracking-[0.15em] font-bold text-[#708278] px-4 py-3">Motorista</th>
                <th className="text-right text-[10px] uppercase tracking-[0.15em] font-bold text-[#708278] px-4 py-3">Distância</th>
                <th className="text-right text-[10px] uppercase tracking-[0.15em] font-bold text-[#708278] px-4 py-3">Em movim.</th>
                <th className="text-right text-[10px] uppercase tracking-[0.15em] font-bold text-[#708278] px-4 py-3">Ocioso</th>
                <th className="text-right text-[10px] uppercase tracking-[0.15em] font-bold text-[#708278] px-4 py-3">Duração</th>
                <th className="text-left text-[10px] uppercase tracking-[0.15em] font-bold text-[#708278] px-4 py-3">Local inicial</th>
                <th className="text-left text-[10px] uppercase tracking-[0.15em] font-bold text-[#708278] px-4 py-3">Local final</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((r, idx) => {
                const llIni = parseLatLng(r["Latitude e longitude inicial"]);
                const llFim = parseLatLng(r["Latitude e longitude final"]);
                return (
                  <tr key={idx} className="border-b border-[#E2E8E4] last:border-0 hover:bg-[#F5F7FA] align-top">
                    <td className="px-4 py-3 text-[#708278]">{idx + 1}</td>
                    <td className="px-4 py-3 text-[#0F2542] whitespace-nowrap">{r["Hora início"] || "—"}</td>
                    <td className="px-4 py-3 text-[#0F2542] whitespace-nowrap">{r["Hora final"] || "—"}</td>
                    <td className="px-4 py-3 text-[#4A564F]">{r["Motorista"] || "—"}</td>
                    <td className="px-4 py-3 text-right font-bold text-[#0F2542] whitespace-nowrap">
                      {(Number(String(r["Distância (km)"] || "0").replace(",", ".")) || 0).toFixed(1)} km
                    </td>
                    <td className="px-4 py-3 text-right text-[#4A564F] whitespace-nowrap">{r["Tempo em movimento"] || "—"}</td>
                    <td className="px-4 py-3 text-right text-[#708278] whitespace-nowrap">{r["Tempo ocioso"] || "—"}</td>
                    <td className="px-4 py-3 text-right font-bold text-[#0F2542] whitespace-nowrap">{r["Duração"] || "—"}</td>
                    <td className="px-4 py-3 text-[#4A564F] max-w-xs">
                      <div className="text-[11px]">{r["Local inicial"] || "—"}</div>
                      {llIni && (
                        <a href={`https://www.google.com/maps?q=${llIni.lat},${llIni.lng}`}
                          target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.15em] font-bold text-[#2563EB] hover:underline mt-1">
                          <MapPin size={10} weight="bold" /> Maps
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[#4A564F] max-w-xs">
                      <div className="text-[11px]">{r["Local final"] || "—"}</div>
                      {llFim && (
                        <a href={`https://www.google.com/maps?q=${llFim.lat},${llFim.lng}`}
                          target="_blank" rel="noreferrer"
                          data-testid={`modal-maps-${idx}`}
                          className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.15em] font-bold text-[#2563EB] hover:underline mt-1">
                          <MapPin size={10} weight="bold" /> Maps
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {lines.length === 0 && (
            <div className="p-10 text-center text-sm text-[#708278]">Sem eventos para este veículo.</div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[#E2E8E4] px-6 py-3 bg-[#F5F7FA] text-[11px] text-[#708278] flex items-center justify-between">
          <span>Clique em "Maps" em qualquer linha para abrir no Google Maps.</span>
          <button onClick={onClose} className="text-[#1E3A5F] font-bold uppercase tracking-[0.15em] text-[10px] hover:underline">Fechar</button>
        </div>
      </div>
    </div>
  );
}
