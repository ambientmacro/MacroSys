import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../lib/firebase";
import { REQ_STATUS, REQ_STATUS_LABEL, REQ_STATUS_COLOR } from "../lib/constants";
import { useAuth } from "../contexts/AuthContext";
import { FileText, ArrowRight, PlusCircle } from "@phosphor-icons/react";
import { canCreateRequerimento } from "../lib/roles";

export default function RequerimentosList() {
  const { profile } = useAuth();
  const [reqs, setReqs] = useState([]);
  const [filter, setFilter] = useState("ALL");
  const [view, setView] = useState("kanban");

  useEffect(() => {
    const q = query(collection(db, "requerimentos"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setReqs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const filtered = filter === "ALL" ? reqs : reqs.filter((r) => r.status === filter);

  const STATUS_LIST = Object.values(REQ_STATUS);

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-[#708278] font-bold">Fluxo</div>
          <h1 className="font-[Outfit,sans-serif] text-3xl sm:text-4xl font-black tracking-tight text-[#0F1411] mt-2">Requerimentos</h1>
          <p className="text-sm text-[#4A564F] mt-2">Todos os requerimentos em andamento na operação.</p>
        </div>
        <div className="flex gap-2 items-center">
          <div className="flex border border-[#E2E8E4] rounded-md overflow-hidden">
            <button onClick={() => setView("kanban")} data-testid="view-kanban" className={`px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] ${view === "kanban" ? "bg-[#1E3A5F] text-white" : "bg-white text-[#4A564F]"}`}>Kanban</button>
            <button onClick={() => setView("list")} data-testid="view-list" className={`px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] ${view === "list" ? "bg-[#1E3A5F] text-white" : "bg-white text-[#4A564F]"}`}>Lista</button>
          </div>
          {canCreateRequerimento(profile?.role) && (
            <Link to="/requerimentos/novo" data-testid="btn-novo-req"
              className="flex items-center gap-2 bg-[#1E3A5F] text-white px-5 py-2.5 rounded-md text-xs font-bold uppercase tracking-[0.1em] hover:bg-[#2A4A78] transition-all">
              <PlusCircle size={16} /> Novo
            </Link>
          )}
        </div>
      </div>

      {view === "list" && (
        <>
          <div className="mt-6 flex flex-wrap gap-2">
            <FilterChip label="Todos" active={filter === "ALL"} onClick={() => setFilter("ALL")} />
            {STATUS_LIST.map((s) => (
              <FilterChip key={s} label={REQ_STATUS_LABEL[s]} active={filter === s} onClick={() => setFilter(s)} />
            ))}
          </div>
          <div className="mt-6 space-y-2">
            {filtered.length === 0 && <EmptyState />}
            {filtered.map((r) => <RequerimentoCard key={r.id} req={r} />)}
          </div>
        </>
      )}

      {view === "kanban" && (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {STATUS_LIST.map((s) => (
            <div key={s} className="bg-[#EFF3F8] rounded-md border border-[#E2E8E4] p-3 min-h-[200px]">
              <div className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] uppercase tracking-[0.15em] font-bold border ${REQ_STATUS_COLOR[s]}`}>
                {REQ_STATUS_LABEL[s]}
              </div>
              <div className="text-xs text-[#708278] mt-1 font-bold">{reqs.filter((r) => r.status === s).length}</div>
              <div className="mt-3 space-y-2">
                {reqs.filter((r) => r.status === s).map((r) => (
                  <Link key={r.id} to={`/requerimentos/${r.id}`} data-testid={`kanban-card-${r.id}`}
                    className="block bg-white border border-[#E2E8E4] rounded-md p-3 hover:border-[#1E3A5F]/40 transition-all">
                    <div className="text-[10px] uppercase tracking-[0.15em] text-[#708278] font-bold">{r.type}</div>
                    <div className="text-sm font-bold text-[#0F1411] mt-1 truncate">
                      {r.data?.motorista_nome || r.data?.tag || r.data?.marca || "Requerimento"}
                    </div>
                    <div className="text-xs text-[#4A564F] mt-1 truncate">por {r.createdByName}</div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({ label, active, onClick }) {
  return (
    <button onClick={onClick}
      className={`text-xs uppercase tracking-[0.15em] font-bold px-3 py-2 rounded-md border transition-all ${active ? "bg-[#1E3A5F] text-white border-[#1E3A5F]" : "bg-white text-[#4A564F] border-[#E2E8E4] hover:border-[#1E3A5F]/40"}`}>
      {label}
    </button>
  );
}

function RequerimentoCard({ req }) {
  return (
    <Link to={`/requerimentos/${req.id}`} data-testid={`req-row-${req.id}`}
      className="flex items-center justify-between border border-[#E2E8E4] bg-white px-5 py-4 rounded-md hover:border-[#1E3A5F]/40 transition-all">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-[#EFF3F8] rounded-md flex items-center justify-center">
          <FileText size={18} className="text-[#1E3A5F]" weight="duotone" />
        </div>
        <div>
          <div className="text-sm font-bold text-[#0F1411]">
            {req.data?.motorista_nome || req.data?.tag || `${req.data?.marca || ""} ${req.data?.modelo || ""}`.trim() || "Requerimento"}
          </div>
          <div className="text-xs text-[#708278] mt-0.5">Tipo: {req.type} · por {req.createdByName}</div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className={`hidden sm:inline-flex text-[10px] uppercase tracking-[0.15em] font-bold px-2.5 py-1 rounded-md border ${REQ_STATUS_COLOR[req.status] || "bg-gray-100"}`}>
          {REQ_STATUS_LABEL[req.status] || req.status}
        </span>
        <ArrowRight size={18} className="text-[#708278]" />
      </div>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="border border-dashed border-[#E2E8E4] rounded-md p-10 text-center">
      <FileText size={36} className="mx-auto text-[#708278]" weight="duotone" />
      <div className="font-bold text-[#1E3A5F] mt-3">Nenhum requerimento</div>
      <div className="text-sm text-[#4A564F] mt-1">Crie o primeiro requerimento para iniciar o fluxo.</div>
    </div>
  );
}
