import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, query, where, onSnapshot, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { VEHICLE_STATUS, ROLES } from "../lib/constants";
import { CheckCircle, XCircle, Truck, Clock, Warning, ChartBar } from "@phosphor-icons/react";

/**
 * Painel de Checklists do Dia.
 *
 * - Frota / Admin: vê todos os veículos ativos.
 * - Encarregado: vê apenas os veículos da(s) sua(s) equipe(s).
 *
 * Métricas exibidas:
 *   • Total de veículos ativos
 *   • Checklists feitos hoje (✅)
 *   • Pendentes (sem checklist hoje) (⚠️)
 *   • Não-conformes hoje (❌)
 */
export default function ChecklistsPainel() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState([]);
  const [todayChecklists, setTodayChecklists] = useState([]);
  const [myTeams, setMyTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  const isEncarregado = profile.role === ROLES.ENCARREGADO;

  useEffect(() => {
    let unsubV = null, unsubC = null;
    (async () => {
      // Equipes do encarregado, se aplicável.
      if (isEncarregado) {
        const t = await getDocs(query(collection(db, "teams"), where("encarregadoId", "==", profile.id)));
        setMyTeams(t.docs.map((d) => ({ id: d.id, ...d.data() })));
      }

      // Veículos ativos.
      unsubV = onSnapshot(query(collection(db, "vehicles"), where("status", "==", VEHICLE_STATUS.ACTIVE)), (snap) => {
        setVehicles(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      });

      // Checklists do dia.
      const start = new Date(); start.setHours(0, 0, 0, 0);
      unsubC = onSnapshot(
        query(collection(db, "checklists"), where("date", ">=", start.toISOString().slice(0, 10))),
        (snap) => {
          setTodayChecklists(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
          setLoading(false);
        },
      );
    })();
    return () => { unsubV?.(); unsubC?.(); };
  }, [profile.id, isEncarregado]);

  // Para encarregado: filtra veículos pela equipe.
  const visibleVehicles = useMemo(() => {
    if (!isEncarregado) return vehicles;
    const driversIds = new Set();
    myTeams.forEach((t) => (t.driversIds || []).forEach((id) => driversIds.add(id)));
    return vehicles.filter((v) => {
      const tit = Array.isArray(v.motoristasTitularesIds) ? v.motoristasTitularesIds : (v.motoristaTitularId ? [v.motoristaTitularId] : []);
      return tit.some((id) => driversIds.has(id));
    });
  }, [vehicles, myTeams, isEncarregado]);

  // Cruzamento veículo × checklist hoje.
  const rows = useMemo(() => {
    return visibleVehicles.map((v) => {
      const cs = todayChecklists.filter((c) => c.vehicleId === v.id);
      const lastChecklist = cs.length > 0 ? cs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))[0] : null;
      const status = !lastChecklist ? "pendente" : (lastChecklist.hasNonConformity ? "nao_conforme" : "ok");
      return { vehicle: v, checklist: lastChecklist, status };
    });
  }, [visibleVehicles, todayChecklists]);

  const metrics = useMemo(() => ({
    total: rows.length,
    ok: rows.filter((r) => r.status === "ok").length,
    pendentes: rows.filter((r) => r.status === "pendente").length,
    naoConformes: rows.filter((r) => r.status === "nao_conforme").length,
  }), [rows]);

  return (
    <div className="px-4 sm:px-8 py-8 max-w-7xl mx-auto" data-testid="page-checklists-painel">
      <div className="mb-6">
        <div className="text-[10px] uppercase tracking-[0.25em] text-[#708278] font-bold">{isEncarregado ? "Encarregado · Equipe" : "Frota"}</div>
        <h1 className="font-[Outfit,sans-serif] text-3xl font-black tracking-tight text-[#0F1411] mt-1 flex items-center gap-2">
          <ChartBar size={28} className="text-[#1E3A5F]" weight="duotone" /> Painel de Checklists do Dia
        </h1>
        <p className="text-sm text-[#4A564F] mt-1">Status diário {new Date().toLocaleDateString("pt-BR")} — atualiza em tempo real.</p>
      </div>

      <div className="grid sm:grid-cols-4 gap-3 mb-6">
        <Card label="Veículos ativos" value={metrics.total} color="#1E3A5F" icon={Truck} testId="m-total" />
        <Card label="Checklist OK" value={metrics.ok} color="#10B981" icon={CheckCircle} testId="m-ok" />
        <Card label="Pendentes hoje" value={metrics.pendentes} color="#D9A05B" icon={Clock} testId="m-pendentes" />
        <Card label="Não conformes" value={metrics.naoConformes} color="#DC2626" icon={Warning} testId="m-naoconformes" />
      </div>

      {loading ? (
        <div className="bg-white border border-[#E2E8E4] rounded-md p-10 text-center text-sm text-[#708278]">Carregando…</div>
      ) : rows.length === 0 ? (
        <div className="bg-white border border-dashed border-[#E2E8E4] rounded-md p-10 text-center">
          <Truck size={40} className="mx-auto text-[#708278]" weight="duotone" />
          <div className="text-sm text-[#4A564F] mt-3">
            {isEncarregado ? "Nenhum veículo na sua equipe." : "Nenhum veículo ativo no momento."}
          </div>
        </div>
      ) : (
        <div className="bg-white border border-[#E2E8E4] rounded-md overflow-hidden">
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F5F7FA] border-b border-[#E2E8E4]">
                <tr>
                  <th className="text-left text-[10px] uppercase tracking-[0.15em] font-bold text-[#708278] px-4 py-3">Status</th>
                  <th className="text-left text-[10px] uppercase tracking-[0.15em] font-bold text-[#708278] px-4 py-3">Veículo</th>
                  <th className="text-left text-[10px] uppercase tracking-[0.15em] font-bold text-[#708278] px-4 py-3 hidden sm:table-cell">Motorista</th>
                  <th className="text-left text-[10px] uppercase tracking-[0.15em] font-bold text-[#708278] px-4 py-3 hidden md:table-cell">Hora</th>
                  <th className="text-right text-[10px] uppercase tracking-[0.15em] font-bold text-[#708278] px-4 py-3">—</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ vehicle: v, checklist: c, status }) => (
                  <tr key={v.id} className="border-b border-[#E2E8E4] last:border-0 hover:bg-[#F5F7FA]" data-testid={`row-${v.id}`}>
                    <td className="px-4 py-3">
                      {status === "ok" && <span className="inline-flex items-center gap-1 text-[#10B981] text-xs font-bold uppercase tracking-[0.15em]"><CheckCircle size={14} weight="fill" /> OK</span>}
                      {status === "pendente" && <span className="inline-flex items-center gap-1 text-[#D9A05B] text-xs font-bold uppercase tracking-[0.15em]"><Clock size={14} weight="fill" /> Pendente</span>}
                      {status === "nao_conforme" && <span className="inline-flex items-center gap-1 text-[#DC2626] text-xs font-bold uppercase tracking-[0.15em]"><XCircle size={14} weight="fill" /> Não conforme</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-[#0F2542]">{v.tag || v.placa || v.id.slice(0, 8)}</div>
                      <div className="text-[11px] text-[#708278]">{v.marca} {v.modelo}</div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-[#4A564F]">
                      {c?.driverName || v.motoristaTitularNome || "—"}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-[11px] text-[#708278]">
                      {c?.createdAt ? new Date(c.createdAt.seconds * 1000).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {c ? (
                        <button onClick={() => navigate(`/checklists/${c.id}`)} data-testid={`abrir-${v.id}`}
                          className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#1E3A5F] hover:underline">
                          Ver checklist
                        </button>
                      ) : (
                        <button onClick={() => navigate(`/veiculos/${v.id}`)}
                          className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#708278] hover:underline">
                          Ver veículo
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ label, value, color, icon: Icon, testId }) {
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
