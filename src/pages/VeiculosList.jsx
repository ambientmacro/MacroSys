import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, onSnapshot, orderBy, query, where, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { ROLES, VEHICLE_STATUS_LABEL } from "../lib/constants";
import { Truck, CaretRight, User } from "@phosphor-icons/react";
import Pagination, { usePagination } from "../components/Pagination";

const STATUS_COLOR = {
  PRE_REGISTERED: "bg-[#D9A05B]/15 text-[#8B5E2B] border-[#D9A05B]/40",
  PENDING_ACTIVATION: "bg-[#8EA694]/20 text-[#3D4F44] border-[#8EA694]/50",
  ACTIVE: "bg-[#2E7D32]/15 text-[#1B5E20] border-[#2E7D32]/40",
  INACTIVE: "bg-[#C25D41]/15 text-[#8B3A26] border-[#C25D41]/40",
};

export default function VeiculosList() {
  const { profile } = useAuth();
  const [items, setItems] = useState([]);
  const [team, setTeam] = useState(null);

  useEffect(() => {
    if (profile.role !== ROLES.ENCARREGADO) { setTeam(null); return; }
    (async () => {
      const snap = await getDocs(query(collection(db, "teams"), where("leaderUserId", "==", profile.id)));
      if (snap.empty) setTeam({ memberUserIds: [], memberDriverIds: [], _empty: true });
      else { const d = snap.docs[0]; setTeam({ id: d.id, ...d.data() }); }
    })();
  }, [profile]);

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "vehicles"), orderBy("createdAt", "desc")), (snap) => {
      let list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (profile.role === ROLES.ENCARREGADO && team) {
        const driverMembers = new Set([...(team.memberDriverIds || []), ...(team.memberUserIds || [])]);
        list = list.filter((v) => v.motoristaTitularId && driverMembers.has(v.motoristaTitularId));
      }
      setItems(list);
    });
    return () => unsub();
  }, [profile, team]);

  const showTeamBanner = profile.role === ROLES.ENCARREGADO && team;
  // Lista grande → 50/pág default. Configurável (10/20/50/100/TODOS).
  const { paged, ...pag } = usePagination(items, { defaultPerPage: 50 });

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto">
      <div className="text-xs uppercase tracking-[0.25em] text-[#708278] font-bold">Frota</div>
      <h1 className="font-[Outfit,sans-serif] text-3xl font-black tracking-tight text-[#0F1411] mt-2">Veículos</h1>
      <p className="text-sm text-[#4A564F] mt-2">Veículos criados via Requerimento. Só ficam ativos após Vistoria de Entrada.</p>

      {showTeamBanner && (
        <div className="mt-4 bg-[#EFF3F8] border border-[#2563EB]/30 rounded-md px-4 py-3 text-xs text-[#0F2542] flex items-center gap-2" data-testid="encarregado-veic-banner">
          <User size={16} weight="duotone" className="text-[#2563EB]" />
          {team._empty
            ? <span>Você ainda não foi atribuído a uma equipe pelo DP.</span>
            : <span>Filtrando pela sua equipe: <b>{team.name}</b> (veículos com motorista titular da equipe).</span>}
        </div>
      )}

      <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.length === 0 && (
          <div className="col-span-full border border-dashed border-[#E2E8E4] rounded-md p-10 text-center">
            <Truck size={32} className="mx-auto text-[#708278]" weight="duotone" />
            <div className="text-sm text-[#4A564F] mt-2">Nenhum veículo cadastrado.</div>
          </div>
        )}
        {paged.map((v) => {
          // Alerta visual de CRLV vencido / próximo do vencimento (Frota).
          const crlvDate = v.vencimentoCRLV ? new Date(v.vencimentoCRLV) : null;
          const daysToCRLV = crlvDate ? Math.floor((crlvDate - new Date()) / 86400000) : null;
          const crlvLabel = daysToCRLV === null ? null
            : daysToCRLV < 0 ? `CRLV vencido há ${Math.abs(daysToCRLV)}d`
            : daysToCRLV <= 30 ? `CRLV vence em ${daysToCRLV}d` : null;
          const crlvClass = daysToCRLV < 0
            ? "bg-[#C25D41]/15 text-[#8B3A26] border-[#C25D41]/40"
            : "bg-[#D9A05B]/15 text-[#8B5E2B] border-[#D9A05B]/40";
          return (
          <Link to={`/veiculos/${v.id}`} key={v.id} data-testid={`veic-${v.id}`} className="group bg-white border border-[#E2E8E4] rounded-md p-5 hover:border-[#2563EB]/60 hover:shadow-md transition-all block">
            <div className="flex items-start justify-between">
              <Truck size={22} className="text-[#1E3A5F]" weight="duotone" />
              <span className={`text-[10px] uppercase tracking-[0.15em] font-bold px-2 py-1 rounded-md border ${STATUS_COLOR[v.status] || ""}`}>
                {VEHICLE_STATUS_LABEL[v.status] || v.status}
              </span>
            </div>
            <div className="mt-3 text-xs uppercase tracking-[0.15em] text-[#708278] font-bold">TAG · Placa</div>
            <div className="font-[Outfit,sans-serif] text-xl font-black tracking-tight text-[#0F1411] flex items-center gap-2 flex-wrap">
              <span>{v.tag}</span>
              {v.placa && <span className="text-sm font-bold bg-[#1E3A5F] text-white px-2 py-0.5 rounded">{v.placa}</span>}
            </div>
            <div className="text-sm text-[#4A564F] mt-1">{v.marca} {v.modelo} · {v.ano}</div>
            {v.valorAluguelMensal > 0 && (
              <div className="text-xs text-[#1B5E20] mt-2 font-bold">
                R$ {Number(v.valorAluguelMensal).toLocaleString("pt-BR")}/mês · {v.origem === "alugado" ? "Alugado" : v.origem === "prestacao" ? "Prestação" : "Próprio"}
              </div>
            )}
            {crlvLabel && (
              <div className={`mt-2 inline-block text-[10px] uppercase tracking-[0.1em] font-bold px-2 py-1 rounded border ${crlvClass}`}>
                {crlvLabel}
              </div>
            )}
            <div className="text-xs text-[#708278] mt-2 flex items-center justify-between">
              <span>{v.centro_custo || ""} {v.unidade ? `· ${v.unidade}` : ""}</span>
              <CaretRight size={14} className="text-[#708278] group-hover:text-[#2563EB] group-hover:translate-x-0.5 transition-all" />
            </div>
          </Link>
          );
        })}
      </div>
      <Pagination {...pag} testid="veiculos-pagination" />
    </div>
  );
}
