import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { normalizeLoginIdentifier, isMatricula } from "../lib/auth-identifier";
import {
  Drop, Truck, ShieldCheck, ClipboardText, Info,
  UsersThree, FileText, MagnifyingGlass, ChartLine, Package,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import InstallAppButton from "../components/InstallAppButton";

// Cartões de features exibidos no painel esquerdo — refletem o que o sistema
// já entrega hoje. Mantido como constante para facilitar futuras adições.
const FEATURES = [
  { i: FileText, l: "Requerimentos", c: "from-[#3B82F6] to-[#2563EB]" },
  { i: Truck, l: "Frota", c: "from-[#0EA5E9] to-[#0369A1]" },
  { i: UsersThree, l: "Motoristas", c: "from-[#8B5CF6] to-[#6D28D9]" },
  { i: ShieldCheck, l: "Vistoria", c: "from-[#10B981] to-[#059669]" },
  { i: ClipboardText, l: "Checklists", c: "from-[#F59E0B] to-[#D97706]" },
  { i: MagnifyingGlass, l: "GETRAK", c: "from-[#EC4899] to-[#BE185D]" },
  { i: ChartLine, l: "Custos", c: "from-[#22C55E] to-[#15803D]" },
  { i: Package, l: "Backup", c: "from-[#F97316] to-[#C2410C]" },
];

// Logo composta com as três marcas do grupo — servida como asset público.
const GROUP_LOGOS_URL =
  "https://customer-assets-jt897jd0.emergentagent.net/job_frota-operacional/artifacts/v0azwjyo_3%20logos.jpg.jpeg";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  // `identifier` aceita e-mail OU matrícula de 7 dígitos (motoristas internos).
  const [form, setForm] = useState({ identifier: "", password: "" });

  const onChange = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Converte matrícula em pseudo-email transparente para o Firebase Auth.
      const email = normalizeLoginIdentifier(form.identifier);
      await login(email, form.password);
      toast.success("Login realizado");
      navigate("/");
    } catch (err) {
      toast.error("Erro ao entrar", { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const identifierLooksLikeMatricula = isMatricula((form.identifier || "").trim().toUpperCase());

  return (
    <div className="min-h-screen flex font-[Manrope,sans-serif] bg-[#F5F7FA]">
      {/* Left visual panel - navy */}
      <div className="hidden lg:flex w-1/2 relative overflow-hidden bg-gradient-to-br from-[#0F2542] via-[#16294A] to-[#1E3A5F]">
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: "radial-gradient(circle at 20% 30%, #3B82F6 0%, transparent 50%), radial-gradient(circle at 80% 70%, #2563EB 0%, transparent 50%)",
        }} />
        <div className="relative z-10 flex flex-col justify-between p-10 xl:p-12 text-white w-full">
          {/* Cabeçalho */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-md bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8] flex items-center justify-center shadow-lg shadow-blue-900/30">
              <Drop size={26} weight="fill" />
            </div>
            <div>
              <div className="font-[Outfit,sans-serif] font-black text-2xl tracking-tight leading-none">MACRO AMBIENTAL</div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-white/60 font-bold mt-1">Engenharia · Saneamento</div>
            </div>
          </div>

          {/* Bloco central */}
          <div>
            <h1 className="font-[Outfit,sans-serif] text-4xl xl:text-5xl font-black tracking-tight leading-tight">
              Gestão operacional<br />de frota, segurança e pessoas.
            </h1>
            <p className="text-base text-white/80 mt-4 max-w-lg leading-relaxed">
              Requerimentos, vistoria de entrada, checklists digital e manual, importação GETRAK, custos, backup e temas — tudo integrado num só sistema.
            </p>
            <div className="grid grid-cols-4 gap-3 mt-8 max-w-xl">
              {FEATURES.map(({ i: Ic, l, c }) => (
                <div key={l} className="border border-white/15 rounded-md p-3 backdrop-blur-sm bg-white/5 hover:bg-white/10 transition-colors" data-testid={`login-feat-${l.toLowerCase()}`}>
                  <div className={`w-8 h-8 rounded bg-gradient-to-br ${c} flex items-center justify-center`}>
                    <Ic size={16} weight="bold" />
                  </div>
                  <div className="mt-2.5 text-[10px] uppercase tracking-[0.15em] font-bold leading-tight">{l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Rodapé — Grupo empresarial */}
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] font-bold text-white/50 mb-2">Grupo empresarial</div>
            <div className="bg-white rounded-md px-4 py-3 inline-flex items-center max-w-md" data-testid="login-group-logos">
              <img
                src={GROUP_LOGOS_URL}
                alt="Grupo Macro · Dinâmica Construções · RC Silva Engenharia"
                className="h-16 xl:h-20 w-auto object-contain"
                loading="lazy"
              />
            </div>
            <div className="mt-4 text-[10px] uppercase tracking-[0.25em] text-white/40">v1.0 · Operacional</div>
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-md bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8] flex items-center justify-center">
              <Drop size={22} weight="fill" className="text-white" />
            </div>
            <span className="font-[Outfit,sans-serif] font-black text-lg tracking-tight text-[#0F2542]">MACRO AMBIENTAL</span>
          </div>
          <div className="text-xs uppercase tracking-[0.25em] text-[#708278] font-bold">Acesso restrito</div>
          <h2 className="font-[Outfit,sans-serif] text-3xl sm:text-4xl font-black tracking-tight text-[#0F1411] mt-2">
            Entrar no sistema
          </h2>
          <p className="text-sm text-[#4A564F] mt-2">
            Use as credenciais fornecidas pelo Administrador do sistema.
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <div>
              <label className="text-[11px] uppercase tracking-[0.2em] font-bold text-[#708278] block mb-1.5">
                E-mail ou matrícula
              </label>
              <input
                data-testid="login-email"
                type="text"
                required
                value={form.identifier}
                onChange={(e) => onChange("identifier", e.target.value)}
                placeholder="seu@email.com ou MOT12345"
                autoComplete="username"
                className="w-full border border-[#E2E8E4] bg-white px-4 py-3 rounded-md text-sm text-[#0F1411] focus:outline-none focus:border-[#2563EB] focus:border-2 transition-all"
              />
              {identifierLooksLikeMatricula && (
                <div className="text-[11px] text-[#2563EB] mt-1.5 font-bold uppercase tracking-[0.1em]" data-testid="login-matricula-hint">
                  ✓ Detectado login por matrícula
                </div>
              )}
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-[0.2em] font-bold text-[#708278] block mb-1.5">Senha</label>
              <input
                data-testid="login-password"
                type="password"
                required
                minLength={6}
                value={form.password}
                onChange={(e) => onChange("password", e.target.value)}
                className="w-full border border-[#E2E8E4] bg-white px-4 py-3 rounded-md text-sm text-[#0F1411] focus:outline-none focus:border-[#2563EB] focus:border-2 transition-all"
              />
            </div>

            <button
              type="submit"
              data-testid="login-submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] hover:from-[#1D4ED8] hover:to-[#1E40AF] text-white font-bold uppercase tracking-[0.15em] text-sm py-3.5 rounded-md transition-all duration-200 disabled:opacity-50 shadow-md shadow-blue-900/20"
            >
              {loading ? "Aguarde…" : "Entrar"}
            </button>
          </form>

          <div className="mt-8 border border-[#E2E8E4] bg-[#EFF3F8] rounded-md p-4 flex gap-3">
            <Info size={18} className="text-[#2563EB] mt-0.5 shrink-0" weight="duotone" />
            <div className="text-xs text-[#4A564F] leading-relaxed">
              <strong className="text-[#0F2542]">Cadastros são restritos.</strong> Para obter acesso, solicite ao administrador do sistema (TI/DP) que crie seu usuário.
            </div>
          </div>

          {/* Manual público — disponível antes do login para consulta geral. */}
          <a
            href="/manuais/manual-completo.md"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="login-manual-link"
            className="mt-3 flex items-center justify-center gap-2 text-xs uppercase tracking-[0.15em] font-bold text-[#2563EB] hover:text-[#1D4ED8] transition-colors py-2"
          >
            <FileText size={14} weight="bold" /> Baixar manual completo do sistema
          </a>

          {/* Grupo empresarial — visível no mobile (o lg mostra no painel esquerdo) */}
          <div className="lg:hidden mt-6 flex flex-col items-center gap-2" data-testid="login-group-logos-mobile">
            <div className="text-[10px] uppercase tracking-[0.3em] font-bold text-[#708278]">Grupo empresarial</div>
            <img
              src={GROUP_LOGOS_URL}
              alt="Grupo Macro · Dinâmica Construções · RC Silva Engenharia"
              className="h-14 w-auto object-contain"
              loading="lazy"
            />
          </div>

          {/* ✅ INSTALAR APP — Android/Chrome (prompt nativo) e iOS (instruções) */}
          <div className="mt-3">
            <InstallAppButton variant="ghost" />
          </div>

        </div>
      </div>
    </div>
  );
}
