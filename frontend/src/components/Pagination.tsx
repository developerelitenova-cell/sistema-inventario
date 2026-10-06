import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  className = '',
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const startItem = totalItems === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const endItem = Math.min(safeCurrentPage * pageSize, totalItems);

  // Generar páginas a mostrar con elipsis (...)
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (safeCurrentPage <= 4) {
        pages.push(1, 2, 3, 4, 5, '...', totalPages);
      } else if (safeCurrentPage >= totalPages - 3) {
        pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', safeCurrentPage - 1, safeCurrentPage, safeCurrentPage + 1, '...', totalPages);
      }
    }
    return pages;
  };

  if (totalItems <= 0) return null;

  return (
    <div
      className={`pagination-container ${className}`}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        padding: '14px 18px',
        background: 'rgba(255, 255, 255, 0.03)',
        borderRadius: '12px',
        border: '1px solid var(--border)',
        marginTop: '16px',
        fontSize: '0.875rem',
      }}
    >
      {/* Información del rango y selector de tamaño */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--text-secondary)' }}>
          Mostrando <strong style={{ color: 'var(--text-primary)' }}>{startItem}</strong> -{' '}
          <strong style={{ color: 'var(--text-primary)' }}>{endItem}</strong> de{' '}
          <strong style={{ color: 'var(--text-primary)' }}>{totalItems}</strong> registros
        </span>

        {onPageSizeChange && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Por página:</span>
            <select
              className="input-field"
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value));
                onPageChange(1);
              }}
              style={{
                padding: '4px 8px',
                height: '32px',
                width: 'auto',
                fontSize: '0.8rem',
                borderRadius: '8px',
              }}
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Botones de navegación de página */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {/* Ir al inicio */}
        <button
          className="btn btn-outline"
          disabled={safeCurrentPage === 1}
          onClick={() => onPageChange(1)}
          style={{
            padding: '6px',
            height: '32px',
            width: '32px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '8px',
            opacity: safeCurrentPage === 1 ? 0.4 : 1,
            cursor: safeCurrentPage === 1 ? 'not-allowed' : 'pointer',
          }}
          title="Primera página"
        >
          <ChevronsLeft size={16} />
        </button>

        {/* Anterior */}
        <button
          className="btn btn-outline"
          disabled={safeCurrentPage === 1}
          onClick={() => onPageChange(safeCurrentPage - 1)}
          style={{
            padding: '6px',
            height: '32px',
            width: '32px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '8px',
            opacity: safeCurrentPage === 1 ? 0.4 : 1,
            cursor: safeCurrentPage === 1 ? 'not-allowed' : 'pointer',
          }}
          title="Página anterior"
        >
          <ChevronLeft size={16} />
        </button>

        {/* Páginas numeradas */}
        {getPageNumbers().map((p, idx) => {
          if (p === '...') {
            return (
              <span
                key={`ellipsis-${idx}`}
                style={{
                  padding: '0 6px',
                  color: 'var(--text-secondary)',
                  userSelect: 'none',
                }}
              >
                ...
              </span>
            );
          }
          const isCurrent = p === safeCurrentPage;
          return (
            <button
              key={`page-${p}`}
              className={`btn ${isCurrent ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => onPageChange(Number(p))}
              style={{
                padding: '4px 10px',
                height: '32px',
                minWidth: '32px',
                fontSize: '0.8rem',
                fontWeight: isCurrent ? 700 : 500,
                borderRadius: '8px',
              }}
            >
              {p}
            </button>
          );
        })}

        {/* Siguiente */}
        <button
          className="btn btn-outline"
          disabled={safeCurrentPage === totalPages}
          onClick={() => onPageChange(safeCurrentPage + 1)}
          style={{
            padding: '6px',
            height: '32px',
            width: '32px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '8px',
            opacity: safeCurrentPage === totalPages ? 0.4 : 1,
            cursor: safeCurrentPage === totalPages ? 'not-allowed' : 'pointer',
          }}
          title="Página siguiente"
        >
          <ChevronRight size={16} />
        </button>

        {/* Ir al final */}
        <button
          className="btn btn-outline"
          disabled={safeCurrentPage === totalPages}
          onClick={() => onPageChange(totalPages)}
          style={{
            padding: '6px',
            height: '32px',
            width: '32px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '8px',
            opacity: safeCurrentPage === totalPages ? 0.4 : 1,
            cursor: safeCurrentPage === totalPages ? 'not-allowed' : 'pointer',
          }}
          title="Última página"
        >
          <ChevronsRight size={16} />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
