import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { collection, doc, onSnapshot, updateDoc, serverTimestamp, arrayUnion } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { canActAsSeguranca } from "../lib/roles";
import { getTemplateRevisionStatus, REVISION_WINDOW_DAYS, REVISION_WARNING_DAYS } from "../lib/templateRevision";
import { toast } from "sonner";
import {
  ShieldCheck, ClockClockwise, CheckCircle, Warning, XCircle, PencilSimple, Stack,
} from "@phosphor-icons/react";

const STATUS_LABEL = {
  ok: "Em dia",
  atencao: "Atenção — revisão próxima",
  vencido: "Vencido — revisar agora",
};
const STATUS_COLOR = {
  ok: { bg: "bg-[#10B981]/10", txt: "text-[#065F46]", border: "border-[#10B981]/40", icon: CheckCircle },
  atencao: { bg: "bg-[#D9A05B]/15", txt: "text-[#8B5E2B]", border: "border-[#D9A05B]/40", icon: Warning },
  vencido: { bg: "bg-[#DC2626]/15", txt: "text-[#991B1B]", border: "border-[#DC2626]/40", icon: XCircle },
};

export default function TemplateRevisao() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const canReview = canActAsSeguranca(profile.role);
  const [templates, setTemplates] = useState([]);
  const [filter, setFilter] = useState("todos");
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "checklistTemplates"), (snap) => {
      setTemplates(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // Anota cada template com status calculado e ordena por urgência (vencidos primeiro).
  const enriched = useMemo(() => {
    const arr = templates.map((t) => ({ ...t, rev: getTemplateRevisionStatus(t) }));
    const order = { vencido: 0, atencao: 1, ok: 2 };
    arr.sort((a, b) => order[a.rev.status] - order[b.rev.status] || (a.rev.remainingDays - b.rev.remainingDays));
    return arr;
  }, [templates]);

  const filtered = filter === "todos" ? enriched : enriched.filter((t) => t.rev.status === filter);

  const stats = useMemo(() => ({
    total: enriched.length,
    ok: enriched.filter((t) => t.rev.status === "ok").length,
    atencao: enriched.filter((t) => t.rev.status === "atencao").length,
    vencido: enriched.filter((t) => t.rev.status === "vencido").length,
  }), [enriched]);

  const markReviewed = async (template) => {
    if (!canReview) return;
    setBusy(template.id);
    try {
      await updateDoc(doc(db, "checklistTemplates", template.id), {
        lastReviewedAt: serverTimestamp(),
        lastReviewedBy: profile.name,
        revisionHistory: arrayUnion({
          at: new Date().toISOString(),
          by: profile.name,
          byRole: profile.role,
        }),
      });
      toast.success(`Template "${template.name}" marcado como revisado.`);
    } catch (e) { toast.error(e.message); }
    finally { setBusy(null); }
  };

  return (
    <div className="px-4 sm:px-8 py-8 max-w-6xl mx-auto" data-testid="page-template-revisao">
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-[#708278] font-bold">Segurança do Trabalho</div>
          <h1 className="font-[Outfit,sans-serif] text-3xl font-black tracking-tight text-[#0F1411] mt-1 flex items-center gap-2">
            <ShieldCheck size={28} className="text-[#1E3A5F]" weight="duotone" /> Revisão de Templates
          </h1>
          <p className="text-sm text-[#4A564F] mt-1">
            Cada template deve ser revisado a cada <strong>{REVISION_WINDOW_DAYS / 30} meses</strong>. Alerta começa
            {' '}{(REVISION_WINDOW_DAYS - REVISION_WARNING_DAYS)} dias antes do vencimento.
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-4 gap-3 mb-6">
        <Stat label="Total" value={stats.total} color="#1E3A5F" icon={Stack} testId="stat-total" />
        <Stat label="Em dia" value={stats.ok} color="#10B981" icon={CheckCircle} testId="stat-ok" />
        <Stat label="Atenção" value={stats.atencao} color="#D9A05B" icon={Warning} testId="stat-atencao" />
        <Stat label="Vencidos" value={stats.vencido} color="#DC2626" icon={XCircle} testId="stat-vencido" />
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {["todos", "vencido", "atencao", "ok"].map((f) => {
          const count = f === "todos" ? stats.total : stats[f] || 0;
          const label = f === "todos" ? "Todos" : STATUS_LABEL[f];
          return (
            <button key={f} onClick={() => setFilter(f)} data-testid={`filter-${f}`}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-[0.1em] ${filter === f ? "bg-[#1E3A5F] text-white" : "bg-[#E2E8E4] text-[#4A564F]"}`}>
              {label} ({count})
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-dashed border-[#E2E8E4] rounded-md p-10 text-center">
          <ShieldCheck size={40} className="mx-auto text-[#708278]" weight="duotone" />
          <div className="text-sm text-[#4A564F] mt-3">Nenhum template{filter !== "todos" ? " neste status" : ""}.</div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => {
            const cfg = STATUS_COLOR[t.rev.status];
            const Icon = cfg.icon;
            return (
              <div key={t.id} className={`bg-white border rounded-md p-4 sm:p-5 ${cfg.border}`} data-testid={`template-${t.id}`}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] uppercase tracking-[0.15em] font-bold ${cfg.bg} ${cfg.txt} ${cfg.border}`}>
                      <Icon size={11} weight="bold" /> {STATUS_LABEL[t.rev.status]}
                    </span>
                    <div className="font-[Outfit,sans-serif] text-lg font-bold text-[#0F1411] mt-2">{t.name}</div>
                    {t.vehicleTypeNome && (
                      <div className="text-[11px] uppercase tracking-[0.15em] font-bold text-[#2563EB] mt-1">
                        Tipo: {t.vehicleTypeNome}
                      </div>
                    )}
                    <div className="text-xs text-[#4A564F] mt-2 grid sm:grid-cols-3 gap-x-4 gap-y-1">
                      <div>
                        <span className="text-[#708278]">Última revisão: </span>
                        <strong>{t.rev.lastReviewedAt ? new Date(t.rev.lastReviewedAt).toLocaleDateString("pt-BR") : "—"}</strong>
                        {' '}({t.rev.ageDays} dias)
                      </div>
                      <div>
                        <span className="text-[#708278]">Próxima revisão: </span>
                        <strong>{new Date(t.rev.nextDueAt).toLocaleDateString("pt-BR")}</strong>
                      </div>
                      <div>
                        <span className="text-[#708278]">Itens: </span>
                        <strong>{t.items?.length || 0}</strong>
                      </div>
                    </div>
                    {t.lastReviewedBy && (
                      <div className="text-[10px] text-[#708278] italic mt-1">Última revisão por {t.lastReviewedBy}</div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <button onClick={() => navigate(`/templates`)} data-testid={`edit-${t.id}`}
                      className="flex items-center gap-1 border border-[#1E3A5F] text-[#1E3A5F] hover:bg-[#1E3A5F] hover:text-white px-3 py-2 rounded-md text-[10px] font-bold uppercase tracking-[0.15em] transition-all">
                      <PencilSimple size={12} /> Editar itens
                    </button>
                    {canReview && (
                      <button onClick={() => markReviewed(t)} disabled={busy === t.id} data-testid={`marcar-revisado-${t.id}`}
                        className="flex items-center gap-1 bg-[#10B981] hover:bg-[#059669] text-white px-3 py-2 rounded-md text-[10px] font-bold uppercase tracking-[0.15em] disabled:opacity-50">
                        <ClockClockwise size={12} weight="bold" /> Marcar como revisado
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color, icon: Icon, testId }) {
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
