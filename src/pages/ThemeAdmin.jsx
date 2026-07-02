import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDocs, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { ROLES, ROLE_LABELS } from "../lib/constants";
import { THEME_SEEDS, DEFAULT_THEME, AVAILABLE_FONTS, applyTheme } from "../lib/themeDefaults";
import { toast } from "sonner";
import { Palette, FloppyDisk, ArrowCounterClockwise, Eye, Check } from "@phosphor-icons/react";

/**
 * Painel de Temas por Perfil (DP/Admin).
 *
 * Cada perfil (Frota, DP, Medição, Segurança, Encarregado, Performance, Admin,
 * Motorista) tem um "tema" (background, superfície, primária, texto, fonte).
 *
 * O DP escolhe um perfil, edita as cores/fonte, vê o preview ao vivo e
 * clica em "Publicar" para gravar em Firestore (`theme_config/{role}`).
 * Enquanto não publicar, apenas ele vê o preview — outros usuários daquele
 * perfil continuam com o tema atual.
 */
export default function ThemeAdmin() {
  const { profile } = useAuth();
  const canManage = [ROLES.DP, ROLES.ADMIN].includes(profile.role);

  const roles = useMemo(() => [
    ROLES.ADMIN, ROLES.FROTA, ROLES.DP, ROLES.MEDICAO, ROLES.ENCARREGADO,
    ROLES.SEGURANCA, ROLES.PERFORMANCE, ROLES.MOTORISTA,
  ], []);

  const [saved, setSaved] = useState({}); // { [role]: themeObj }
  const [selectedRole, setSelectedRole] = useState(ROLES.FROTA);
  const [draft, setDraft] = useState({ ...DEFAULT_THEME });
  const [previewing, setPreviewing] = useState(false);
  const [busy, setBusy] = useState(false);

  // Carrega todos os overrides do Firestore uma vez.
  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, "theme_config"));
      const map = {};
      snap.forEach((d) => { map[d.id] = d.data(); });
      setSaved(map);
    })();
  }, []);

  // Sempre que muda o perfil selecionado, carrega no draft o override (se
  // existir) ou o seed do fluxograma.
  useEffect(() => {
    const base = saved[selectedRole] || THEME_SEEDS[selectedRole] || DEFAULT_THEME;
    setDraft({ ...DEFAULT_THEME, ...base });
    setPreviewing(false);
  }, [selectedRole, saved]);

  const setField = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

  // Preview ao vivo — aplica o tema atual do draft no :root. Só afeta este
  // navegador; outros usuários não são impactados até "Publicar".
  const togglePreview = () => {
    if (previewing) {
      // Restaura o tema atual do usuário logado (seed do próprio role).
      const meu = saved[profile.role] || THEME_SEEDS[profile.role] || DEFAULT_THEME;
      applyTheme(meu);
      setPreviewing(false);
    } else {
      applyTheme(draft);
      setPreviewing(true);
    }
  };

  // Publica no Firestore. Todos os usuários daquele perfil recebem em
  // tempo real (onSnapshot no ThemeContext).
  const publish = async () => {
    if (!canManage) return;
    setBusy(true);
    try {
      await setDoc(doc(db, "theme_config", selectedRole), draft);
      setSaved((s) => ({ ...s, [selectedRole]: draft }));
      toast.success(`Tema publicado para ${ROLE_LABELS[selectedRole]}. Usuários daquele perfil vão receber automaticamente.`);
    } catch (e) {
      toast.error("Falha ao publicar tema. Verifique as regras do Firestore.");
    } finally { setBusy(false); }
  };

  const resetToSeed = async () => {
    if (!canManage) return;
    setBusy(true);
    try {
      // Remove override → volta ao seed hardcoded.
      await deleteDoc(doc(db, "theme_config", selectedRole));
      const cleaned = { ...saved }; delete cleaned[selectedRole];
      setSaved(cleaned);
      setDraft({ ...DEFAULT_THEME, ...(THEME_SEEDS[selectedRole] || DEFAULT_THEME) });
      toast.success("Tema restaurado para o padrão do fluxograma.");
    } catch (e) {
      toast.error("Falha ao restaurar tema.");
    } finally { setBusy(false); }
  };

  if (!canManage) {
    return <div className="p-10 text-center text-sm text-[#4A564F]">Acesso restrito ao DP e Administrador.</div>;
  }

  return (
    <div className="px-4 sm:px-8 py-8 max-w-6xl mx-auto" data-testid="page-theme-admin">
      <div className="mb-6">
        <div className="text-[10px] uppercase tracking-[0.25em] text-[#708278] font-bold">Departamento Pessoal · Configuração</div>
        <h1 className="font-[Outfit,sans-serif] text-3xl font-black tracking-tight text-[#0F1411] mt-1 flex items-center gap-2">
          <Palette size={28} weight="duotone" className="text-[#7C3AED]" /> Temas por Perfil
        </h1>
        <p className="text-sm text-[#4A564F] mt-1">
          Personalize a cor de fundo, cor primária, texto e fonte de cada perfil de usuário. Ao publicar, todos os usuários daquele perfil recebem o novo tema automaticamente ao abrir/logar.
        </p>
      </div>

      <div className="grid md:grid-cols-[220px_1fr] gap-6">
        {/* Coluna dos perfis */}
        <div className="space-y-1" data-testid="roles-list">
          {roles.map((r) => {
            const t = saved[r] || THEME_SEEDS[r] || DEFAULT_THEME;
            const active = r === selectedRole;
            return (
              <button key={r} onClick={() => setSelectedRole(r)} data-testid={`role-${r}`}
                className={`w-full text-left px-3 py-2.5 rounded-md border-2 transition-all flex items-center gap-3 ${active ? "border-[#0F2542] bg-white" : "border-transparent bg-white/60 hover:bg-white"}`}>
                <div className="w-5 h-5 rounded-full border border-[#E2E8E4] shrink-0" style={{ background: t.primary }} />
                <div className="flex-1">
                  <div className="text-sm font-bold text-[#0F2542]">{ROLE_LABELS[r]}</div>
                  <div className="text-[10px] uppercase tracking-[0.15em] text-[#708278]">
                    {saved[r] ? "Personalizado" : "Fluxograma"}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Editor + Preview */}
        <div>
          <div className="bg-white border border-[#E2E8E4] rounded-md p-5">
            <div className="flex items-baseline justify-between gap-4 mb-4 flex-wrap">
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#708278]">Editando tema de</div>
                <div className="font-[Outfit,sans-serif] text-xl font-black text-[#0F1411]">{ROLE_LABELS[selectedRole]}</div>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={togglePreview} data-testid="btn-preview"
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] uppercase tracking-[0.15em] font-bold border-2 transition-all ${previewing ? "bg-[#0F2542] text-white border-[#0F2542]" : "bg-white text-[#0F2542] border-[#E2E8E4] hover:border-[#0F2542]"}`}>
                  <Eye size={14} /> {previewing ? "Sair do preview" : "Preview ao vivo"}
                </button>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <ColorField label="Background" hint="Fundo geral do sistema. Sugestão: tom pastel." value={draft.bg} onChange={(v) => setField("bg", v)} testId="col-bg" />
              <ColorField label="Superfície (cards)" hint="Fundo dos cartões e painéis. Costuma ficar branco." value={draft.surface} onChange={(v) => setField("surface", v)} testId="col-surface" />
              <ColorField label="Sidebar (fundo)" hint="Cor do menu lateral. Prefira tons escuros." value={draft.sidebarBg} onChange={(v) => setField("sidebarBg", v)} testId="col-sidebarBg" />
              <ColorField label="Sidebar (texto/ícones)" hint="Cor do texto e ícones do sidebar." value={draft.sidebarFg} onChange={(v) => setField("sidebarFg", v)} testId="col-sidebarFg" />
              <ColorField label="Primária (destaque)" hint="Botões, badges e item ativo do sidebar." value={draft.primary} onChange={(v) => setField("primary", v)} testId="col-primary" />
              <ColorField label="Texto sobre primária" hint="Cor do texto dentro dos botões primários." value={draft.primaryFg} onChange={(v) => setField("primaryFg", v)} testId="col-primaryFg" />
              <ColorField label="Texto principal" hint="Cor dos títulos e textos principais." value={draft.text} onChange={(v) => setField("text", v)} testId="col-text" />
              <div>
                <label className="text-[11px] uppercase tracking-[0.2em] font-bold text-[#708278] block mb-1.5">Família da fonte</label>
                <select value={draft.font} onChange={(e) => setField("font", e.target.value)} data-testid="col-font"
                  className="w-full h-10 px-3 rounded-md border-2 border-[#E2E8E4] bg-white text-sm">
                  {AVAILABLE_FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
                <div className="text-[11px] text-[#708278] mt-1 italic">Fonte principal do corpo. Títulos continuam em Outfit.</div>
              </div>
            </div>

            {/* Mini preview visual — inclui uma amostra do sidebar. */}
            <div className="mt-5 rounded-md border-2 border-dashed border-[#E2E8E4] p-4" style={{ background: draft.bg, fontFamily: `"${draft.font}", sans-serif` }}>
              <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#708278] mb-2">Prévia</div>
              <div className="grid grid-cols-[100px_1fr] rounded-md overflow-hidden shadow-sm">
                {/* Mini sidebar */}
                <div className="p-3 space-y-2 text-[10px]" style={{ background: draft.sidebarBg, color: draft.sidebarFg }}>
                  <div className="font-bold uppercase tracking-[0.15em] opacity-60">Menu</div>
                  <div className="rounded px-2 py-1 font-bold" style={{ background: draft.primary, color: draft.primaryFg }}>Dashboard</div>
                  <div className="px-2 py-1 opacity-80">Veículos</div>
                  <div className="px-2 py-1 opacity-80">Requerimentos</div>
                </div>
                {/* Mini card */}
                <div className="p-4" style={{ background: draft.surface, color: draft.text }}>
                  <div className="font-bold text-lg mb-1">Bom dia, {ROLE_LABELS[selectedRole]}</div>
                  <div className="text-sm opacity-80">Este é um exemplo de card renderizado com o tema selecionado.</div>
                  <div className="mt-3 flex gap-2">
                    <button type="button" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-[0.1em]" style={{ background: draft.primary, color: draft.primaryFg }}>
                      <Check size={12} /> Botão primário
                    </button>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-[0.15em]" style={{ background: draft.primary, color: draft.primaryFg }}>
                      badge
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-2 flex-wrap">
              <button type="button" onClick={publish} disabled={busy} data-testid="btn-publish"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-bold uppercase tracking-[0.15em] bg-[#10B981] text-white hover:bg-[#059669] disabled:opacity-50">
                <FloppyDisk size={14} weight="bold" /> Publicar tema
              </button>
              <button type="button" onClick={resetToSeed} disabled={busy} data-testid="btn-reset"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-bold uppercase tracking-[0.15em] bg-white border-2 border-[#E2E8E4] text-[#0F2542] hover:border-[#0F2542] disabled:opacity-50">
                <ArrowCounterClockwise size={14} weight="bold" /> Restaurar padrão do fluxograma
              </button>
              <div className="text-[11px] text-[#708278] italic">
                {saved[selectedRole] ? "Tema personalizado ativo — publicado no Firestore." : "Usando o seed do fluxograma (não personalizado)."}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ColorField({ label, hint, value, onChange, testId }) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-[0.2em] font-bold text-[#708278] block mb-1.5">{label}</label>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} data-testid={`${testId}-picker`}
          className="w-11 h-10 rounded border border-[#E2E8E4] cursor-pointer" />
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} data-testid={`${testId}-hex`}
          className="flex-1 h-10 px-3 rounded-md border-2 border-[#E2E8E4] bg-white text-sm font-mono" />
      </div>
      {hint && <div className="text-[11px] text-[#708278] mt-1 italic">{hint}</div>}
    </div>
  );
}
