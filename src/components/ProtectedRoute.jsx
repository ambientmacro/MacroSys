import { Navigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { USER_STATUS } from "../lib/constants";

export default function ProtectedRoute({ children, allow }) {
  const { firebaseUser, profile, loading } = useAuth();
  const location = useLocation();
  const [graceExpired, setGraceExpired] = useState(false);

  // If we have a firebaseUser but profile still loading, give it a grace period
  useEffect(() => {
    if (firebaseUser && !profile) {
      const t = setTimeout(() => setGraceExpired(true), 3500);
      return () => clearTimeout(t);
    } else {
      setGraceExpired(false);
    }
  }, [firebaseUser, profile]);

  if (loading) return <LoadingScreen />;
  if (!firebaseUser) return <Navigate to="/login" state={{ from: location }} replace />;
  if (!profile) {
    if (!graceExpired) return <LoadingScreen />;
    return <Navigate to="/login" replace />;
  }
  if (profile.status !== USER_STATUS.APPROVED) return <Navigate to="/aguardando" replace />;
  if (allow && !allow.includes(profile.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center" data-testid="access-denied">
          <h2 className="text-2xl font-bold text-[#1E3A5F]">Acesso negado</h2>
          <p className="text-sm text-[#4A564F] mt-2">Seu perfil não tem permissão para esta página.</p>
        </div>
      </div>
    );
  }
  return children;
}

function LoadingScreen() {
  // Splash secundário exibido durante navegações protegidas quando o Firebase
  // Auth ainda está resolvendo o profile. Mantém o mesmo visual do splash
  // inicial (index.html) para continuidade visual.
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-gradient-to-br from-[#0F2542] via-[#16294A] to-[#1E3A5F] text-white">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8] flex items-center justify-center shadow-2xl shadow-blue-900/40">
        <svg viewBox="0 0 256 256" className="w-8 h-8 fill-white" aria-hidden="true">
          <path d="M128 24C88 88 48 128 48 168a80 80 0 0 0 160 0c0-40-40-80-80-144Z" />
        </svg>
      </div>
      <div className="text-center">
        <div className="font-[Outfit,sans-serif] font-black text-xl tracking-tight">MACRO AMBIENTAL</div>
        <div className="text-[10px] uppercase tracking-[0.35em] text-white/50 font-bold mt-1">Carregando…</div>
      </div>
      <div className="w-44 h-[3px] rounded-full bg-white/10 overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#60A5FA] to-transparent animate-[splash-slide_1.3s_ease-in-out_infinite]" />
      </div>
      <style>{`@keyframes splash-slide { 0%{transform:translateX(-100%);} 100%{transform:translateX(100%);} }`}</style>
    </div>
  );
}
