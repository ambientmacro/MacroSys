import { useRef } from "react";
import { FileArrowUp, FileText, Camera } from "@phosphor-icons/react";
import { toast } from "sonner";

// Limite por arquivo (para caber em 1 documento Firestore ≤ 1MB junto com outros campos).
export const MAX_FILE_BYTES = 750 * 1024;

const fileToBase64 = (f) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res({ name: f.name, type: f.type, size: f.size, dataUrl: r.result });
  r.onerror = () => rej(r.error);
  r.readAsDataURL(f);
});

/** Slot de upload para 1 arquivo (CRLV, CNH, etc.) — Base64 → caller persiste. */
export function SingleFileSlot({ testId, label, hint, file, onChange, onClear, allowCamera = false }) {
  const fileRef = useRef(null);
  const camRef = useRef(null);
  const handle = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_FILE_BYTES) {
      toast.error(`Arquivo muito grande (${(f.size / 1024).toFixed(0)}KB). Máximo: ${MAX_FILE_BYTES / 1024}KB.`);
      e.target.value = "";
      return;
    }
    fileToBase64(f).then(onChange);
  };
  return (
    <div className="bg-[#EFF3F8] border border-[#2563EB]/20 rounded-md p-4">
      <div className="text-[11px] uppercase tracking-[0.2em] font-bold text-[#2563EB] mb-1">{label}</div>
      {hint && <div className="text-[11px] text-[#4A564F] mb-3">{hint}</div>}
      {!file ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => fileRef.current?.click()}
            data-testid={`${testId}-pick`}
            className="flex items-center gap-2 border-2 border-dashed border-[#2563EB]/30 hover:bg-white rounded-md px-4 py-3 text-xs font-bold text-[#2563EB] uppercase tracking-[0.1em] transition-all">
            <FileArrowUp size={16} weight="duotone" /> Anexar arquivo
          </button>
          {allowCamera && (
            <button type="button" onClick={() => camRef.current?.click()}
              data-testid={`${testId}-camera`}
              className="flex items-center gap-2 border-2 border-dashed border-[#2563EB]/30 hover:bg-white rounded-md px-4 py-3 text-xs font-bold text-[#2563EB] uppercase tracking-[0.1em] transition-all">
              <Camera size={16} weight="duotone" /> Tirar foto
            </button>
          )}
          <input ref={fileRef} type="file" accept="application/pdf,image/*" onChange={handle} className="hidden" data-testid={`${testId}-input`} />
          {allowCamera && <input ref={camRef} type="file" accept="image/*" capture="environment" onChange={handle} className="hidden" data-testid={`${testId}-camera-input`} />}
        </div>
      ) : (
        <div className="flex items-center justify-between bg-white border border-[#E2E8E4] rounded-md px-3 py-2">
          <a href={file.dataUrl} download={file.name} className="flex items-center gap-2 min-w-0 text-[#0F1411] hover:text-[#2563EB]">
            <FileText size={16} className="text-[#2563EB]" weight="duotone" />
            <span className="text-sm font-bold truncate" data-testid={`${testId}-nome`}>{file.name}</span>
          </a>
          <button type="button" onClick={onClear} data-testid={`${testId}-remove`}
            className="text-[10px] text-[#DC2626] font-bold uppercase tracking-[0.15em] ml-2">Remover</button>
        </div>
      )}
    </div>
  );
}

/** Lista de uploads de múltiplos arquivos (genéricos). */
export function MultiFileSlot({ testId, label, hint, files = [], onAdd, onRemove }) {
  const fileRef = useRef(null);
  const handle = async (e) => {
    const items = Array.from(e.target.files || []);
    const valid = items.filter((f) => {
      if (f.size > MAX_FILE_BYTES) {
        toast.error(`${f.name}: arquivo grande demais (máx ${MAX_FILE_BYTES / 1024}KB).`);
        return false;
      }
      return true;
    });
    const reads = await Promise.all(valid.map(fileToBase64));
    onAdd(reads);
    e.target.value = "";
  };
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.2em] font-bold text-[#0F2542] mb-2">{label}</div>
      {hint && <div className="text-[11px] text-[#708278] mb-3">{hint}</div>}
      <button type="button" onClick={() => fileRef.current?.click()}
        data-testid={`${testId}-add`}
        className="w-full border-2 border-dashed border-[#E2E8E4] hover:border-[#2563EB]/40 hover:bg-[#EFF3F8] rounded-md py-4 flex items-center justify-center gap-2 text-xs font-bold text-[#2563EB] uppercase tracking-[0.1em] transition-all">
        <FileArrowUp size={16} weight="duotone" /> Selecionar arquivos
      </button>
      <input ref={fileRef} type="file" multiple accept="application/pdf,image/*" onChange={handle} className="hidden" data-testid={`${testId}-input`} />
      {files.length > 0 && (
        <div className="mt-3 space-y-2">
          {files.map((f, i) => (
            <div key={i} className="flex items-center justify-between border border-[#E2E8E4] rounded-md px-3 py-2 bg-white" data-testid={`${testId}-item-${i}`}>
              <a href={f.dataUrl} download={f.name} className="flex items-center gap-2 min-w-0 text-[#0F1411] hover:text-[#2563EB]">
                <FileText size={14} className="text-[#2563EB]" weight="duotone" />
                <span className="text-sm font-bold truncate">{f.name}</span>
              </a>
              <button type="button" onClick={() => onRemove(i)}
                className="text-[10px] text-[#DC2626] font-bold uppercase tracking-[0.15em]">Remover</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
