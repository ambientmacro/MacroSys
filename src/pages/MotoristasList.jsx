import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, onSnapshot, orderBy, query, getDocs, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { DRIVER_STATUS, DRIVER_STATUS_LABEL, VEHICLE_STATUS } from "../lib/constants";
import { isPendingDriver } from "../lib/drivers";
import { canCreateRequerimento } from "../lib/roles";
import { User, PlusCircle, Truck, Info, Clock } from "@phosphor-icons/react";
import Pagination, { usePagination } from "../components/Pagination";

const STATUS_BADGE = {
  PENDING_APPROVAL: "bg-[#D9A05B]/20 text-[#8B5E2B] border-[#D9A05B]/50",
  NO_LOGIN_USER:    "bg-[#2E7D32]/15 text-[#1B5E20] border-[#2E7D32]/40",
  ACTIVE:           "bg-[#2563EB]/15 text-[#0A1A2E] border-[#2563EB]/40",
  INACTIVE:         "bg-[#C25D41]/15 text-[#8B3A26] border-[#C25D41]/40",
};

export default function MotoristasList() {
  const { profile } = useAuth();
  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "drivers"), orderBy("createdAt", "desc")), (snap) => {
      setDrivers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    (async () => {
      const v = await getDocs(query(collection(db, "vehicles"), where("status", "==", VEHICLE_STATUS.ACTIVE)));
      setVehicles(v.docs.map((x) => ({ id: x.id, ...x.data() })));
    })();
    return () => unsub();
  }, []);

  const canRequest = canCreateRequerimento(profile.role);

  // Separação visual: pendentes (PENDING_APPROVAL + legados sem approvedAt)
  // vs. aprovados (validados pelo DP). Vide lib/drivers.js para a regra.
  const pendentes = drivers.filter(isPendingDriver);
  const aprovados = drivers.filter((d) => !isPendingDriver(d));
  // Paginação: pendentes pequenos (10/pg), aprovados grandes (50/pg).
  const pagPendentes = usePagination(pendentes, { defaultPerPage: 10 });
  const pagAprovados = usePagination(aprovados, { defaultPerPage: 50 });

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-[#708278] font-bold">Operação</div>
          <h1 className="font-[Outfit,sans-serif] text-3xl font-black tracking-tight text-[#0F1411] mt-2">Motoristas</h1>
          <p className="text-sm text-[#4A564F] mt-2">Motoristas / funcionários ativos no sistema.</p>
        </div>
        {canRequest && (
          <Link to="/requerimentos/novo?tipo=motorista" data-testid="btn-req-motorista"
            className="flex items-center gap-2 bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] text-white px-5 py-3 rounded-md text-sm font-bold uppercase tracking-[0.1em] hover:from-[#1D4ED8] hover:to-[#1E40AF] transition-all shadow-md shadow-blue-900/20">
            <PlusCircle size={16} /> Novo Requerimento de Motorista
          </Link>
        )}
      </div>

      {canRequest && (
        <div className="mt-6 bg-[#EFF3F8] border border-[#2563EB]/20 rounded-md p-4 flex gap-3">
          <Info size={18} className="text-[#2563EB] mt-0.5 shrink-0" weight="duotone" />
          <div className="text-xs text-[#0F2542] leading-relaxed">
            <strong>Cadastro direto não está disponível.</strong> Para incluir um novo motorista (com ou sem login), abra um <strong>Requerimento</strong>. O fluxo passa pelo DP para análise e aprovação. Enquanto aguarda o DP, o motorista fica em <strong>Aguardando DP</strong> e <strong>não pode</strong> ser selecionado em checklists nem como titular de veículo.
          </div>
        </div>
      )}

      {/* Pendentes em destaque */}
      {pendentes.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={16} weight="duotone" className="text-[#8B5E2B]" />
            <h3 className="text-xs uppercase tracking-[0.2em] font-bold text-[#8B5E2B]">Aguardando aprovação do DP ({pendentes.length})</h3>
          </div>
          <div className="space-y-2">
            {pagPendentes.paged.map((d) => (
              <DriverRow key={d.id} d={d} vehicles={vehicles} dimmed />
            ))}
          </div>
          <Pagination {...pagPendentes} testid="motoristas-pendentes-pag" />
        </div>
      )}

      <div className="mt-8">
        {aprovados.length > 0 && (
          <h3 className="text-xs uppercase tracking-[0.2em] font-bold text-[#1B5E20] mb-3">Motoristas aprovados ({aprovados.length})</h3>
        )}
        <div className="space-y-2">
          {drivers.length === 0 && (
            <div className="border border-dashed border-[#E2E8E4] rounded-md p-10 text-center text-sm text-[#708278]">
              Nenhum motorista cadastrado ainda. Abra um requerimento para cadastrar.
            </div>
          )}
          {pagAprovados.paged.map((d) => (
            <DriverRow key={d.id} d={d} vehicles={vehicles} />
          ))}
        </div>
        <Pagination {...pagAprovados} testid="motoristas-aprovados-pag" />
      </div>
    </div>
  );
}

function DriverRow({ d, vehicles, dimmed = false }) {
  const veh = vehicles.find((v) => v.id === d.defaultVehicleId);
  const isPending = isPendingDriver(d);
  const badgeClass = isPending ? STATUS_BADGE.PENDING_APPROVAL : (STATUS_BADGE[d.status] || STATUS_BADGE.NO_LOGIN_USER);
  const badgeLabel = isPending ? DRIVER_STATUS_LABEL.PENDING_APPROVAL : (DRIVER_STATUS_LABEL[d.status] || "—");

  // Validade da CNH — gera alerta visual quando próxima do vencimento.
  // Aceita os campos novos (cnhValidade) e legados (validade_cnh).
  const cnhDateStr = d.cnhValidade || d.validade_cnh;
  const cnhDate = cnhDateStr ? new Date(cnhDateStr) : null;
  const daysCNH = cnhDate && !isNaN(cnhDate) ? Math.floor((cnhDate - new Date()) / 86400000) : null;
  const cnhAlert =
    daysCNH === null ? null :
    daysCNH < 0 ? { label: `CNH vencida há ${Math.abs(daysCNH)}d`, cls: "bg-[#C25D41]/15 text-[#8B3A26] border-[#C25D41]/40" } :
    daysCNH <= 30 ? { label: `CNH vence em ${daysCNH}d`, cls: "bg-[#D9A05B]/15 text-[#8B5E2B] border-[#D9A05B]/40" } :
    null;

  return (
    <div data-testid={`m-row-${d.id}`} className={`bg-white border border-[#E2E8E4] rounded-md p-5 flex items-center justify-between flex-wrap gap-3 ${dimmed ? "opacity-90" : ""}`}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-[#EFF3F8] rounded-md flex items-center justify-center"><User size={18} className="text-[#2563EB]" weight="duotone" /></div>
        <div>
          <div className="text-sm font-bold text-[#0F1411]">{d.name}</div>
          <div className="text-xs text-[#708278] mt-0.5">{d.funcao || "—"} · {d.phone || "—"}</div>
          {(d.cnh || d.cnhCategoria) && (
            <div className="text-xs text-[#0F2542] mt-1">
              CNH {d.cnh || "—"} {d.cnhCategoria || d.categoria ? `· cat. ${d.cnhCategoria || d.categoria}` : ""}
              {cnhDateStr && <span className="text-[#708278]"> · validade {new Date(cnhDateStr).toLocaleDateString("pt-BR")}</span>}
            </div>
          )}
          {veh && <div className="text-xs text-[#2563EB] mt-1 flex items-center gap-1"><Truck size={12} /> {veh.tag}</div>}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap justify-end">
        {cnhAlert && (
          <span className={`text-[10px] uppercase tracking-[0.1em] font-bold px-2 py-1 rounded border ${cnhAlert.cls}`}>
            {cnhAlert.label}
          </span>
        )}
        <span className={`text-[10px] uppercase tracking-[0.15em] font-bold px-2.5 py-1 rounded-md border ${badgeClass}`}>
          {badgeLabel}
        </span>
      </div>
    </div>
  );
}
