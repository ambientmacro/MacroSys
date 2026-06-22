import { useEffect, useState } from "react";
import { WhatsappLogo, X, Copy, ArrowSquareOut, Phone, User, Warning } from "@phosphor-icons/react";
import { toast } from "sonner";

export default function WhatsAppNotifier() {
  const [data, setData] = useState(null);

  useEffect(() => {
    const handler = (e) => setData(e.detail);
    window.addEventListener("whatsapp-notify", handler);
    return () => window.removeEventListener("whatsapp-notify", handler);
  }, []);

  if (!data) return null;
  const { recipients = [], message, title = "WhatsApp" } = data;

  const close = () => setData(null);

  const openChat = (phone) => {
    if (!phone) return;
    const clean = String(phone).replace(/\D/g, "");
    const url = `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const copyMsg = async () => {
    try {
      await navigator.clipboard.writeText(message);
      toast.success("Mensagem copiada");
    } catch (e) {
      toast.error("Não foi possível copiar");
    }
  };

  const validRecipients = recipients.filter((r) => r.phone);
  const invalidRecipients = recipients.filter((r) => !r.phone);

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm" onClick={close}>
      <div className="bg-white w-full sm:max-w-xl rounded-t-2xl sm:rounded-md border border-[#E2E8E4] shadow-2xl flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8E4] bg-gradient-to-r from-[#25D366] to-[#128C7E] text-white rounded-t-2xl sm:rounded-t-md">
          <div className="flex items-center gap-3">
            <WhatsappLogo size={24} weight="fill" />
            <div>
              <div className="font-[Outfit,sans-serif] font-black tracking-tight">{title}</div>
              <div className="text-xs text-white/80">Envio manual via WhatsApp · Click-to-Chat</div>
            </div>
          </div>
          <button onClick={close} data-testid="wa-close" className="text-white/90 hover:text-white p-1"><X size={20} /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="text-[11px] uppercase tracking-[0.2em] font-bold text-[#708278]">Mensagem preparada</div>
          <div className="mt-2 bg-[#EFF8EE] border border-[#25D366]/30 rounded-md p-4 relative">
            <pre className="text-sm text-[#0F1411] whitespace-pre-wrap font-[Manrope,sans-serif] leading-relaxed">{message}</pre>
            <button onClick={copyMsg} data-testid="wa-copy"
              className="absolute top-2 right-2 flex items-center gap-1 bg-white border border-[#E2E8E4] text-[#128C7E] text-[10px] uppercase font-bold tracking-[0.1em] px-2 py-1 rounded hover:bg-[#EFF8EE]">
              <Copy size={12} /> Copiar
            </button>
          </div>

          <div className="mt-6 text-[11px] uppercase tracking-[0.2em] font-bold text-[#708278]">
            Destinatários {recipients.length > 0 && `(${recipients.length})`}
          </div>
          <div className="mt-2 space-y-2">
            {validRecipients.map((r, i) => (
              <div key={i} className="flex items-center justify-between border border-[#E2E8E4] rounded-md px-4 py-3 bg-white hover:border-[#25D366]/40 transition-all">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-[#EFF3F8] flex items-center justify-center shrink-0">
                    <User size={16} className="text-[#2563EB]" weight="duotone" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-[#0F1411] truncate">{r.name || "Sem nome"}</div>
                    <div className="text-xs text-[#708278] flex items-center gap-1"><Phone size={11} /> {r.phone}</div>
                  </div>
                </div>
                <button onClick={() => openChat(r.phone)} data-testid={`wa-open-${i}`}
                  className="flex items-center gap-1.5 bg-gradient-to-r from-[#25D366] to-[#128C7E] text-white px-3 py-2 rounded-md text-[11px] font-bold uppercase tracking-[0.1em] hover:opacity-90 shadow-sm">
                  <WhatsappLogo size={14} weight="fill" /> Abrir <ArrowSquareOut size={11} />
                </button>
              </div>
            ))}

            {invalidRecipients.length > 0 && (
              <div className="mt-3 border border-[#F59E0B]/30 bg-[#FEF3C7] rounded-md p-3 flex gap-2">
                <Warning size={16} className="text-[#92400E] shrink-0 mt-0.5" weight="duotone" />
                <div className="text-xs text-[#92400E]">
                  <strong>{invalidRecipients.length} destinatário(s) sem telefone cadastrado:</strong>{" "}
                  {invalidRecipients.map((r) => r.name || r.role).join(", ")}.{" "}
                  Atualize o cadastro do usuário em <strong>Usuários</strong> para incluir o telefone.
                </div>
              </div>
            )}

            {recipients.length === 0 && (
              <div className="text-sm text-[#708278] italic py-4 text-center">Nenhum destinatário encontrado para esta notificação.</div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[#E2E8E4] bg-[#F5F7FA] flex flex-col-reverse sm:flex-row gap-2 sm:items-center sm:justify-between rounded-b-md">
          <div className="text-[10px] text-[#708278] flex items-center gap-1">
            <Warning size={12} /> Integração com API oficial da Meta virá depois — por enquanto envio manual.
          </div>
          <button onClick={close} data-testid="wa-dismiss"
            className="bg-[#0F2542] text-white px-5 py-2.5 rounded-md text-xs font-bold uppercase tracking-[0.1em] hover:bg-[#16294A]">
            Concluído
          </button>
        </div>
      </div>
    </div>
  );
}
