import { useEffect, useState } from "react";
import { DeviceMobile, X, ShareNetwork, Plus } from "@phosphor-icons/react";

const isIos = () => {
  const ua = window.navigator.userAgent || "";
  return /iphone|ipad|ipod/i.test(ua) && !window.MSStream;
};

const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches ||
  window.navigator.standalone === true;

/**
 * Botão de instalação do PWA.
 *
 * - Android/Chrome/Edge: captura o evento `beforeinstallprompt` e abre o
 *   diálogo nativo de instalação.
 * - iOS Safari: o evento não existe, então mostramos um pop-over explicando
 *   "Compartilhar → Adicionar à Tela de Início".
 * - Se o app já está rodando standalone (instalado), o botão fica oculto.
 *
 * Props:
 *  - variant: "primary" | "ghost" | "sidebar" — apenas estilo visual.
 */
export default function InstallAppButton({ variant = "primary" }) {
  const [deferred, setDeferred] = useState(null);
  const [installed, setInstalled] = useState(isStandalone());
  const [showIosHint, setShowIosHint] = useState(false);
  const ios = isIos();

  useEffect(() => {
    if (installed) return;
    const onBefore = (e) => {
      e.preventDefault();
      setDeferred(e);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onBefore);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBefore);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [installed]);

  if (installed) return null;
  // Em desktops/Chromium que ainda não dispararam o evento E não é iOS,
  // não temos como prometer o prompt — escondemos o botão para não enganar.
  if (!deferred && !ios) return null;

  const click = async () => {
    if (ios) { setShowIosHint(true); return; }
    if (!deferred) return;
    try {
      await deferred.prompt();
      await deferred.userChoice;
      setDeferred(null);
    } catch (e) { /* silenciado: user cancelou */ }
  };

  const cls = {
    primary: "w-full flex items-center justify-center gap-2 bg-[#10B981] hover:bg-[#059669] text-white text-xs uppercase tracking-[0.15em] font-bold py-3 rounded-md transition-all",
    ghost: "flex items-center justify-center gap-2 w-full text-xs uppercase tracking-[0.15em] font-bold text-[#10B981] hover:text-[#059669] transition-colors py-2",
    sidebar: "w-full flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white py-2.5 px-3 rounded-md text-[11px] font-bold uppercase tracking-[0.15em] transition-all border border-white/15",
  }[variant];

  return (
    <>
      <button onClick={click} data-testid="btn-install-app" className={cls}>
        <DeviceMobile size={16} weight="bold" />
        <span>Instalar aplicativo</span>
      </button>

      {showIosHint && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-end sm:items-center justify-center p-4" onClick={() => setShowIosHint(false)}>
          <div className="bg-white rounded-md max-w-sm w-full p-6 relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowIosHint(false)} className="absolute top-3 right-3 text-[#708278] hover:text-[#0F2542]" data-testid="ios-hint-close">
              <X size={18} />
            </button>
            <div className="text-xs uppercase tracking-[0.2em] font-bold text-[#10B981]">Instalar no iPhone/iPad</div>
            <h3 className="font-[Outfit,sans-serif] text-xl font-black tracking-tight text-[#0F1411] mt-2">Como adicionar à Tela de Início</h3>
            <ol className="mt-4 space-y-3 text-sm text-[#0F1411]">
              <li className="flex items-start gap-3">
                <span className="flex-none w-6 h-6 rounded-full bg-[#EFF3F8] flex items-center justify-center text-xs font-bold text-[#2563EB]">1</span>
                <span>Toque em <ShareNetwork size={14} className="inline mb-0.5" weight="bold" /> <strong>Compartilhar</strong> na barra do Safari.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-none w-6 h-6 rounded-full bg-[#EFF3F8] flex items-center justify-center text-xs font-bold text-[#2563EB]">2</span>
                <span>Role e toque em <Plus size={14} className="inline mb-0.5" weight="bold" /> <strong>Adicionar à Tela de Início</strong>.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-none w-6 h-6 rounded-full bg-[#EFF3F8] flex items-center justify-center text-xs font-bold text-[#2563EB]">3</span>
                <span>Confirme em <strong>Adicionar</strong> — pronto, o app aparece como ícone nativo.</span>
              </li>
            </ol>
            <div className="text-[11px] text-[#708278] mt-4 italic">Apenas pelo Safari. Outros navegadores no iOS não suportam instalação.</div>
          </div>
        </div>
      )}
    </>
  );
}
