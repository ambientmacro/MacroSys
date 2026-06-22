// =============================================================================
// pages/FrotaRelatorios.jsx — KPIs e relatórios para Admin de Frota
// -----------------------------------------------------------------------------
// Visão gerencial agregada da frota, dividida em duas categorias:
//   • Próprios   → patrimônio + auto-aluguel interno + depreciação
//   • Alugados   → custo mensal contratado
//
// KPIs principais:
//   - Patrimônio total (soma valorPatrimonio dos próprios)
//   - Custo mensal de aluguel (soma valorAluguelMensal de todos)
//   - Idade média da frota (com base em ano ou dataAquisicao)
//   - CRLV vencido / vencendo nos próximos 30 dias
//   - Distribuição por equipe responsável
//
// Esta é a versão "simples" (sem gráficos) — gráficos podem ser adicionados
// numa iteração futura usando Recharts.
// =============================================================================

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import {
  ChartBar, Truck, Coins, CalendarBlank, ShieldWarning, MapPin, ArrowRight,
} from "@phosphor-icons/react";

const BRL = (n) => `R$ ${Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Idade do veículo em anos, calculada por ano (fallback) ou dataAquisicao. */
function vehicleAgeYears(v) {
  const now = new Date();

  if (!v.ano) return null;

  const ano = parseInt(String(v.ano).trim());

  if (isNaN(ano)) return null;

  const idade = now.getFullYear() - ano;

  if (idade < 0 || idade > 100) return null;

  return idade;
}

/** Status do CRLV (datestring ISO YYYY-MM-DD) em relação a hoje. */
function crlvStatus(dateStr) {
  if (!dateStr) return { label: "Sem CRLV", color: "text-[#708278]" };
  const date = new Date(dateStr);
  if (isNaN(date)) return { label: "Inválida", color: "text-[#708278]" };
  const days = Math.floor((date - new Date()) / (1000 * 60 * 60 * 24));
  if (days < 0) return { label: `Vencido há ${Math.abs(days)} dias`, color: "text-[#8B3A26]", urgent: true };
  if (days <= 30) return { label: `Vence em ${days} dias`, color: "text-[#8B5E2B]", warning: true };
  return { label: `Válido até ${date.toLocaleDateString("pt-BR")}`, color: "text-[#1B5E20]" };
}

export default function FrotaRelatorios() {
  const { profile } = useAuth();
  const [vehicles, setVehicles] = useState([]);
  const [teams, setTeams] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [v, t, d] = await Promise.all([
        getDocs(collection(db, "vehicles")),
        getDocs(collection(db, "teams")),
        getDocs(collection(db, "drivers")),
      ]);
      setVehicles(v.docs.map((d) => ({ id: d.id, ...d.data() })));
      setTeams(t.docs.map((d) => ({ id: d.id, ...d.data() })));
      setDrivers(d.docs.map((x) => ({ id: x.id, ...x.data() })));
      setLoading(false);
    })();
  }, []);

  // Agregações
  const proprios = useMemo(() => vehicles.filter((v) => (v.origem || "proprio") === "proprio"), [vehicles]);
  const alugados = useMemo(() => vehicles.filter((v) => v.origem === "alugado"), [vehicles]);
  const prestacao = useMemo(() => vehicles.filter((v) => v.origem === "prestacao"), [vehicles]);

  const patrimonio = useMemo(() => proprios.reduce((s, v) => s + (Number(v.valorPatrimonio) || 0), 0), [proprios]);
  const custoAluguelMes = useMemo(() => vehicles.reduce((s, v) => s + (Number(v.valorAluguelMensal) || 0), 0), [vehicles]);
  const custoAluguelTerceiros = useMemo(() => [...alugados, ...prestacao].reduce((s, v) => s + (Number(v.valorAluguelMensal) || 0), 0), [alugados, prestacao]);
  const custoAutoAluguel = useMemo(() => proprios.reduce((s, v) => s + (Number(v.valorAluguelMensal) || 0), 0), [proprios]);

  const idades = useMemo(() => {
    return vehicles
      .map(vehicleAgeYears)
      .filter((a) => typeof a === "number" && !isNaN(a) && a > 0);
  }, [vehicles]);

  const idadeMedia = useMemo(() => {
    if (!idades.length) return null;
    const soma = idades.reduce((a, b) => a + b, 0);
    return soma / idades.length;
  }, [idades]);

  const crlvAlertas = useMemo(() => {
    return vehicles
      .map((v) => ({ ...v, _crlv: crlvStatus(v.vencimentoCRLV) }))
      .filter((v) => v._crlv.urgent || v._crlv.warning);
  }, [vehicles]);

  // Alertas de CNH — mesma lógica do CRLV. Aceita campos novos e legados.
  const cnhAlertas = useMemo(() => {
    return drivers
      .map((d) => ({ ...d, _cnh: crlvStatus(d.cnhValidade || d.validade_cnh) }))
      .filter((d) => d._cnh.urgent || d._cnh.warning);
  }, [drivers]);

  const byTeam = useMemo(() => {
    const map = new Map();
    vehicles.forEach((v) => {
      const tid = v.teamId || "_sem_equipe";
      if (!map.has(tid)) map.set(tid, []);
      map.get(tid).push(v);
    });
    return map;
  }, [vehicles]);

  if (loading) return <div className="p-10 text-sm text-[#4A564F]">Carregando…</div>;

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto">
      <div className="text-xs uppercase tracking-[0.25em] text-[#708278] font-bold">Gestão de Frota</div>
      <h1 className="font-[Outfit,sans-serif] text-3xl font-black tracking-tight text-[#0F1411] mt-2 flex items-center gap-3">
        <ChartBar size={28} weight="duotone" className="text-[#2563EB]" /> Relatórios da Frota
      </h1>
      <p className="text-sm text-[#4A564F] mt-2">Visão consolidada de custo, idade da frota, vencimentos e alocação por equipe.</p>

      {/* ---- KPIs principais ---- */}
      <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI
          icon={<Truck size={20} weight="duotone" />}
          title="Total de veículos"
          value={vehicles.length}
          sub={`${proprios.length} próprios · ${alugados.length} alugados · ${prestacao.length} prestação`}
          color="from-[#0F2542] to-[#1E3A5F]"
          testid="kpi-total"
        />
        <KPI
          icon={<Coins size={20} weight="duotone" />}
          title="Patrimônio (próprios)"
          value={BRL(patrimonio)}
          sub="Soma do valor de patrimônio dos próprios"
          color="from-[#1B5E20] to-[#2E7D32]"
          testid="kpi-patrimonio"
        />
        <KPI
          icon={<Coins size={20} weight="duotone" />}
          title="Custo mensal de aluguel"
          value={BRL(custoAluguelMes)}
          sub={`Terceiros: ${BRL(custoAluguelTerceiros)} · Auto-aluguel: ${BRL(custoAutoAluguel)}`}
          color="from-[#8B5E2B] to-[#D9A05B]"
          testid="kpi-custo-mes"
        />
        {/* NÃO ESTÁ VINDO A IDADE MÉDIA */}
        <KPI
          icon={<CalendarBlank size={20} weight="duotone" />}
          title="Idade média da frota"
          value={idadeMedia !== null ? `${idadeMedia.toFixed(1)} anos` : "—"}
          sub="Baseado em ano de fabricação ou data de aquisição"
          color="from-[#4A7A8C] to-[#2E4F5C]"
          testid="kpi-idade"
        />
      </div>

      {/* ---- CRLV alertas ---- */}
      <section className="mt-10">
        <div className="flex items-center gap-2 mb-3">
          <ShieldWarning size={20} weight="duotone" className="text-[#8B3A26]" />
          <h2 className="text-xs uppercase tracking-[0.2em] font-bold text-[#8B3A26]">
            CRLV — Vencimentos críticos ({crlvAlertas.length})
          </h2>
        </div>
        {crlvAlertas.length === 0 ? (
          <div className="border border-dashed border-[#E2E8E4] rounded-md p-6 text-center text-sm text-[#708278]">
            Nenhum CRLV vencido ou próximo do vencimento. ✓
          </div>
        ) : (
          <div className="space-y-2">
            {crlvAlertas.map((v) => (
              <Link to={`/veiculos/${v.id}`} key={v.id} data-testid={`crlv-${v.id}`}
                className={`bg-white border rounded-md p-4 flex items-center justify-between hover:shadow-md transition-all ${v._crlv.urgent ? "border-[#C25D41]/60" : "border-[#D9A05B]/60"}`}>
                <div className="flex items-center gap-3">
                  <Truck size={20} weight="duotone" className={v._crlv.urgent ? "text-[#8B3A26]" : "text-[#8B5E2B]"} />
                  <div>
                    <div className="text-sm font-bold text-[#0F1411]">{v.tag} {v.placa && <span className="font-mono text-xs ml-1">({v.placa})</span>}</div>
                    <div className="text-xs text-[#708278]">{v.marca} {v.modelo}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-bold ${v._crlv.color}`}>{v._crlv.label}</span>
                  <ArrowRight size={14} className="text-[#708278]" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ---- CNH motoristas ---- */}
      <section className="mt-10">
        <div className="flex items-center gap-2 mb-3">
          <ShieldWarning size={20} weight="duotone" className="text-[#8B3A26]" />
          <h2 className="text-xs uppercase tracking-[0.2em] font-bold text-[#8B3A26]">
            CNH — Vencimentos críticos ({cnhAlertas.length})
          </h2>
        </div>
        {cnhAlertas.length === 0 ? (
          <div className="border border-dashed border-[#E2E8E4] rounded-md p-6 text-center text-sm text-[#708278]">
            Nenhuma CNH vencida ou próxima do vencimento. ✓
          </div>
        ) : (
          <div className="space-y-2">
            {cnhAlertas.map((d) => (
              <div key={d.id} data-testid={`cnh-${d.id}`}
                className={`bg-white border rounded-md p-4 flex items-center justify-between ${d._cnh.urgent ? "border-[#C25D41]/60" : "border-[#D9A05B]/60"}`}>
                <div className="flex items-center gap-3">
                  <Truck size={20} weight="duotone" className={d._cnh.urgent ? "text-[#8B3A26]" : "text-[#8B5E2B]"} />
                  <div>
                    <div className="text-sm font-bold text-[#0F1411]">{d.name}</div>
                    <div className="text-xs text-[#708278]">CNH {d.cnh || "—"} · {d.cnhCategoria || d.categoria || "—"}</div>
                  </div>
                </div>
                <span className={`text-xs font-bold ${d._cnh.color}`}>{d._cnh.label}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ---- Alocação por equipe ---- */}
      <section className="mt-10">
        <div className="flex items-center gap-2 mb-3">
          <MapPin size={20} weight="duotone" className="text-[#2563EB]" />
          <h2 className="text-xs uppercase tracking-[0.2em] font-bold text-[#0F2542]">
            Alocação por equipe
          </h2>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          {[...byTeam.entries()].map(([tid, list]) => {
            const team = teams.find((x) => x.id === tid);
            const teamName = team?.name || (tid === "_sem_equipe" ? "Sem equipe atribuída" : "Equipe removida");
            const custoTime = list.reduce((s, v) => s + (Number(v.valorAluguelMensal) || 0), 0);
            return (
              <div key={tid} className="bg-white border border-[#E2E8E4] rounded-md p-4">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-sm text-[#0F1411]">{teamName}</div>
                  <span className="text-[10px] uppercase tracking-[0.15em] font-bold text-[#708278]">{list.length} veíc.</span>
                </div>
                <div className="mt-1 text-xs text-[#708278]">Custo mensal: <b className="text-[#0F2542]">{BRL(custoTime)}</b></div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {list.slice(0, 6).map((v) => (
                    <Link key={v.id} to={`/veiculos/${v.id}`}
                      className="text-[10px] uppercase tracking-[0.1em] font-bold px-2 py-1 rounded bg-[#EFF3F8] text-[#0F2542] hover:bg-[#2563EB] hover:text-white transition-colors">
                      {v.tag}
                    </Link>
                  ))}
                  {list.length > 6 && (
                    <span className="text-[10px] uppercase tracking-[0.1em] font-bold px-2 py-1 text-[#708278]">
                      +{list.length - 6}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

// =============================================================================
// Componente auxiliar — Card de KPI
// =============================================================================
function KPI({ icon, title, value, sub, color, testid }) {
  return (
    <div data-testid={testid} className={`bg-gradient-to-br ${color} text-white rounded-md p-5`}>
      <div className="flex items-center gap-2 opacity-80">
        {icon}
        <div className="text-[10px] uppercase tracking-[0.2em] font-bold">{title}</div>
      </div>
      <div className="mt-3 font-[Outfit,sans-serif] text-2xl font-black tracking-tight leading-none">{value}</div>
      <div className="mt-2 text-[11px] opacity-75 leading-snug">{sub}</div>
    </div>
  );
}
