import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, onSnapshot, query, where, orderBy } from "firebase/firestore";
import { db } from "../lib/firebase";
import { REQ_STATUS, REQ_STATUS_LABEL } from "../lib/constants";
import { ClipboardText, ArrowRight, ShieldCheck } from "@phosphor-icons/react";

export default function VistoriasList() {
  const [pendentes, setPendentes] = useState([]);
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "requerimentos"), where("status", "==", REQ_STATUS.AGUARDANDO_VISTORIA)),
      (snap) => setPendentes(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return () => unsub();
  }, []);

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <div className="text-xs uppercase tracking-[0.25em] text-[#708278] font-bold flex items-center gap-2">
        <ShieldCheck size={14} /> Segurança do Trabalho
      </div>
      <h1 className="font-[Outfit,sans-serif] text-3xl font-black tracking-tight text-[#0F1411] mt-2">Vistorias de Entrada</h1>
      <p className="text-sm text-[#4A564F] mt-2">Veículos aguardando vistoria obrigatória de entrada.</p>

      <div className="mt-8 space-y-2">
        {pendentes.length === 0 && (
          <div className="border border-dashed border-[#E2E8E4] rounded-md p-10 text-center">
            <ClipboardText size={32} className="mx-auto text-[#708278]" weight="duotone" />
            <div className="text-sm text-[#4A564F] mt-2">Nenhuma vistoria pendente.</div>
          </div>
        )}
        {pendentes.map((r) => (
          <Link key={r.id} to={`/vistoria/${r.id}`} data-testid={`vist-row-${r.id}`}
            className="flex items-center justify-between border border-[#E2E8E4] bg-white px-5 py-4 rounded-md hover:border-[#1E3A5F]/40">
            <div>
              <div className="text-sm font-bold text-[#0F1411]">{r.data?.tag || `${r.data?.marca} ${r.data?.modelo}`}</div>
              <div className="text-xs text-[#708278] mt-0.5">Requerimento por {r.createdByName}</div>
            </div>
            <ArrowRight size={18} className="text-[#1E3A5F]" />
          </Link>
        ))}
      </div>
    </div>
  );
}
