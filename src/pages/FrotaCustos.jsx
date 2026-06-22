import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { VEHICLE_STATUS, EQUIPAMENTO_TIPOS, SUB_TIPOS_LABEL } from "../lib/constants";
import { formatCurrency } from "../lib/vehicleTypes";
import {
  CurrencyCircleDollar, TrendUp, ChartPie, Truck, Warning, ChartBar,
} from "@phosphor-icons/react";

/**
 * Dashboard de Custo Total da Frota.
 *
 * Soma `valorAluguelMensal` de todos os veículos ATIVOS e quebra por:
 *   • Categoria de equipamento (Caminhão Basculante, Carro, etc.)
 *   • Origem (Próprio, Alugado, etc.)
 *   • Top N mais caros
 *
 * Próprios contam com `valorAluguelMensal` apenas se a Frota informou
 * (representa auto-aluguel interno). Vazios não somam.
 */
export default function FrotaCustos() {
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "vehicles"), where("status", "==", VEHICLE_STATUS.ACTIVE)), (snap) => {
      setVehicles(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const stats = useMemo(() => {
    const monthlyTotal = vehicles.reduce((sum, v) => sum + (Number(v.valorAluguelMensal) || 0), 0);
    const anualEstimado = monthlyTotal * 12;
    const semValor = vehicles.filter((v) => !v.valorAluguelMensal).length;
    return { monthlyTotal, anualEstimado, ativos: vehicles.length, semValor };
  }, [vehicles]);

  // Breakdown por categoria de equipamento.
  const porCategoria = useMemo(() => {
    const map = new Map();
    vehicles.forEach((v) => {
      const key = v.equipamento_tipo || "outro";
      const cat = EQUIPAMENTO_TIPOS.find((e) => e.id === key)?.label || key;
      const cur = map.get(cat) || { cat, total: 0, qtd: 0, subTipos: {} };
      cur.total += Number(v.valorAluguelMensal) || 0;
      cur.qtd += 1;
      if (v.subTipo) {
        cur.subTipos[v.subTipo] = (cur.subTipos[v.subTipo] || 0) + 1;
      }
      map.set(cat, cur);
    });
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [vehicles]);

  // Breakdown por origem.
  const porOrigem = useMemo(() => {
    const map = new Map();
    vehicles.forEach((v) => {
      const key = v.origem || "indefinida";
      const cur = map.get(key) || { origem: key, total: 0, qtd: 0 };
      cur.total += Number(v.valorAluguelMensal) || 0;
      cur.qtd += 1;
      map.set(key, cur);
    });
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [vehicles]);

  // Top 10 mais caros.
  const topMaisCaros = useMemo(() => {
    return [...vehicles].sort((a, b) => (Number(b.valorAluguelMensal) || 0) - (Number(a.valorAluguelMensal) || 0)).slice(0, 10);
  }, [vehicles]);

  // Percentual barra horizontal.
  const maxCat = porCategoria[0]?.total || 1;

  return (
    <div className="px-4 sm:px-8 py-8 max-w-7xl mx-auto" data-testid="page-frota-custos">
      <div className="mb-6">
        <div className="text-[10px] uppercase tracking-[0.25em] text-[#708278] font-bold">Frota · Custo Total</div>
        <h1 className="font-[Outfit,sans-serif] text-3xl font-black tracking-tight text-[#0F1411] mt-1 flex items-center gap-2">
          <CurrencyCircleDollar size={28} className="text-[#10B981]" weight="duotone" /> Custo Total da Frota
        </h1>
        <p className="text-sm text-[#4A564F] mt-1">Análise em tempo real do custo mensal e anual dos veículos ATIVOS.</p>
      </div>

      {/* Cards principais */}
      <div className="grid sm:grid-cols-4 gap-3 mb-6">
        <Stat label="Custo mensal" value={formatCurrency(stats.monthlyTotal)} color="#10B981" icon={CurrencyCircleDollar} testId="m-mensal" />
        <Stat label="Estimativa anual" value={formatCurrency(stats.anualEstimado)} color="#1E3A5F" icon={TrendUp} testId="m-anual" />
        <Stat label="Veículos ativos" value={stats.ativos} color="#2563EB" icon={Truck} testId="m-ativos" raw />
        <Stat label="Sem valor cadastrado" value={stats.semValor} color={stats.semValor > 0 ? "#D9A05B" : "#708278"} icon={Warning} testId="m-sem-valor" raw />
      </div>

      {stats.semValor > 0 && (
        <div className="bg-[#FEF3C7] border border-[#F59E0B]/40 rounded-md p-3 mb-6 text-xs text-[#92400E]">
          <strong>Atenção:</strong> {stats.semValor} veículo(s) ativo(s) sem <code>valorAluguelMensal</code> cadastrado.
          O custo total pode estar subestimado. Verifique em <button onClick={() => navigate("/veiculos")} className="underline font-bold">Veículos</button>.
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Breakdown por categoria */}
        <div className="bg-white border border-[#E2E8E4] rounded-md p-5">
          <div className="flex items-center gap-2 mb-4">
            <ChartPie size={20} className="text-[#2563EB]" weight="duotone" />
            <h2 className="font-bold text-[#0F1411]">Custo por Categoria</h2>
          </div>
          {porCategoria.length === 0 ? (
            <div className="text-sm text-[#708278] italic">Sem dados ainda.</div>
          ) : (
            <div className="space-y-3">
              {porCategoria.map((c) => (
                <div key={c.cat} data-testid={`cat-${c.cat}`}>
                  <div className="flex items-center justify-between gap-3 text-xs mb-1">
                    <span className="font-bold text-[#0F2542]">{c.cat}</span>
                    <span className="text-[#10B981] font-black">{formatCurrency(c.total)}</span>
                  </div>
                  <div className="h-2 bg-[#F5F7FA] rounded-full overflow-hidden">
                    <div className="h-full bg-[#2563EB] rounded-full" style={{ width: `${(c.total / maxCat) * 100}%` }} />
                  </div>
                  <div className="text-[10px] text-[#708278] mt-1 flex justify-between">
                    <span>{c.qtd} veículo(s)</span>
                    <span>
                      {Object.keys(c.subTipos).length > 0 && Object.entries(c.subTipos).map(([k, v]) => `${SUB_TIPOS_LABEL[k] || k}: ${v}`).join(" · ")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Breakdown por origem */}
        <div className="bg-white border border-[#E2E8E4] rounded-md p-5">
          <div className="flex items-center gap-2 mb-4">
            <ChartBar size={20} className="text-[#2563EB]" weight="duotone" />
            <h2 className="font-bold text-[#0F1411]">Custo por Origem</h2>
          </div>
          {porOrigem.length === 0 ? (
            <div className="text-sm text-[#708278] italic">Sem dados ainda.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-[#E2E8E4]">
                <tr>
                  <th className="text-left text-[10px] uppercase tracking-[0.15em] font-bold text-[#708278] py-2">Origem</th>
                  <th className="text-right text-[10px] uppercase tracking-[0.15em] font-bold text-[#708278] py-2">Veículos</th>
                  <th className="text-right text-[10px] uppercase tracking-[0.15em] font-bold text-[#708278] py-2">Custo mensal</th>
                </tr>
              </thead>
              <tbody>
                {porOrigem.map((o) => (
                  <tr key={o.origem} className="border-b border-[#E2E8E4] last:border-0">
                    <td className="py-2 capitalize text-[#0F2542] font-bold">{String(o.origem).replace(/_/g, " ")}</td>
                    <td className="py-2 text-right">{o.qtd}</td>
                    <td className="py-2 text-right font-black text-[#10B981]">{formatCurrency(o.total)}</td>
                  </tr>
                ))}
                <tr className="bg-[#F5F7FA]">
                  <td className="py-2 font-bold text-[#0F2542]">Total</td>
                  <td className="py-2 text-right font-bold">{stats.ativos}</td>
                  <td className="py-2 text-right font-black text-[#0F2542]">{formatCurrency(stats.monthlyTotal)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Top 10 mais caros */}
      <div className="bg-white border border-[#E2E8E4] rounded-md p-5 mt-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendUp size={20} className="text-[#DC2626]" weight="duotone" />
          <h2 className="font-bold text-[#0F1411]">Top 10 Veículos Mais Caros</h2>
        </div>
        {topMaisCaros.length === 0 ? (
          <div className="text-sm text-[#708278] italic">Sem dados.</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F5F7FA] border-b border-[#E2E8E4]">
                <tr>
                  <th className="text-left text-[10px] uppercase tracking-[0.15em] font-bold text-[#708278] px-3 py-2">#</th>
                  <th className="text-left text-[10px] uppercase tracking-[0.15em] font-bold text-[#708278] px-3 py-2">Veículo</th>
                  <th className="text-left text-[10px] uppercase tracking-[0.15em] font-bold text-[#708278] px-3 py-2 hidden md:table-cell">Categoria</th>
                  <th className="text-left text-[10px] uppercase tracking-[0.15em] font-bold text-[#708278] px-3 py-2 hidden md:table-cell">Origem</th>
                  <th className="text-right text-[10px] uppercase tracking-[0.15em] font-bold text-[#708278] px-3 py-2">Mensal</th>
                </tr>
              </thead>
              <tbody>
                {topMaisCaros.map((v, i) => (
                  <tr key={v.id} className="border-b border-[#E2E8E4] last:border-0 hover:bg-[#F5F7FA] cursor-pointer"
                    onClick={() => navigate(`/veiculos/${v.id}`)} data-testid={`top-${v.id}`}>
                    <td className="px-3 py-2 font-bold text-[#708278]">{i + 1}</td>
                    <td className="px-3 py-2">
                      <div className="font-bold text-[#0F2542]">{v.tag || v.placa || v.id.slice(0, 8)}</div>
                      <div className="text-[11px] text-[#708278]">{v.marca} {v.modelo}</div>
                    </td>
                    <td className="px-3 py-2 hidden md:table-cell text-[#4A564F]">
                      {EQUIPAMENTO_TIPOS.find((e) => e.id === v.equipamento_tipo)?.label || v.equipamento_tipo || "—"}
                      {v.subTipo && <span className="text-[10px] text-[#708278]"> · {SUB_TIPOS_LABEL[v.subTipo]}</span>}
                    </td>
                    <td className="px-3 py-2 hidden md:table-cell text-[#4A564F] capitalize">{String(v.origem || "—").replace(/_/g, " ")}</td>
                    <td className="px-3 py-2 text-right font-black text-[#10B981]">{formatCurrency(v.valorAluguelMensal || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, color, icon: Icon, testId, raw }) {
  return (
    <div className="bg-white border border-[#E2E8E4] rounded-md p-4 flex items-center gap-3" data-testid={testId}>
      <div className="w-11 h-11 rounded-md flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
        <Icon size={20} weight="duotone" style={{ color }} />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-[0.15em] font-bold text-[#708278]">{label}</div>
        <div className={`${raw ? "text-2xl" : "text-xl"} font-black tracking-tight truncate`} style={{ color }}>{value}</div>
      </div>
    </div>
  );
}
