import { useAuth } from "../contexts/AuthContext";
import { Hourglass, SignOut, ArrowsClockwise } from "@phosphor-icons/react";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { USER_STATUS } from "../lib/constants";

export default function PendingApprovalPage() {
  const { profile, logout, refreshProfile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (profile?.status === USER_STATUS.APPROVED) navigate("/");
  }, [profile, navigate]);

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center p-6 font-[Manrope,sans-serif]">
      <div className="max-w-md w-full bg-white border border-[#E2E8E4] rounded-md p-8 text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-[#D9A05B]/15 flex items-center justify-center">
          <Hourglass size={28} className="text-[#8B5E2B]" weight="duotone" />
        </div>
        <h1 className="font-[Outfit,sans-serif] text-2xl font-black text-[#1E3A5F] mt-6">Aguardando aprovação</h1>
        <p className="text-sm text-[#4A564F] mt-3 leading-relaxed">
          Sua conta foi criada com sucesso. Um administrador precisa aprovar seu acesso antes que você possa entrar no sistema.
        </p>
        {profile?.status === USER_STATUS.REJECTED && (
          <p className="mt-3 text-sm text-[#C25D41] font-bold">Seu acesso foi reprovado. Entre em contato com o administrador.</p>
        )}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            onClick={refreshProfile}
            data-testid="refresh-status"
            className="flex items-center justify-center gap-2 border border-[#E2E8E4] text-[#1E3A5F] font-bold uppercase tracking-[0.1em] text-xs py-3 rounded-md hover:bg-[#EFF3F8] transition-all"
          >
            <ArrowsClockwise size={16} /> Verificar
          </button>
          <button
            onClick={async () => { await logout(); navigate("/login"); }}
            data-testid="logout-pending"
            className="flex items-center justify-center gap-2 bg-[#1E3A5F] text-white font-bold uppercase tracking-[0.1em] text-xs py-3 rounded-md hover:bg-[#2A4A78] transition-all"
          >
            <SignOut size={16} /> Sair
          </button>
        </div>
      </div>
    </div>
  );
}
