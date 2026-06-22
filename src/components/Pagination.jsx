// =============================================================================
// components/Pagination.jsx — Paginação reutilizável para listas
// -----------------------------------------------------------------------------
// Uso:
//
//   const { page, setPage, perPage, setPerPage, paged, totalPages } =
//     usePagination(items, { defaultPerPage: 50 });
//
//   {paged.map(...)}
//   <Pagination
//     page={page} setPage={setPage}
//     perPage={perPage} setPerPage={setPerPage}
//     total={items.length} totalPages={totalPages}
//   />
//
// Opções de tamanho de página: 10, 20, 50, 100, TODOS.
// =============================================================================

import { useEffect, useMemo, useState } from "react";
import { CaretLeft, CaretRight, CaretDoubleLeft, CaretDoubleRight } from "@phosphor-icons/react";

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100, "all"];

/**
 * Hook que pagina uma lista em memória.
 * @param {Array} items lista completa
 * @param {{defaultPerPage?: number|"all"}} opts
 */
export function usePagination(items, { defaultPerPage = 10 } = {}) {
  const [perPage, setPerPage] = useState(defaultPerPage);
  const [page, setPage] = useState(1);
  const total = items?.length || 0;

  const totalPages = useMemo(() => {
    if (perPage === "all") return 1;
    return Math.max(1, Math.ceil(total / perPage));
  }, [total, perPage]);

  // Reseta para a página 1 quando o tamanho mudar ou se a página atual
  // ultrapassar o total (ex.: usuário filtrou e ficou com menos itens).
  useEffect(() => { setPage(1); }, [perPage]);
  useEffect(() => { if (page > totalPages) setPage(1); }, [page, totalPages]);

  const paged = useMemo(() => {
    if (perPage === "all") return items;
    const start = (page - 1) * perPage;
    return (items || []).slice(start, start + perPage);
  }, [items, page, perPage]);

  return { page, setPage, perPage, setPerPage, paged, total, totalPages };
}

/**
 * Componente visual de paginação.
 */
export default function Pagination({ page, setPage, perPage, setPerPage, total, totalPages, testid = "pagination" }) {
  if (!total) return null;
  const from = perPage === "all" ? 1 : (page - 1) * perPage + 1;
  const to = perPage === "all" ? total : Math.min(page * perPage, total);

  return (
    <div data-testid={testid} className="mt-6 flex flex-wrap items-center justify-between gap-3 text-xs">
      <div className="flex items-center gap-2 text-[#4A564F]">
        <span>Mostrando <b className="text-[#0F2542]">{from}</b>–<b className="text-[#0F2542]">{to}</b> de <b className="text-[#0F2542]">{total}</b></span>
        <span className="text-[#708278]">·</span>
        <label className="flex items-center gap-1.5">
          <span className="uppercase tracking-[0.1em] font-bold text-[#708278]">Por página</span>
          <select
            data-testid={`${testid}-perpage`}
            value={String(perPage)}
            onChange={(e) => setPerPage(e.target.value === "all" ? "all" : Number(e.target.value))}
            className="border border-[#E2E8E4] rounded px-2 py-1 text-xs font-bold focus:outline-none focus:border-[#2563EB]"
          >
            {PAGE_SIZE_OPTIONS.map((opt) => (
              <option key={opt} value={String(opt)}>{opt === "all" ? "TODOS" : opt}</option>
            ))}
          </select>
        </label>
        {perPage === "all" && total > 100 && (
          <span className="text-[10px] text-[#8B5E2B] italic">⚠ TODOS pode ficar lento em listas grandes.</span>
        )}
      </div>

      {perPage !== "all" && totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            data-testid={`${testid}-first`}
            onClick={() => setPage(1)}
            disabled={page === 1}
            className="p-1.5 rounded border border-[#E2E8E4] text-[#4A564F] hover:bg-[#F5F7FA] disabled:opacity-40 disabled:cursor-not-allowed"
            title="Primeira"
          >
            <CaretDoubleLeft size={14} />
          </button>
          <button
            data-testid={`${testid}-prev`}
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="p-1.5 rounded border border-[#E2E8E4] text-[#4A564F] hover:bg-[#F5F7FA] disabled:opacity-40 disabled:cursor-not-allowed"
            title="Anterior"
          >
            <CaretLeft size={14} />
          </button>
          <span className="px-3 py-1 border border-[#1E3A5F] bg-[#1E3A5F] text-white rounded font-bold">
            {page} <span className="opacity-70 font-normal">/ {totalPages}</span>
          </span>
          <button
            data-testid={`${testid}-next`}
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="p-1.5 rounded border border-[#E2E8E4] text-[#4A564F] hover:bg-[#F5F7FA] disabled:opacity-40 disabled:cursor-not-allowed"
            title="Próxima"
          >
            <CaretRight size={14} />
          </button>
          <button
            data-testid={`${testid}-last`}
            onClick={() => setPage(totalPages)}
            disabled={page === totalPages}
            className="p-1.5 rounded border border-[#E2E8E4] text-[#4A564F] hover:bg-[#F5F7FA] disabled:opacity-40 disabled:cursor-not-allowed"
            title="Última"
          >
            <CaretDoubleRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
