import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Printer, ArrowLeft, ClipboardText, Truck, User, CheckCircle, XCircle } from "@phosphor-icons/react";

export default function ChecklistDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [cl, setCl] = useState(null);
  const [template, setTemplate] = useState(null);
  const [vehicle, setVehicle] = useState(null);
  const [driver, setDriver] = useState(null);

  useEffect(() => {
    (async () => {
      const s = await getDoc(doc(db, "checklists", id));
      if (!s.exists()) return;
      const c = { id: s.id, ...s.data() };
      setCl(c);
      const promises = [];
      if (c.templateId) promises.push(getDoc(doc(db, "checklistTemplates", c.templateId)).then((d) => d.exists() && setTemplate({ id: d.id, ...d.data() })));
      if (c.vehicleId) promises.push(getDoc(doc(db, "vehicles", c.vehicleId)).then((d) => d.exists() && setVehicle({ id: d.id, ...d.data() })));
      if (c.driverId) promises.push(getDoc(doc(db, "drivers", c.driverId)).then((d) => d.exists() && setDriver({ id: d.id, ...d.data() })));
      await Promise.all(promises);
    })();
  }, [id]);

  if (!cl) return <div className="p-10 text-sm text-[#4A564F]">Carregando…</div>;

  const handlePrint = () => window.print();

  const renderAnswer = (item) => {
    const a = cl.answers?.[item.id];
    if (item.type === "checkbox") {
      if (a === true) return <span className="inline-flex items-center gap-1 text-[#2E7D32] font-bold text-sm"><CheckCircle size={16} weight="fill" /> Conforme</span>;
      if (a === false) return <span className="inline-flex items-center gap-1 text-[#C25D41] font-bold text-sm"><XCircle size={16} weight="fill" /> Não Conforme</span>;
      return <span className="text-[#708278] italic text-sm">Não respondido</span>;
    }
    return <span className="text-sm text-[#0F1411]">{a ?? "—"}</span>;
  };

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto print-area">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] font-bold text-[#708278] hover:text-[#1E3A5F] no-print">
        <ArrowLeft size={14} /> Voltar
      </button>

      <div className="flex flex-wrap items-end justify-between gap-4 mt-4">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-[#708278] font-bold">
            {(() => {
              if (cl.isFirstExecution || cl.type === "vistoria" || cl.type === "vistoria_entrada")
                return "Checklist · Vistoria de Entrada";
              const src = cl.source || (cl.type === "manual" ? "manual" : "digital");
              return src === "manual" ? "Checklist · Diário (papel)" : "Checklist · Diário (app)";
            })()}
          </div>
          <h1 className="font-[Outfit,sans-serif] text-3xl font-black tracking-tight text-[#0F1411] mt-2 flex items-center gap-3">
            <ClipboardText size={28} weight="duotone" className="text-[#2563EB]" /> {cl.templateName || template?.name || "Checklist"}
          </h1>
          <p className="text-sm text-[#4A564F] mt-1">{cl.createdAt?.toDate?.()?.toLocaleString?.("pt-BR") || ""}</p>
        </div>
        <button onClick={handlePrint} data-testid="cl-detail-print"
          className="no-print flex items-center gap-2 bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] text-white px-5 py-3 rounded-md text-sm font-bold uppercase tracking-[0.1em] hover:from-[#1D4ED8] hover:to-[#1E40AF] shadow-md shadow-blue-900/20">
          <Printer size={16} /> Imprimir / Salvar PDF
        </button>
      </div>

      <div className="mt-8 grid sm:grid-cols-2 gap-4">
        <div className="bg-[#EFF3F8] border border-[#2563EB]/20 rounded-md p-4 flex items-start gap-3">
          <Truck size={20} className="text-[#2563EB] mt-1" weight="duotone" />
          <div>
            <div className="text-[10px] uppercase tracking-[0.15em] font-bold text-[#708278]">Veículo</div>
            <div className="text-sm font-bold text-[#0F2542] mt-0.5">{vehicle?.tag || cl.vehicleTag || "—"}</div>
            {vehicle && <div className="text-xs text-[#4A564F]">{vehicle.marca} {vehicle.modelo}</div>}
          </div>
        </div>
        <div className="bg-[#EFF3F8] border border-[#2563EB]/20 rounded-md p-4 flex items-start gap-3">
          <User size={20} className="text-[#2563EB] mt-1" weight="duotone" />
          <div>
            <div className="text-[10px] uppercase tracking-[0.15em] font-bold text-[#708278]">Motorista / Operador</div>
            <div className="text-sm font-bold text-[#0F2542] mt-0.5">{driver?.name || cl.driverName || cl.filledByName || "—"}</div>
            <div className="text-xs text-[#4A564F]">Preenchido por: {cl.filledByName}</div>
          </div>
        </div>
      </div>

      <div className="mt-8 bg-white border border-[#E2E8E4] rounded-md p-6">
        <h3 className="text-lg font-bold text-[#0F2542] font-[Outfit,sans-serif] mb-4">Itens verificados</h3>
        {!template && <div className="text-sm text-[#708278] italic">Template não disponível (pode ter sido removido).</div>}
        <div className="space-y-3">
          {(template?.items || []).map((item, idx) => (
            <div key={item.id || idx} className="border-b border-[#E2E8E4] pb-3 last:border-0">
              <div className="flex items-start justify-between gap-3">
                <div className="text-sm font-bold text-[#0F1411] flex-1">{idx + 1}. {item.label}</div>
                <div>{renderAnswer(item)}</div>
              </div>
              {cl.photos?.[item.id] && (
                <img src={cl.photos[item.id]} alt="" className="mt-2 w-32 h-32 object-cover rounded-md border border-[#E2E8E4]" />
              )}
            </div>
          ))}
        </div>

        {cl.observations && (
          <div className="mt-6 pt-4 border-t border-[#E2E8E4]">
            <div className="text-[11px] uppercase tracking-[0.2em] font-bold text-[#708278]">Observações</div>
            <p className="text-sm text-[#0F1411] mt-1 whitespace-pre-wrap">{cl.observations}</p>
          </div>
        )}

        {cl.type === "vistoria" && cl.result && (
          <div className={`mt-6 p-4 rounded-md border ${cl.result === "APROVADO" ? "bg-[#2E7D32]/10 border-[#2E7D32]/30 text-[#1B5E20]" : "bg-[#C25D41]/10 border-[#C25D41]/30 text-[#8B3A26]"}`}>
            <div className="text-xs uppercase tracking-[0.15em] font-bold">Resultado da vistoria</div>
            <div className="text-lg font-bold mt-1">{cl.result}</div>
          </div>
        )}
      </div>
    </div>
  );
}
