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
  CheckCircle, XCircle, Funnel,
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
    // Descarta linhas-resumo (totalização) e linhas em branco.
    .filter((r) => {
      const apl = String(r["Apelido/Placa"] || "").trim();
      const hora = String(r["Hora início"] || "").trim();
      if (!apl || !hora) return false;
      if (/tempo\s+total/i.test(apl)) return false;
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
    if (searchPlate.trim()) list = list.filter((c) => c.plate.includes(norm(searchPlate)));
    return list;
  }, [cruzamento, filterTipo, searchPlate]);

  const stats = useMemo(() => ({
    total: cruzamento.length,
    identificados: cruzamento.filter((c) => c.vehicle && !c.divergente).length,
    naoCadastrados: cruzamento.filter((c) => c.naoCadastrado).length,
    divergentes: cruzamento.filter((c) => c.divergente).length,
  }), [cruzamento]);

  return (
    <div className="px-4 sm:px-8 py-8 max-w-7xl mx-auto" data-testid="page-getrak">
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
            <StatCard label="Veículos no relatório" value={stats.total} color="#1E3A5F" icon={Truck} testId="m-getrak-total" />
            <StatCard label="Identificados" value={stats.identificados} color="#10B981" icon={CheckCircle} testId="m-getrak-ok" />
            <StatCard label="Não cadastrados" value={stats.naoCadastrados} color="#D9A05B" icon={Warning} testId="m-getrak-naocad" />
            <StatCard label="Motorista divergente" value={stats.divergentes} color="#DC2626" icon={XCircle} testId="m-getrak-diverg" />
          </div>

          <div className="flex flex-wrap gap-2 mb-3 items-center">
            <Funnel size={14} className="text-[#708278]" />
            {["todos", "identificados", "nao_cadastrados", "divergentes"].map((f) => (
              <button key={f} onClick={() => setFilterTipo(f)} data-testid={`filter-${f}`}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-[0.1em] ${filterTipo === f ? "bg-[#1E3A5F] text-white" : "bg-[#E2E8E4] text-[#4A564F]"}`}>
                {f === "todos" ? "Todos" : f === "identificados" ? "Identificados" : f === "nao_cadastrados" ? "Não cadastrados" : "Divergentes"}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-2 bg-white border border-[#E2E8E4] rounded-md px-3 py-1.5">
              <MagnifyingGlass size={14} className="text-[#708278]" />
              <input value={searchPlate} onChange={(e) => setSearchPlate(e.target.value)} data-testid="getrak-search"
                placeholder="Buscar placa…" className="text-sm outline-none w-40" />
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
                    <th className="text-right text-[10px] uppercase tracking-[0.15em] font-bold text-[#708278] px-4 py-3 hidden lg:table-cell">Em movim.</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => {
                    const bg = c.naoCadastrado ? "bg-[#FFFBEB]" : c.divergente ? "bg-[#FEF2F2]" : "";
                    return (
                      <tr key={c.plate} className={`border-b border-[#E2E8E4] last:border-0 ${bg} hover:bg-[#F5F7FA]`} data-testid={`row-${c.plate}`}>
                        <td className="px-4 py-3 font-bold text-[#0F2542]">
                          {c.plate}
                          {c.naoCadastrado && <div className="text-[10px] uppercase tracking-[0.15em] font-bold text-[#92400E] mt-0.5">Não cadastrado</div>}
                          {c.divergente && <div className="text-[10px] uppercase tracking-[0.15em] font-bold text-[#991B1B] mt-0.5">Divergente</div>}
                        </td>
                        <td className="px-4 py-3">
                          {c.vehicle ? (
                            <button onClick={() => navigate(`/veiculos/${c.vehicle.id}`)} className="text-left hover:underline">
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
                        <td className="px-4 py-3 text-right hidden lg:table-cell text-[11px] text-[#4A564F]">
                          <div className="flex items-center gap-1 justify-end"><Clock size={11} /> {fmtSeconds(c.totalMov)}</div>
                          <div className="text-[10px] text-[#708278]">Ocioso: {fmtSeconds(c.totalOcioso)}</div>
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
    </div>
  );
}

function StatCard({ label, value, color, icon: Icon, testId }) {
  return (
    <div className="bg-white border border-[#E2E8E4] rounded-md p-4 flex items-center gap-3" data-testid={testId}>
      <div className="w-11 h-11 rounded-md flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
        <Icon size={20} weight="duotone" style={{ color }} />
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-[0.15em] font-bold text-[#708278]">{label}</div>
        <div className="text-2xl font-black tracking-tight" style={{ color }}>{value}</div>
      </div>
    </div>
  );
}
