import "@/App.css";
import "@/index.css";
import { useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import LoginPage from "@/pages/LoginPage";
import PendingApprovalPage from "@/pages/PendingApprovalPage";
import DashboardRouter from "@/pages/DashboardRouter";
import RequerimentoWizard from "@/pages/RequerimentoWizard";
import RequerimentosList from "@/pages/RequerimentosList";
import RequerimentoDetail from "@/pages/RequerimentoDetail";
import VistoriaEntrada from "@/pages/VistoriaEntrada";
import VistoriasList from "@/pages/VistoriasList";
import ChecklistTemplates from "@/pages/ChecklistTemplates";
import ChecklistFill from "@/pages/ChecklistFill";
import ChecklistList from "@/pages/ChecklistList";
import VeiculosList from "@/pages/VeiculosList";
import VehicleDetail from "@/pages/VehicleDetail";
import FrotaRelatorios from "@/pages/FrotaRelatorios";
import ChecklistDetail from "@/pages/ChecklistDetail";
import MotoristasList from "@/pages/MotoristasList";
import UsersAdmin from "@/pages/UsersAdmin";
import TeamsAdmin from "@/pages/TeamsAdmin";
import VehicleTypesAdmin from "@/pages/VehicleTypesAdmin";
import FuncoesAdmin from "@/pages/FuncoesAdmin";
import IndicacaoForm from "@/pages/IndicacaoForm";
import IndicacoesList from "@/pages/IndicacoesList";
import ChecklistsPainel from "@/pages/ChecklistsPainel";
import GetrakImport from "@/pages/GetrakImport";
import TemplateRevisao from "@/pages/TemplateRevisao";
import FrotaCustos from "@/pages/FrotaCustos";
import ThemeAdmin from "@/pages/ThemeAdmin";
import BackupAdmin from "@/pages/BackupAdmin";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ROLES } from "@/lib/constants";

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
      <BrowserRouter>
        <Toaster position="top-right" richColors closeButton />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/aguardando" element={<PendingApprovalPage />} />

          <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route index element={<DashboardRouter />} />
            <Route path="/requerimentos" element={<RequerimentosList />} />
            <Route path="/requerimentos/novo" element={
              <ProtectedRoute allow={[ROLES.FROTA, ROLES.DP, ROLES.ADMIN]}>
                <RequerimentoWizard />
              </ProtectedRoute>
            } />
            <Route path="/requerimentos/:id" element={<RequerimentoDetail />} />

            {/* Indicação de necessidade — Encarregado */}
            <Route path="/indicacoes" element={
              <ProtectedRoute allow={[ROLES.ENCARREGADO, ROLES.FROTA, ROLES.ADMIN]}>
                <IndicacoesList />
              </ProtectedRoute>
            } />
            <Route path="/indicacoes/nova" element={
              <ProtectedRoute allow={[ROLES.ENCARREGADO, ROLES.ADMIN]}>
                <IndicacaoForm />
              </ProtectedRoute>
            } />

            {/* Painel de Checklists — Frota e Encarregado */}
            <Route path="/checklists/painel" element={
              <ProtectedRoute allow={[ROLES.FROTA, ROLES.ENCARREGADO, ROLES.ADMIN]}>
                <ChecklistsPainel />
              </ProtectedRoute>
            } />

            {/* Importação GETRAK — Frota / Admin */}
            <Route path="/getrak" element={
              <ProtectedRoute allow={[ROLES.FROTA, ROLES.ADMIN]}>
                <GetrakImport />
              </ProtectedRoute>
            } />

            {/* Revisão de Templates (6 meses) — Segurança / Admin */}
            <Route path="/templates/revisao" element={
              <ProtectedRoute allow={[ROLES.SEGURANCA, ROLES.ADMIN]}>
                <TemplateRevisao />
              </ProtectedRoute>
            } />

            {/* Custo Total da Frota — Frota / Medição / Performance / Admin */}
            <Route path="/frota/custos" element={
              <ProtectedRoute allow={[ROLES.FROTA, ROLES.MEDICAO, ROLES.PERFORMANCE, ROLES.ADMIN]}>
                <FrotaCustos />
              </ProtectedRoute>
            } />

            {/* Tipos de Veículo — Medição (edit), demais (view) */}
            <Route path="/tipos-veiculo" element={
              <ProtectedRoute allow={[ROLES.MEDICAO, ROLES.PERFORMANCE, ROLES.FROTA, ROLES.DP, ROLES.ADMIN]}>
                <VehicleTypesAdmin />
              </ProtectedRoute>
            } />

            {/* Funções / Cargos — Performance */}
            <Route path="/funcoes" element={
              <ProtectedRoute allow={[ROLES.PERFORMANCE, ROLES.ADMIN]}>
                <FuncoesAdmin />
              </ProtectedRoute>
            } />

            <Route path="/vistorias" element={
              <ProtectedRoute allow={[ROLES.SEGURANCA, ROLES.ADMIN]}><VistoriasList /></ProtectedRoute>
            } />
            <Route path="/vistoria/:reqId" element={
              <ProtectedRoute allow={[ROLES.SEGURANCA, ROLES.ADMIN]}><VistoriaEntrada /></ProtectedRoute>
            } />

            <Route path="/templates" element={
              <ProtectedRoute allow={[ROLES.SEGURANCA, ROLES.ADMIN]}><ChecklistTemplates /></ProtectedRoute>
            } />

            <Route path="/checklist/digital" element={
              <ProtectedRoute allow={[ROLES.MOTORISTA, ROLES.ENCARREGADO, ROLES.ADMIN]}>
                <ChecklistFill mode="digital" />
              </ProtectedRoute>
            } />
            <Route path="/checklist/manual" element={
              <ProtectedRoute allow={[ROLES.ENCARREGADO, ROLES.ADMIN]}>
                <ChecklistFill mode="manual" />
              </ProtectedRoute>
            } />
            <Route path="/checklists" element={<ChecklistList />} />
            <Route path="/checklists/:id" element={<ChecklistDetail />} />

            <Route path="/veiculos" element={<VeiculosList />} />
            <Route path="/veiculos/:id" element={<VehicleDetail />} />
            <Route path="/frota/relatorios" element={
              <ProtectedRoute allow={[ROLES.MEDICAO, ROLES.PERFORMANCE, ROLES.FROTA, ROLES.ADMIN]}><FrotaRelatorios /></ProtectedRoute>
            } />
            <Route path="/motoristas" element={
              <ProtectedRoute allow={[ROLES.ENCARREGADO, ROLES.FROTA, ROLES.SEGURANCA, ROLES.DP, ROLES.ADMIN]}>
                <MotoristasList />
              </ProtectedRoute>
            } />
            <Route path="/teams" element={
              <ProtectedRoute allow={[ROLES.PERFORMANCE, ROLES.DP, ROLES.ADMIN]}><TeamsAdmin /></ProtectedRoute>
            } />
            <Route path="/users" element={
              <ProtectedRoute allow={[ROLES.ADMIN, ROLES.ENCARREGADO, ROLES.FROTA, ROLES.DP]}><UsersAdmin /></ProtectedRoute>
            } />

            {/* Temas por perfil — DP/Admin */}
            <Route path="/temas" element={
              <ProtectedRoute allow={[ROLES.DP, ROLES.ADMIN]}><ThemeAdmin /></ProtectedRoute>
            } />

            {/* Backup & Restauração — apenas Admin TI */}
            <Route path="/backup" element={
              <ProtectedRoute allow={[ROLES.ADMIN]}><BackupAdmin /></ProtectedRoute>
            } />
          </Route>

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;

/**
 * SplashController — decide QUANDO e COMO remover o splash HTML inicial.
 * Regras (afinadas para performance):
 *   • `sessionStorage["macro-splash-seen"]` já existe → foi escondido pelo
 *     script inline do index.html; só limpa DOM sem esperar loading.
 *   • Firebase resolveu `loading=false`:
 *       - Se há sessão logada (`firebaseUser`): some IMEDIATAMENTE.
 *       - Se NÃO há sessão: aguarda mínimo 800 ms (evita "piscar" a tela
 *         de login em cold-start rápido).
 * Grava `sessionStorage["macro-splash-seen"]=1` ao dismissar, para não
 * reaparecer em F5 / navegações da mesma sessão.
 */
function SplashController() {
  const { loading, firebaseUser } = useAuth();
  const mountedAtRef = useRef(Date.now());

  useEffect(() => {
    const el = document.getElementById("app-splash");
    if (!el) return;

    // Sessão repetida: splash já foi escondido pelo inline script. Só limpa
    // do DOM e sai — não precisa aguardar loading para nada.
    if (el.classList.contains("is-seen")) {
      try { sessionStorage.setItem("macro-splash-seen", "1"); } catch (e) { /* noop */ }
      const t = setTimeout(() => el.remove(), 50);
      return () => clearTimeout(t);
    }

    // Primeira visita da sessão: aguarda o Auth resolver antes de decidir
    // a política de dismiss (logado = instantâneo, anônimo = 800 ms mínimo).
    if (loading) return;

    const MIN_ANON_MS = 800;
    const elapsed = Date.now() - mountedAtRef.current;
    const wait = firebaseUser ? 0 : Math.max(0, MIN_ANON_MS - elapsed);

    const t = setTimeout(() => {
      el.classList.add("is-out");
      try { sessionStorage.setItem("macro-splash-seen", "1"); } catch (e) { /* noop */ }
      setTimeout(() => el.remove(), 350);
    }, wait);
    return () => clearTimeout(t);
  }, [loading, firebaseUser]);

  return null;
}
