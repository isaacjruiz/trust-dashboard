import { useState, Fragment, type ReactNode } from 'react';
import { Search, ChevronUp, ChevronDown, CheckCircle, XCircle } from 'lucide-react';
import { InfoTooltip } from './InfoTooltip';
import type { CaseDecision } from '../types';
import { StatusBadge } from './StatusBadge';

interface Props {
  cases: CaseDecision[];
  loading: boolean;
  onSelectCase: (c: CaseDecision) => void;
  onAskAgent: (caseId: string) => void;
  onDispatch: (caseId: string, decision: 'APROBAR' | 'RECHAZAR') => Promise<void>;
}

type SortKey = 'risk_score' | 'caso_id' | 'compensacion_solicitada_mxn' | 'antiguedad_usuario_dias';

const STATUS_TABS: { label: string; value: string }[] = [
  { label: 'Todos', value: 'TODOS' },
  { label: 'Aprobar', value: 'APROBAR' },
  { label: 'Rechazar', value: 'RECHAZAR' },
  { label: 'Escalar', value: 'ESCALAR' },
  { label: 'Analizando', value: 'PENDIENTE' },
];

const TAB_COLORS: Record<string, { active: string; dot: string }> = {
  TODOS: { active: 'var(--primary)', dot: 'var(--primary)' },
  APROBAR: { active: 'var(--success)', dot: 'var(--success)' },
  RECHAZAR: { active: 'var(--danger)', dot: 'var(--danger)' },
  ESCALAR: { active: 'var(--warning)', dot: 'var(--warning)' },
  PENDIENTE: { active: 'var(--text-muted)', dot: 'var(--text-muted)' },
};

const headerCellStyle = {
  color: 'var(--text-muted)',
  fontSize: '10px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
} as const;

function ThInfo({ label, tooltip }: { label: string; tooltip: string }) {
  return <InfoTooltip text={tooltip} iconSize={10}>{label}</InfoTooltip>;
}

function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 70 ? 'var(--danger)' : score >= 30 ? 'var(--warning)' : 'var(--success)';
  return (
    <div className="flex items-center gap-2">
      <div
        className="flex-1 rounded-full"
        style={{
          height: '6px',
          background: 'var(--surface-muted)',
          border: '1px solid var(--border)',
        }}
      >
        <div
          className="rounded-full h-full transition-all"
          style={{ width: `${score}%`, background: color }}
        />
      </div>
      <span
        className="text-xs w-8 text-right shrink-0"
        style={{ color: 'var(--text)', fontFamily: 'IBM Plex Sans, sans-serif' }}
      >
        {score}
      </span>
    </div>
  );
}

export function CaseTable({ cases, loading, onSelectCase, onAskAgent, onDispatch }: Props) {
  const [dispatching, setDispatching] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('risk_score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  };

  const filtered = cases
    .filter((c) => {
      // Hide dispatched cases from Revisión — they live in Despacho tab
      if (c.decision_manual != null) return false;
      if (statusFilter !== 'TODOS' && c.recomendacion !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          c.caso_id.toLowerCase().includes(q) ||
          c.usuario_id.toLowerCase().includes(q) ||
          c.restaurante.toLowerCase().includes(q) ||
          c.motivo_reclamo.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      const av = a[sortKey] as number | string;
      const bv = b[sortKey] as number | string;
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });

  const renderSortIcon = (k: SortKey) => {
    if (sortKey !== k) return <ChevronUp size={11} style={{ color: 'var(--shadow-dark)' }} />;
    return sortDir === 'asc'
      ? <ChevronUp size={11} style={{ color: 'var(--primary)' }} />
      : <ChevronDown size={11} style={{ color: 'var(--primary)' }} />;
  };

  const renderThSort = (k: SortKey, children: ReactNode) => (
    <th
      className="px-3 py-2.5 text-left select-none cursor-pointer"
      style={headerCellStyle}
      onClick={() => handleSort(k)}
    >
      <span className="flex items-center gap-1">{children}{renderSortIcon(k)}</span>
    </th>
  );

  const renderTh = (children: ReactNode) => (
    <th
      className="px-3 py-2.5 text-left"
      style={headerCellStyle}
    >
      {children}
    </th>
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Filters row */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Status tabs */}
        <div
          className="control-surface flex p-1 gap-1"
        >
          {STATUS_TABS.map((tab) => {
            const isActive = statusFilter === tab.value;
            const tc = TAB_COLORS[tab.value];
            return (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all"
                style={{
                  background: isActive ? tc.active : 'transparent',
                  color: isActive ? '#fff' : 'var(--text-muted)',
                  boxShadow: isActive ? 'var(--small-shadow)' : 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {tab.value !== 'TODOS' && (
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: isActive ? '#ffffff88' : tc.dot }}
                  />
                )}
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-44">
          <Search
            size={12}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--text-muted)' }}
          />
          <input
            type="text"
            placeholder="Buscar ID, usuario, restaurante..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-surface w-full pl-8 pr-3 py-2 text-xs outline-none transition-all"
          />
        </div>

        <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
          {filtered.length} casos
        </span>
      </div>

      {/* Table */}
      <div
        className="table-shell overflow-auto"
      >
        <table className="w-full text-xs" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
            <tr
              style={{
                background: 'var(--surface-solid)',
                boxShadow: '0 1px 0 var(--border)',
              }}
            >
              {renderThSort('caso_id', 'ID')}
              {renderTh('Ciudad')}
              {renderTh('Motivo')}
              {renderThSort('compensacion_solicitada_mxn',
                <ThInfo label="Monto" tooltip="Compensación solicitada por el usuario en MXN" />
              )}
              {renderThSort('risk_score',
                <ThInfo label="Score" tooltip="Riesgo de fraude: 0–100. >70 alto (rojo), 30–70 medio (amarillo), <30 bajo (verde)" />
              )}
              {renderTh(<ThInfo label="Rec." tooltip="Recomendación del agente IA: APROBAR (compensar), RECHAZAR (denegar), ESCALAR (revisión humana)" />)}
              {renderTh(<ThInfo label="Conf." tooltip="Confianza del modelo en su decisión. ALTA = caso claro, MEDIA = algo de ambigüedad, BAJA = caso borderline" />)}
              {renderTh('Acción')}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j} className="px-3 py-3">
                      <div
                        className="h-3 rounded-lg animate-pulse"
                        style={{ background: 'var(--surface-muted)' }}
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-14 text-center" style={{ color: 'var(--text-muted)' }}>
                  {cases.length === 0
                    ? 'No hay casos cargados. Usa "Cargar datos" para comenzar.'
                    : 'No hay casos que coincidan con los filtros.'}
                </td>
              </tr>
            ) : (
              filtered.map((c, idx) => (
                <Fragment key={c.caso_id}>
                  <tr
                    className="table-row-hover cursor-pointer transition-all"
                    style={{
                      borderTop: idx > 0 ? '1px solid var(--border)' : 'none',
                      background: c.recomendacion === 'PENDIENTE' ? 'var(--surface-muted)' : undefined,
                    }}
                    onClick={() => onSelectCase(c)}
                  >
                    <td className="px-3 py-2.5">
                      <span
                        className="font-bold text-xs"
                        style={{ color: 'var(--primary)', fontFamily: 'IBM Plex Sans, sans-serif' }}
                      >
                        {c.caso_id}
                      </span>
                    </td>
                    <td className="px-3 py-2.5" style={{ color: 'var(--text)' }}>
                      {c.ciudad}
                    </td>
                    <td
                      className="px-3 py-2.5 max-w-32 truncate"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {c.motivo_reclamo}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className="font-bold"
                        style={{ color: 'var(--text)', fontFamily: 'IBM Plex Sans, sans-serif' }}
                      >
                        ${c.compensacion_solicitada_mxn}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 w-28">
                      {c.recomendacion === 'PENDIENTE' ? (
                        <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
                          Analizando
                        </span>
                      ) : (
                        <ScoreBar score={c.risk_score} />
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={c.recomendacion} size="sm" />
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className="text-xs font-bold"
                        style={{
                          color:
                            c.confianza === 'ALTA'
                              ? 'var(--success)'
                              : c.confianza === 'MEDIA'
                              ? 'var(--warning)'
                              : 'var(--text-light)',
                          fontFamily: 'IBM Plex Sans, sans-serif',
                        }}
                      >
                        {c.recomendacion === 'PENDIENTE' ? '-' : c.confianza}
                      </span>
                    </td>
                    <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        {c.decision_manual ? (
                          /* Already dispatched — show badge */
                          <span
                            className="text-xs font-bold px-2 py-1 rounded-lg flex items-center gap-1"
                            style={{
                              color: c.decision_manual === 'APROBAR' ? 'var(--success)' : 'var(--danger)',
                              background: c.decision_manual === 'APROBAR' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                              border: `1px solid ${c.decision_manual === 'APROBAR' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
                            }}
                          >
                            {c.decision_manual === 'APROBAR' ? <CheckCircle size={11} /> : <XCircle size={11} />}
                            {c.decision_manual}
                          </span>
                        ) : c.recomendacion !== 'PENDIENTE' ? (
                          /* Action buttons */
                          <>
                            <button
                              disabled={dispatching === c.caso_id}
                              onClick={async () => {
                                setDispatching(c.caso_id);
                                try { await onDispatch(c.caso_id, 'APROBAR'); } finally { setDispatching(null); }
                              }}
                              className="flex items-center gap-0.5 text-xs font-bold rounded-lg px-2 py-1 transition-all"
                              style={{
                                color: 'var(--success)',
                                background: 'rgba(34,197,94,0.08)',
                                border: '1px solid rgba(34,197,94,0.2)',
                                cursor: 'pointer',
                                opacity: dispatching === c.caso_id ? 0.5 : 1,
                              }}
                              title="Aprobar"
                            >
                              <CheckCircle size={11} />
                            </button>
                            <button
                              disabled={dispatching === c.caso_id}
                              onClick={async () => {
                                setDispatching(c.caso_id);
                                try { await onDispatch(c.caso_id, 'RECHAZAR'); } finally { setDispatching(null); }
                              }}
                              className="flex items-center gap-0.5 text-xs font-bold rounded-lg px-2 py-1 transition-all"
                              style={{
                                color: 'var(--danger)',
                                background: 'rgba(239,68,68,0.08)',
                                border: '1px solid rgba(239,68,68,0.2)',
                                cursor: 'pointer',
                                opacity: dispatching === c.caso_id ? 0.5 : 1,
                              }}
                              title="Rechazar"
                            >
                              <XCircle size={11} />
                            </button>
                            <button
                              onClick={() => onAskAgent(c.caso_id)}
                              className="text-xs font-bold rounded-lg px-2 py-1 transition-all"
                              style={{
                                color: 'var(--primary)',
                                background: 'var(--primary-light)',
                                border: '1px solid var(--border)',
                                cursor: 'pointer',
                              }}
                            >
                              ?
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>

                  {/* Inline action hint for ESCALAR cases with accion_sugerida */}
                  {c.recomendacion === 'ESCALAR' && c.accion_sugerida && (
                    <tr style={{ borderTop: 'none' }}>
                      <td
                        colSpan={8}
                        className="px-3 pb-2"
                        style={{ background: 'rgba(245,158,11,0.03)' }}
                        onClick={() => onSelectCase(c)}
                      >
                        <div
                          className="flex items-start gap-2 text-xs px-3 py-1.5 rounded-lg cursor-pointer"
                          style={{
                            background: 'rgba(245,158,11,0.07)',
                            border: '1px solid rgba(245,158,11,0.18)',
                          }}
                        >
                          <span style={{ color: 'var(--warning)', flexShrink: 0, marginTop: '1px' }}>▸</span>
                          <span style={{ color: 'var(--text-muted)' }}>
                            <strong style={{ color: 'var(--warning)' }}>Verificar:</strong>{' '}
                            {c.accion_sugerida}
                          </span>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
