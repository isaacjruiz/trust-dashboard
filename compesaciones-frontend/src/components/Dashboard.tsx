import { useState, type ReactNode } from 'react';
import { Download, RefreshCw, ChevronDown, ChevronRight, LayoutList, List, CheckCircle, XCircle, Loader2, AlertTriangle } from 'lucide-react';
import { MetricsBar } from './MetricsBar';
import { CaseTable } from './CaseTable';
import { CaseDetail } from './CaseDetail';
import type { CaseDecision, Metrics } from '../types';
import axios from 'axios';
import toast from 'react-hot-toast';

interface Props {
  cases: CaseDecision[];
  metrics: Metrics | null;
  loading: boolean;
  onAskAgent: (msg: string) => void;
  onRefresh: () => void;
  onDispatch: (caseId: string, decision: 'APROBAR' | 'RECHAZAR') => Promise<void>;
  onDispatchBatch: (caseIds: string[], decision: 'APROBAR' | 'RECHAZAR') => Promise<void>;
}

// ── CollapsibleSection helper ────────────────────────────────
function CollapsibleSection({
  title,
  count,
  defaultOpen,
  color,
  action,
  children,
}: {
  title: string;
  count: number;
  defaultOpen: boolean;
  color: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between py-1">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 text-xs font-bold"
          style={{ color, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          {title}
          <span
            className="px-1.5 py-0.5 rounded-full text-xs font-bold"
            style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, color, fontSize: '10px' }}
          >
            {count}
          </span>
        </button>
        {action}
      </div>
      {open && children}
    </div>
  );
}

// ── BandejaTrabajo ───────────────────────────────────────────
function BandejaTrabajo({
  cases,
  total,
  onSelectCase,
  onAskAgent,
  onDispatch,
  onDispatchBatch,
}: {
  cases: CaseDecision[];
  total: number;
  onSelectCase: (c: CaseDecision) => void;
  onAskAgent: (caseId: string) => void;
  onDispatch: (caseId: string, decision: 'APROBAR' | 'RECHAZAR') => Promise<void>;
  onDispatchBatch: (caseIds: string[], decision: 'APROBAR' | 'RECHAZAR') => Promise<void>;
}) {
  const [batchingAprobar, setBatchingAprobar] = useState(false);
  const [batchingRechazar, setBatchingRechazar] = useState(false);

  const pending = cases.filter((c) => c.decision_manual == null && c.recomendacion !== 'PENDIENTE');
  const escalar = pending.filter((c) => c.recomendacion === 'ESCALAR');
  const aprobar = pending.filter((c) => c.recomendacion === 'APROBAR');
  const rechazar = pending.filter((c) => c.recomendacion === 'RECHAZAR');

  const estimadoMin = Math.round(escalar.length * 0.5 + (aprobar.length + rechazar.length) * 0.05);
  const manualMin = total * 20;
  const ahorro = manualMin > 0 ? Math.round((1 - estimadoMin / manualMin) * 100) : 0;

  const handleBatchAprobar = async () => {
    setBatchingAprobar(true);
    try { await onDispatchBatch(aprobar.map((c) => c.caso_id), 'APROBAR'); }
    finally { setBatchingAprobar(false); }
  };

  const handleBatchRechazar = async () => {
    setBatchingRechazar(true);
    try { await onDispatchBatch(rechazar.map((c) => c.caso_id), 'RECHAZAR'); }
    finally { setBatchingRechazar(false); }
  };

  if (total === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      {/* Value proposition banner */}
      <div
        className="rounded-xl px-4 py-3 flex flex-col gap-1"
        style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}
      >
        <p className="text-xs font-bold" style={{ color: 'var(--text)' }}>
          IA procesó{' '}
          <span style={{ color: 'var(--primary)' }}>{total} casos</span>.
          {' '}Tu trabajo:{' '}
          <span style={{ color: 'var(--warning)' }}>{escalar.length} escalados</span> para revisar
          {' '}+{' '}
          <span style={{ color: 'var(--success)' }}>{aprobar.length + rechazar.length}</span> para confirmar.
        </p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Estimado: ~{estimadoMin} min vs {manualMin.toLocaleString('es-MX')} min manuales
          {ahorro > 0 && (
            <> · <span style={{ color: 'var(--success)', fontWeight: 700 }}>{ahorro}% de ahorro</span></>
          )}
        </p>
      </div>

      {/* ESCALAR section — primary, expanded */}
      {escalar.length > 0 && (
        <CollapsibleSection
          title="Escalados — requieren tu revisión"
          count={escalar.length}
          defaultOpen={true}
          color="var(--warning)"
          action={
            <div className="flex items-center gap-1.5">
              <AlertTriangle size={11} style={{ color: 'var(--warning)' }} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Lee la sugerencia y decide
              </span>
            </div>
          }
        >
          <CaseTable
            cases={escalar}
            loading={false}
            onSelectCase={onSelectCase}
            onAskAgent={onAskAgent}
            onDispatch={onDispatch}
          />
        </CollapsibleSection>
      )}

      {/* APROBAR section — collapsed, with batch button */}
      {aprobar.length > 0 && (
        <CollapsibleSection
          title="Aprobados por IA — confirmar"
          count={aprobar.length}
          defaultOpen={false}
          color="var(--success)"
          action={
            <button
              onClick={handleBatchAprobar}
              disabled={batchingAprobar}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all"
              style={{
                background: 'rgba(34,197,94,0.1)',
                color: 'var(--success)',
                border: '1px solid rgba(34,197,94,0.25)',
                cursor: batchingAprobar ? 'not-allowed' : 'pointer',
                opacity: batchingAprobar ? 0.6 : 1,
              }}
            >
              {batchingAprobar
                ? <><Loader2 size={11} className="animate-spin" /> Confirmando...</>
                : <><CheckCircle size={11} /> Confirmar todos ({aprobar.length})</>
              }
            </button>
          }
        >
          <CaseTable
            cases={aprobar}
            loading={false}
            onSelectCase={onSelectCase}
            onAskAgent={onAskAgent}
            onDispatch={onDispatch}
          />
        </CollapsibleSection>
      )}

      {/* RECHAZAR section — collapsed, with batch button */}
      {rechazar.length > 0 && (
        <CollapsibleSection
          title="Rechazados por IA — confirmar"
          count={rechazar.length}
          defaultOpen={false}
          color="var(--danger)"
          action={
            <button
              onClick={handleBatchRechazar}
              disabled={batchingRechazar}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all"
              style={{
                background: 'rgba(239,68,68,0.1)',
                color: 'var(--danger)',
                border: '1px solid rgba(239,68,68,0.25)',
                cursor: batchingRechazar ? 'not-allowed' : 'pointer',
                opacity: batchingRechazar ? 0.6 : 1,
              }}
            >
              {batchingRechazar
                ? <><Loader2 size={11} className="animate-spin" /> Confirmando...</>
                : <><XCircle size={11} /> Confirmar todos ({rechazar.length})</>
              }
            </button>
          }
        >
          <CaseTable
            cases={rechazar}
            loading={false}
            onSelectCase={onSelectCase}
            onAskAgent={onAskAgent}
            onDispatch={onDispatch}
          />
        </CollapsibleSection>
      )}
    </div>
  );
}

// ── Main Dashboard ───────────────────────────────────────────
export function Dashboard({ cases, metrics, loading, onAskAgent, onRefresh, onDispatch, onDispatchBatch }: Props) {
  const [selectedCase, setSelectedCase] = useState<CaseDecision | null>(null);
  const [view, setView] = useState<'bandeja' | 'tabla'>('bandeja');

  const handleReanalyze = async (caseId: string, info: string) => {
    try {
      const res = await axios.post<{ recomendacion_nueva: string }>('/agent/chat', {
        message: `Reanaliza el caso ${caseId} con esta nueva información: ${info}`,
      });
      onRefresh();
      toast.success(`Caso ${caseId} reanalizado`);
      if (res.data.recomendacion_nueva) {
        onAskAgent(`Reanalicé ${caseId}: ${res.data.recomendacion_nueva}`);
      }
    } catch {
      toast.error('Error al reanalizar el caso');
    }
  };

  const handleExport = () => {
    window.open('/export/csv', '_blank');
  };

  return (
    <div className="flex flex-col">
      {/* Dashboard header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2
            className="text-sm font-bold leading-tight"
            style={{ color: 'var(--text)' }}
          >
            {view === 'bandeja' ? 'Bandeja de trabajo' : 'Panel de Casos'}
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {view === 'bandeja' ? 'IA procesó los casos — confirma o revisa' : 'Análisis automatizado de compensaciones'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setView((v) => v === 'bandeja' ? 'tabla' : 'bandeja')}
            className="action-button flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold"
            title={view === 'bandeja' ? 'Cambiar a vista de tabla completa' : 'Cambiar a bandeja de trabajo'}
          >
            {view === 'bandeja' ? <List size={11} /> : <LayoutList size={11} />}
            {view === 'bandeja' ? 'Vista tabla' : 'Bandeja'}
          </button>
          <button
            onClick={onRefresh}
            className="action-button flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold"
          >
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> Actualizar
          </button>
          {cases.length > 0 && (
            <button
              onClick={handleExport}
              className="action-button flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold"
            >
              <Download size={11} /> Exportar CSV
            </button>
          )}
        </div>
      </div>

      {/* Metrics */}
      <MetricsBar metrics={metrics} loading={loading && cases.length === 0} />

      {/* View: Bandeja or Tabla */}
      <div className="mt-4">
        {view === 'bandeja' ? (
          <BandejaTrabajo
            cases={cases.filter((c) => c.decision_manual == null)}
            total={cases.length}
            onSelectCase={setSelectedCase}
            onAskAgent={(caseId) => onAskAgent(`Analiza el caso ${caseId}`)}
            onDispatch={onDispatch}
            onDispatchBatch={onDispatchBatch}
          />
        ) : (
          <CaseTable
            cases={cases}
            loading={loading && cases.length === 0}
            onSelectCase={setSelectedCase}
            onAskAgent={(caseId) => onAskAgent(`Analiza el caso ${caseId}`)}
            onDispatch={onDispatch}
          />
        )}
      </div>

      {/* Case Detail slide-over */}
      {selectedCase && (
        <CaseDetail
          case_={selectedCase}
          onClose={() => setSelectedCase(null)}
          onReanalyze={handleReanalyze}
          onDispatch={async (caseId, decision) => {
            await onDispatch(caseId, decision);
            setSelectedCase(null);
          }}
        />
      )}
    </div>
  );
}
