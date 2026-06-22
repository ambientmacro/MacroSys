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
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F7FA]">
      <div className="text-[#1E3A5F] text-sm tracking-widest uppercase font-bold">Carregando…</div>
    </div>
  );
}
