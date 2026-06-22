import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, onSnapshot, orderBy, query, where, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { ROLES } from "../lib/constants";
import { ClipboardText, CaretRight, Truck, User } from "@phosphor-icons/react";
import Pagination, { usePagination } from "../components/Pagination";

export default function ChecklistList() {
  const { profile } = useAuth();
  const [items, setItems] = useState([]);
  const [team, setTeam] = useState(null);

  useEffect(() => {
    // Encarregado → carregar a equipe que ele lidera para filtrar.
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

  useEffect(() => {
    let q;
    if (profile.role === ROLES.MOTORISTA) {
      q = query(collection(db, "checklists"), where("filledByUserId", "==", profile.id));
    } else {
      q = query(collection(db, "checklists"), orderBy("updatedAt", "desc"));
    }
    const unsub = onSnapshot(q, (snap) => {
      let list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // Encarregado sees only his team's checklists
      if (profile.role === ROLES.ENCARREGADO && team) {
        const members = new Set([...(team.memberUserIds || []), profile.id]);
        const driverMembers = new Set(team.memberDriverIds || []);
        list = list.filter((c) =>
          members.has(c.filledByUserId) ||
          members.has(c.driverId) ||
          driverMembers.has(c.driverId)
        );
      }
      list.sort((a, b) => (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0));
      setItems(list);
    });
    return () => unsub();
  }, [profile, team]);

  const showTeamBanner = profile.role === ROLES.ENCARREGADO && team;
  const isMotorista = profile.role === ROLES.MOTORISTA;
  // Lista grande → 50/pág default.
  const { paged, ...pag } = usePagination(items, { defaultPerPage: 10 });

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
          ? "Histórico dos checklists que você enviou. Toque em um registro para visualizar ou imprimir."
          : "Histórico de checklists registrados."}
      </p>

      {showTeamBanner && (
        <div className="mt-4 bg-[#EFF3F8] border border-[#2563EB]/30 rounded-md px-4 py-3 text-xs text-[#0F2542] flex items-center gap-2" data-testid="encarregado-team-banner">
          <User size={16} weight="duotone" className="text-[#2563EB]" />
          {team._empty
            ? <span>Você ainda não foi atribuído a uma equipe pelo DP — está vendo apenas seus próprios registros.</span>
            : <span>Filtrando pela sua equipe: <b>{team.name}</b> · {(team.memberUserIds?.length || 0) + (team.memberDriverIds?.length || 0)} membros</span>}
        </div>
      )}

      <div className="mt-8 space-y-2">
        {items.length === 0 && (
          <div className="border border-dashed border-[#E2E8E4] rounded-md p-10 text-center">
            <ClipboardText size={32} className="mx-auto text-[#708278]" weight="duotone" />
            <div className="text-sm text-[#4A564F] mt-2">Nenhum checklist registrado.</div>
          </div>
        )}
        {paged.map((c) => {
          // A 1ª execução do veículo é marcada como Vistoria de Entrada
          // (campo `isFirstExecution`, persistido em /checklists). Legados
          // pré-unificação podem ter `type === "vistoria"`.
          const isVistoria = c.isFirstExecution || c.type === "vistoria" || c.type === "vistoria_entrada";
          const src = c.source || (c.type === "manual" ? "manual" : "digital");
          const sourceLabel = isVistoria
            ? "Vistoria de Entrada"
            : src === "manual" ? "Diário · papel" : "Diário · app";
          return (
          <Link to={`/checklists/${c.id}`} key={c.id} className="group bg-white border border-[#E2E8E4] rounded-md p-5 flex items-center justify-between hover:border-[#2563EB]/60 hover:shadow-md transition-all" data-testid={`cl-row-${c.id}`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-md flex items-center justify-center ${isVistoria ? "bg-[#4A7A8C]/15" : "bg-[#1E3A5F]/15"}`}>
                <ClipboardText size={18} weight="duotone" className={isVistoria ? "text-[#2E4F5C]" : "text-[#1E3A5F]"} />
              </div>
              <div>
                <div className="text-sm font-bold text-[#0F1411]">{c.templateName || "Checklist"}</div>
                <div className="text-xs text-[#708278] mt-0.5 flex items-center gap-2 flex-wrap">
                  <span className="flex items-center gap-1"><Truck size={12} /> {c.vehicleTag || "—"}</span>
                  <span>·</span>
                  <span className="flex items-center gap-1"><User size={12} /> {c.driverName || c.filledByName}</span>
                  <span>·</span>
                  <span>{c.updatedAt?.toDate?.()?.toLocaleString?.("pt-BR") || ""}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-[10px] uppercase tracking-[0.15em] font-bold px-2.5 py-1 rounded-md border ${isVistoria ? "bg-[#4A7A8C]/15 text-[#2E4F5C] border-[#4A7A8C]/40" : "bg-[#1E3A5F]/15 text-[#0A1A2E] border-[#1E3A5F]/40"}`}>
                {sourceLabel}
              </span>
              <CaretRight size={16} className="text-[#708278] group-hover:text-[#2563EB] group-hover:translate-x-0.5 transition-all" />
            </div>
          </Link>
          );
        })}
      </div>
      <Pagination {...pag} testid="checklists-pagination" />
    </div>
  );
}
