import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, writeBatch, doc, addDoc, serverTimestamp, orderBy, query, limit, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { ROLES } from "../lib/constants";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
  Database, Download, Upload, Trash, FileText, FileXls, ClockCounterClockwise, Warning,
  ArrowsClockwise, Check,
} from "@phosphor-icons/react";

/**
 * Painel de Backup & Restauração (perfil TI/Admin).
 *
 * ATENÇÃO: essa tela é uma ferramenta de administração destrutiva.
 * Toda operação (export / import / reset) é registrada na coleção
 * `audit_backups` no Firestore para trilha auditável.
 *
 * O usuário mencionou que quer:
 *  - Exportar dados em JSON / CSV / Excel para análise em planilhas
 *  - Importar JSON de backup (restauração seletiva)
 *  - Resetar coleções específicas (apenas para testes iniciais — futuramente
 *    esta tela deve ser desativada em produção)
 *  - Registro completo de auditoria: quem, quando, o quê, quantos docs,
 *    tamanho aproximado do payload (bytes do JSON serializado)
 */

// Coleções que fazem parte do "domínio" do sistema. Se aparecer coleção nova
// no futuro (ex.: storage/uploads), adicionar aqui manualmente.
const COLLECTIONS = [
  { id: "users", label: "Usuários" },
  { id: "drivers", label: "Motoristas" },
  { id: "vehicles", label: "Veículos" },
  { id: "vehicleTypes", label: "Tipos de Veículo" },
  { id: "teams", label: "Equipes" },
  { id: "requerimentos", label: "Requerimentos" },
  { id: "checklists", label: "Checklists" },
  { id: "checklist_templates", label: "Templates de Checklist" },
  { id: "funcoes", label: "Funções / Cargos" },
  { id: "theme_config", label: "Temas (por perfil)" },
  { id: "notifications", label: "Notificações" },
];

export default function BackupAdmin() {
  const { profile } = useAuth();
  const canManage = profile.role === ROLES.ADMIN;

  const [counts, setCounts] = useState({});     // { collectionId: docsCount }
  const [busy, setBusy] = useState({});          // { [key]: true }
  const [auditLog, setAuditLog] = useState([]);
  const [loadingCounts, setLoadingCounts] = useState(false);

  // Contagem inicial das coleções (só uma leitura, sob demanda).
  const refreshCounts = async () => {
    setLoadingCounts(true);
    const next = {};
    for (const c of COLLECTIONS) {
      try {
        const snap = await getDocs(collection(db, c.id));
        next[c.id] = snap.size;
      } catch { next[c.id] = -1; }
    }
    setCounts(next);
    setLoadingCounts(false);
  };

  useEffect(() => { if (canManage) { refreshCounts(); } }, [canManage]);

  // Auditoria em tempo real — cada nova operação (import/export/reset)
  // aparece imediatamente na tabela sem precisar recarregar a página.
  // Usa onSnapshot em vez de getDocs para pegar writes recém-feitos e não
  // depender de `at` já ter sido resolvido pelo serverTimestamp.
  useEffect(() => {
    if (!canManage) return;
    const q = query(collection(db, "audit_backups"), orderBy("at", "desc"), limit(50));
    const unsub = onSnapshot(q, (snap) => {
      setAuditLog(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (err) => {
      console.error("audit_backups snapshot failed:", err);
      toast.error("Falha ao ler audit_backups: " + err.message);
    });
    return () => unsub();
  }, [canManage]);

  const loadAudit = async () => {
    // Mantido apenas como no-op / atalho legado. O snapshot acima já
    // atualiza `auditLog` automaticamente após cada `addDoc`.
  };

  const setBusyKey = (k, v) => setBusy((b) => ({ ...b, [k]: v }));

  const registerAudit = async ({ action, collectionId, count, sizeBytes, format, notes }) => {
    // ⚠ Erro aqui NÃO pode ser silencioso — se a regra Firestore não
    // permitir write em audit_backups, o usuário precisa ver por que a
    // trilha não está registrando ações (ex.: reset).
    try {
      await addDoc(collection(db, "audit_backups"), {
        at: serverTimestamp(),
        byUserId: profile.id,
        byName: profile.name || profile.email,
        action,
        collectionId,
        count,
        sizeBytes,
        format,
        notes: notes || null,
      });
    } catch (e) {
      console.error("audit_backups write failed:", e);
      toast.error(`Auditoria não foi registrada (${action}): ${e.message || "verifique as regras do Firestore."}`);
    }
  };

  // ─────────── Import completo (bundle) ───────────
  const importFullBundle = async (file) => {
    if (!file) return;
    if (!window.confirm("Importar backup COMPLETO? Todos os registros do arquivo serão criados/sobrescritos (por id). Nenhum registro fora do backup será apagado.")) return;
    setBusyKey("imp-full", true);
    try {
      const text = await file.text();
      const bytes = new Blob([text]).size;
      const bundle = JSON.parse(text);
      if (!bundle || typeof bundle !== "object" || Array.isArray(bundle)) {
        throw new Error('JSON inválido — esperado formato { "colecao": [ ... ] }');
      }
      // Valida presença de id em TODOS os registros de TODAS as coleções.
      const semId = [];
      for (const [colId, rows] of Object.entries(bundle)) {
        if (!Array.isArray(rows)) continue;
        rows.forEach((r, idx) => { if (!r || !r.id) semId.push(`${colId}[${idx}]`); });
      }
      if (semId.length > 0) {
        throw new Error(`${semId.length} registro(s) sem "id" no bundle (${semId.slice(0, 3).join(", ")}${semId.length > 3 ? "…" : ""}). Todos os documentos precisam preservar o id original.`);
      }
      // Escreve por coleção, em batches de 400.
      let totalWritten = 0;
      for (const [colId, rows] of Object.entries(bundle)) {
        if (!Array.isArray(rows) || rows.length === 0) continue;
        for (let i = 0; i < rows.length; i += 400) {
          const batch = writeBatch(db);
          rows.slice(i, i + 400).forEach((r) => {
            const { id, ...rest } = r;
            batch.set(doc(db, colId, id), rest, { merge: true });
          });
          await batch.commit();
          totalWritten += Math.min(400, rows.length - i);
        }
      }
      toast.success(`Backup completo importado: ${totalWritten} registros em ${Object.keys(bundle).length} coleções.`);
      registerAudit({ action: "import", collectionId: null, count: totalWritten, sizeBytes: bytes, format: "json", notes: "backup_completo" });
      refreshCounts();
    } catch (e) {
      toast.error("Falha ao importar backup completo: " + e.message);
    } finally { setBusyKey("imp-full", false); }
  };

  // ─────────── Export ───────────
  // Excel tem limite de 32.767 caracteres por célula. Como nossos docs
  // guardam anexos como base64 (contratoBase64, CRLV, CNH, fotos…), essas
  // colunas explodem o limite. Estratégia para o EXCEL apenas:
  //   1. Detectamos colunas "bloated" = qualquer valor > 32k chars ou que
  //      pareça anexo base64 (`data:image/…`, `data:application/…`).
  //   2. Omitimos essas colunas por completo (nem aparecem no XLSX/CSV).
  //   3. Firestore Timestamp → string ISO; objetos/arrays → JSON.stringify.
  //   4. Se ainda assim alguma célula estourar 32k, trunca com marcador.
  // O JSON permanece INTACTO com o base64 — é o backup fiel para restaurar
  // fotos/contratos.
  const MAX_CELL = 32767;
  const isBase64Anexo = (s) => typeof s === "string" && /^data:(image|application)\//i.test(s);

  const detectBloatedColumns = (rows) => {
    const bloated = new Set();
    for (const row of rows) {
      for (const [k, v] of Object.entries(row)) {
        if (bloated.has(k)) continue;
        if (isBase64Anexo(v)) { bloated.add(k); continue; }
        const s = typeof v === "string" ? v : (v && typeof v === "object" && !(v instanceof Date) && typeof v.toDate !== "function" ? JSON.stringify(v) : "");
        if (s.length > MAX_CELL) bloated.add(k);
      }
    }
    return bloated;
  };

  const sanitizeForExcel = (rows) => {
    const bloated = detectBloatedColumns(rows);
    return rows.map((row) => {
      const out = {};
      for (const [k, v] of Object.entries(row)) {
        if (bloated.has(k)) continue; // coluna omitida por completo no Excel
        let cell = v;
        if (v && typeof v === "object" && !(v instanceof Date)) {
          if (typeof v.toDate === "function") cell = v.toDate().toISOString();
          else { try { cell = JSON.stringify(v); } catch { cell = String(v); } }
        } else if (v instanceof Date) cell = v.toISOString();
        if (typeof cell === "string" && cell.length > MAX_CELL) {
          const cut = cell.slice(0, MAX_CELL - 60);
          cell = `${cut}…[truncated: ${cell.length} chars — use JSON backup]`;
        }
        out[k] = cell;
      }
      return out;
    });
  };

  const exportCollection = async (col, format) => {
    setBusyKey(`exp-${col.id}-${format}`, true);
    try {
      const snap = await getDocs(collection(db, col.id));
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const filename = `${col.id}_${new Date().toISOString().slice(0, 10)}`;
      let bytes = 0;
      if (format === "json") {
        const payload = JSON.stringify(rows, null, 2);
        bytes = new Blob([payload]).size;
        downloadBlob(new Blob([payload], { type: "application/json" }), `${filename}.json`);
      } else if (format === "csv") {
        const ws = XLSX.utils.json_to_sheet(sanitizeForExcel(rows));
        const csv = XLSX.utils.sheet_to_csv(ws);
        bytes = new Blob([csv]).size;
        downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${filename}.csv`);
      } else {
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sanitizeForExcel(rows)), col.id.slice(0, 30));
        const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
        bytes = buf.byteLength;
        downloadBlob(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${filename}.xlsx`);
      }
      toast.success(`${col.label}: ${rows.length} registros exportados (${humanBytes(bytes)}).`);
      registerAudit({ action: "export", collectionId: col.id, count: rows.length, sizeBytes: bytes, format });
    } catch (e) {
      toast.error(`Falha ao exportar ${col.label}: ${e.message}`);
    } finally { setBusyKey(`exp-${col.id}-${format}`, false); }
  };

  // Backup completo em UM único .xlsx (uma aba por coleção) e um .json.
  const exportFull = async (format) => {
    setBusyKey(`exp-full-${format}`, true);
    try {
      const bundle = {}; let total = 0;
      for (const c of COLLECTIONS) {
        const snap = await getDocs(collection(db, c.id));
        bundle[c.id] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        total += snap.size;
      }
      const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      let bytes = 0;
      if (format === "json") {
        const payload = JSON.stringify(bundle, null, 2);
        bytes = new Blob([payload]).size;
        downloadBlob(new Blob([payload], { type: "application/json" }), `macro-backup_${stamp}.json`);
      } else {
        const wb = XLSX.utils.book_new();
        for (const [colId, rows] of Object.entries(bundle)) {
          XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sanitizeForExcel(rows)), colId.slice(0, 30));
        }
        const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
        bytes = buf.byteLength;
        downloadBlob(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `macro-backup_${stamp}.xlsx`);
      }
      toast.success(`Backup completo: ${total} registros em ${COLLECTIONS.length} coleções (${humanBytes(bytes)}).`);
      registerAudit({ action: "export", collectionId: null, count: total, sizeBytes: bytes, format, notes: "backup_completo" });
    } catch (e) {
      toast.error("Falha no backup completo: " + e.message);
    } finally { setBusyKey(`exp-full-${format}`, false); }
  };

  // ─────────── Import ───────────
  const importJSON = async (col, file) => {
    if (!file) return;
    setBusyKey(`imp-${col.id}`, true);
    try {
      const text = await file.text();
      const bytes = new Blob([text]).size;
      const parsed = JSON.parse(text);
      const rows = Array.isArray(parsed) ? parsed : parsed[col.id];
      if (!Array.isArray(rows)) throw new Error("JSON não contém array de registros para esta coleção.");
      // Segurança: TODO registro precisa ter `id` para preservar a identidade
      // original do backup. Se algum vier sem, aborta antes de escrever nada
      // — evita ficar com metade importada com IDs regenerados aleatoriamente.
      const semId = rows.filter((r) => !r || !r.id);
      if (semId.length > 0) {
        throw new Error(`${semId.length} registro(s) sem campo "id". Backup/restauração exige que todos os documentos tenham o id original preservado.`);
      }
      // Grava em batches de 400 (limite Firestore é 500). Como `id` é
      // garantido, o doc original é sobrescrito (merge) — restauração 1:1.
      let written = 0;
      for (let i = 0; i < rows.length; i += 400) {
        const batch = writeBatch(db);
        rows.slice(i, i + 400).forEach((r) => {
          const { id, ...rest } = r;
          batch.set(doc(db, col.id, id), rest, { merge: true });
        });
        await batch.commit();
        written += Math.min(400, rows.length - i);
      }
      toast.success(`${col.label}: ${written} registros importados.`);
      registerAudit({ action: "import", collectionId: col.id, count: written, sizeBytes: bytes, format: "json" });
      refreshCounts();
    } catch (e) {
      toast.error("Falha ao importar: " + e.message);
    } finally { setBusyKey(`imp-${col.id}`, false); }
  };

  // ─────────── Reset ───────────
  const resetCollection = async (col) => {
    const ok = window.confirm(`RESETAR "${col.label}"? Todos os ${counts[col.id] ?? "?"} registros serão APAGADOS. Esta ação é irreversível.\n\nDigite OK no próximo prompt para confirmar.`);
    if (!ok) return;
    const confirmText = window.prompt(`Para confirmar o RESET de "${col.label}", digite exatamente: RESETAR ${col.id.toUpperCase()}`);
    if (confirmText !== `RESETAR ${col.id.toUpperCase()}`) {
      toast.error("Confirmação incorreta — reset cancelado.");
      return;
    }
    setBusyKey(`rst-${col.id}`, true);
    try {
      const snap = await getDocs(collection(db, col.id));
      const total = snap.size;
      const docs = snap.docs;
      for (let i = 0; i < docs.length; i += 400) {
        const batch = writeBatch(db);
        docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
      toast.success(`${col.label}: ${total} registros removidos.`);
      registerAudit({ action: "reset", collectionId: col.id, count: total, sizeBytes: 0, format: null, notes: "reset_total" });
      refreshCounts();
    } catch (e) {
      toast.error("Falha no reset: " + e.message);
    } finally { setBusyKey(`rst-${col.id}`, false); }
  };

  // Reset TOTAL — apaga todas as coleções conhecidas de uma vez.
  // Preserva `audit_backups` intacto (a trilha é imutável e precisa registrar
  // o próprio reset). O usuário precisa confirmar 2x + digitar "APAGAR TUDO".
  const resetAll = async () => {
    const totalAtual = Object.values(counts).reduce((a, b) => a + (b > 0 ? b : 0), 0);
    if (!window.confirm(`APAGAR TODAS AS COLEÇÕES?\n\n${COLLECTIONS.length} coleções · ~${totalAtual} registros serão removidos permanentemente. Somente 'audit_backups' será preservado para trilha auditável.\n\nDigite APAGAR TUDO no próximo prompt para confirmar.`)) return;
    const confirmText = window.prompt("Confirmação final. Digite exatamente: APAGAR TUDO");
    if (confirmText !== "APAGAR TUDO") {
      toast.error("Confirmação incorreta — operação cancelada.");
      return;
    }
    setBusyKey("rst-all", true);
    let totalRemovido = 0;
    try {
      for (const col of COLLECTIONS) {
        const snap = await getDocs(collection(db, col.id));
        const docs = snap.docs;
        for (let i = 0; i < docs.length; i += 400) {
          const batch = writeBatch(db);
          docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
          await batch.commit();
        }
        totalRemovido += snap.size;
      }
      toast.success(`Banco resetado: ${totalRemovido} registros removidos em ${COLLECTIONS.length} coleções.`);
      registerAudit({ action: "reset", collectionId: null, count: totalRemovido, sizeBytes: 0, format: null, notes: "reset_banco_completo" });
      refreshCounts();
    } catch (e) {
      toast.error("Falha no reset total: " + e.message);
    } finally { setBusyKey("rst-all", false); }
  };

  if (!canManage) {
    return <div className="p-10 text-center text-sm text-[#4A564F]">Acesso restrito ao Administrador TI.</div>;
  }

  return (
    <div className="px-4 sm:px-8 py-8 max-w-6xl mx-auto" data-testid="page-backup">
      <div className="mb-6">
        <div className="text-[10px] uppercase tracking-[0.25em] text-[#708278] font-bold">TI · Administração</div>
        <h1 className="font-[Outfit,sans-serif] text-3xl font-black tracking-tight text-[#0F1411] mt-1 flex items-center gap-2">
          <Database size={28} weight="duotone" className="text-[#0F2542]" /> Backup & Restauração
        </h1>
        <p className="text-sm text-[#4A564F] mt-1">
          Exportar Firestore em JSON/CSV/Excel, importar de arquivos e resetar coleções.
          Toda operação é registrada em <code>audit_backups</code>.
        </p>
      </div>

      {/* Aviso de ferramenta destrutiva */}
      <div className="bg-[#FEF3C7] border border-[#F59E0B]/40 rounded-md p-4 mb-6 flex gap-3">
        <Warning size={22} weight="duotone" className="text-[#92400E] shrink-0" />
        <div className="text-sm text-[#92400E]">
          <strong>Ferramenta administrativa.</strong> As ações de <em>Importar</em> e <em>Resetar</em> alteram o banco de dados diretamente. Recomendo desativar essa tela em produção.
        </div>
      </div>

      {/* Backup completo */}
      <div className="bg-white border border-[#E2E8E4] rounded-md p-5 mb-6" data-testid="card-backup-full">
        <h3 className="font-[Outfit,sans-serif] text-lg font-black text-[#0F1411] mb-1">Backup completo</h3>
        <p className="text-xs text-[#708278] mb-3">Um único arquivo contendo todas as {COLLECTIONS.length} coleções.</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => exportFull("json")} disabled={busy["exp-full-json"]}
            data-testid="btn-full-json"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-bold uppercase tracking-[0.15em] bg-[#0F2542] text-white hover:bg-[#1E3A5F] disabled:opacity-50">
            <FileText size={14} weight="bold" /> JSON
          </button>
          <button onClick={() => exportFull("xlsx")} disabled={busy["exp-full-xlsx"]}
            data-testid="btn-full-xlsx"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-bold uppercase tracking-[0.15em] bg-[#10B981] text-white hover:bg-[#059669] disabled:opacity-50">
            <FileXls size={14} weight="bold" /> Excel (multi-abas)
          </button>
          <label className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-bold uppercase tracking-[0.15em] bg-[#2563EB] text-white hover:bg-[#1D4ED8] cursor-pointer disabled:opacity-50">
            <Upload size={14} weight="bold" /> Importar backup (JSON)
            <input type="file" accept=".json" className="hidden" data-testid="inp-import-full"
              onChange={(e) => { importFullBundle(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          <button onClick={refreshCounts} disabled={loadingCounts}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-bold uppercase tracking-[0.15em] bg-white border-2 border-[#E2E8E4] text-[#0F2542] hover:border-[#0F2542] disabled:opacity-50">
            <ArrowsClockwise size={14} weight="bold" /> Atualizar contagem
          </button>
          <button onClick={resetAll} disabled={busy["rst-all"]}
            data-testid="btn-reset-all"
            className="ml-auto inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-bold uppercase tracking-[0.15em] bg-[#DC2626] text-white hover:bg-[#B91C1C] disabled:opacity-50">
            <Trash size={14} weight="bold" /> Resetar banco completo
          </button>
        </div>
      </div>

      {/* Grid de coleções */}
      <div className="grid sm:grid-cols-2 gap-3 mb-6">
        {COLLECTIONS.map((c) => (
          <div key={c.id} className="bg-white border border-[#E2E8E4] rounded-md p-4" data-testid={`col-${c.id}`}>
            <div className="flex items-baseline justify-between gap-2 mb-3">
              <div>
                <div className="font-bold text-[#0F2542]">{c.label}</div>
                <div className="text-[11px] font-mono text-[#708278]">{c.id}</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black text-[#0F2542]">{counts[c.id] ?? "…"}</div>
                <div className="text-[10px] uppercase tracking-[0.15em] font-bold text-[#708278]">registros</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => exportCollection(c, "json")} disabled={busy[`exp-${c.id}-json`]}
                data-testid={`btn-${c.id}-json`}
                className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-[0.1em] bg-[#0F2542] text-white hover:bg-[#1E3A5F] disabled:opacity-50">
                <Download size={11} /> JSON
              </button>
              <button onClick={() => exportCollection(c, "csv")} disabled={busy[`exp-${c.id}-csv`]}
                data-testid={`btn-${c.id}-csv`}
                className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-[0.1em] bg-[#4A564F] text-white hover:bg-[#5B6863] disabled:opacity-50">
                <Download size={11} /> CSV
              </button>
              <button onClick={() => exportCollection(c, "xlsx")} disabled={busy[`exp-${c.id}-xlsx`]}
                data-testid={`btn-${c.id}-xlsx`}
                className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-[0.1em] bg-[#10B981] text-white hover:bg-[#059669] disabled:opacity-50">
                <Download size={11} /> XLSX
              </button>
              <label className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-[0.1em] bg-white border border-[#0F2542] text-[#0F2542] cursor-pointer hover:bg-[#F5F7FA]">
                <Upload size={11} /> Importar JSON
                <input type="file" accept=".json" className="hidden" data-testid={`inp-import-${c.id}`}
                  onChange={(e) => { importJSON(c, e.target.files?.[0]); e.target.value = ""; }} />
              </label>
              <button onClick={() => resetCollection(c)} disabled={busy[`rst-${c.id}`]}
                data-testid={`btn-${c.id}-reset`}
                className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-[0.1em] bg-[#DC2626] text-white hover:bg-[#B91C1C] disabled:opacity-50">
                <Trash size={11} /> Reset
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Auditoria */}
      <div className="bg-white border border-[#E2E8E4] rounded-md p-5" data-testid="audit-log">
        <h3 className="font-[Outfit,sans-serif] text-lg font-black text-[#0F1411] mb-3 flex items-center gap-2">
          <ClockCounterClockwise size={20} weight="duotone" className="text-[#0F2542]" /> Auditoria — últimas operações
        </h3>
        {auditLog.length === 0 && (
          <div className="text-xs text-[#708278] italic">Nenhuma operação registrada ainda.</div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-[#E2E8E4]">
              <tr className="text-left text-[10px] uppercase tracking-[0.15em] font-bold text-[#708278]">
                <th className="py-2">Quando</th>
                <th>Quem</th>
                <th>Ação</th>
                <th>Coleção</th>
                <th className="text-right">Registros</th>
                <th className="text-right">Tamanho</th>
                <th>Formato</th>
              </tr>
            </thead>
            <tbody>
              {auditLog.map((r) => (
                <tr key={r.id} className="border-b border-[#E2E8E4] last:border-0">
                  <td className="py-2 whitespace-nowrap">{r.at?.toDate?.().toLocaleString("pt-BR") || "—"}</td>
                  <td>{r.byName || "—"}</td>
                  <td>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-[0.1em] ${r.action === "export" ? "bg-[#10B981]/15 text-[#065F46]" :
                        r.action === "import" ? "bg-[#2563EB]/15 text-[#1E40AF]" :
                          "bg-[#DC2626]/15 text-[#991B1B]"
                      }`}>
                      {r.action === "export" ? <Download size={10} /> : r.action === "import" ? <Upload size={10} /> : <Trash size={10} />}
                      {r.action}
                    </span>
                  </td>
                  <td className="font-mono">{r.collectionId || <em className="text-[#708278]">todas</em>}</td>
                  <td className="text-right font-bold">{r.count}</td>
                  <td className="text-right text-[#708278]">{r.sizeBytes ? humanBytes(r.sizeBytes) : "—"}</td>
                  <td className="uppercase text-[10px] font-bold text-[#708278]">{r.format || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Nota de regras Firestore */}
      <div className="mt-5 bg-[#EFF3F8] border border-[#2563EB]/30 rounded-md p-4 text-[11px] text-[#0F2542]" data-testid="hint-rules">
        <div className="font-bold uppercase tracking-[0.15em] text-[#1E3A5F] mb-1 flex items-center gap-1">
          <Check size={12} weight="bold" /> Regras Firestore recomendadas
        </div>
        <pre className="whitespace-pre-wrap font-mono text-[10px] leading-relaxed">
          {`match /audit_backups/{docId} {
  allow read, create: if request.auth != null &&
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "admin";
  allow update, delete: if false;  // imutável
}`}
        </pre>
      </div>
    </div>
  );
}

/** Helpers */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function humanBytes(n) {
  if (!n) return "0 B";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0; let v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${u[i]}`;
}
