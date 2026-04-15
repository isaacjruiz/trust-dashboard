import type { CaseDecision } from '../types';
import { CheckCircle, XCircle, Bot, User } from 'lucide-react';

interface Props {
  cases: CaseDecision[];
}

const DECISION_STYLE: Record<string, { color: string; bg: string; border: string; icon: React.ReactNode }> = {
  APROBAR: {
    color: 'var(--success)',
    bg: 'rgba(34,197,94,0.08)',
    border: 'rgba(34,197,94,0.25)',
    icon: <CheckCircle size={13} />,
  },
  RECHAZAR: {
    color: 'var(--danger)',
    bg: 'rgba(239,68,68,0.08)',
    border: 'rgba(239,68,68,0.25)',
    icon: <XCircle size={13} />,
  },
};

function formatDate(iso?: string | null) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('es-MX', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export function DespachoPanel({ cases }: Props) {
  const dispatched = cases.filter((c) => c.decision_manual != null);

  const aprobados = dispatched.filter((c) => c.decision_manual === 'APROBAR');
  const rechazados = dispatched.filter((c) => c.decision_manual === 'RECHAZAR');
  const montoAprobado = aprobados.reduce((s, c) => s + c.compensacion_solicitada_mxn, 0);
  const montoRechazado = rechazados.reduce((s, c) => s + c.compensacion_solicitada_mxn, 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold" style={{ color: 'var(--text)' }}>Despacho</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Decisiones confirmadas por agente
          </p>
        </div>
        <div className="flex gap-3">
          <div
            className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5"
            style={{ background: 'rgba(34,197,94,0.1)', color: 'var(--success)', border: '1px solid rgba(34,197,94,0.2)' }}
          >
            <CheckCircle size={12} />
            {aprobados.length} aprobados · ${montoAprobado.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
          </div>
          <div
            className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5"
            style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.2)' }}
          >
            <XCircle size={12} />
            {rechazados.length} rechazados · ${montoRechazado.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>

      {/* Table */}
      {dispatched.length === 0 ? (
        <div
          className="rounded-2xl flex flex-col items-center justify-center py-20 gap-3"
          style={{ border: '1px dashed var(--border)', background: 'var(--surface)' }}
        >
          <CheckCircle size={32} style={{ color: 'var(--text-light)' }} />
          <p className="text-sm font-bold" style={{ color: 'var(--text-muted)' }}>Sin casos despachados aún</p>
          <p className="text-xs text-center max-w-xs" style={{ color: 'var(--text-light)' }}>
            Aprueba o rechaza casos desde la tabla de revisión o pídeselo al agente en el chat.
          </p>
        </div>
      ) : (
        <div className="table-shell overflow-auto">
          <table className="w-full text-xs" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
              <tr style={{ background: 'var(--surface-solid)', boxShadow: '0 1px 0 var(--border)' }}>
                {['ID', 'Ciudad', 'Motivo', 'Monto', 'Rec. IA', 'Decisión', 'Por', 'Fecha'].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2.5 text-left"
                    style={{ color: 'var(--text-muted)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dispatched.map((c, idx) => {
                const ds = DECISION_STYLE[c.decision_manual!];
                return (
                  <tr
                    key={c.caso_id}
                    style={{ borderTop: idx > 0 ? '1px solid var(--border)' : 'none' }}
                  >
                    <td className="px-3 py-2.5">
                      <span className="font-bold" style={{ color: 'var(--primary)', fontFamily: 'IBM Plex Sans, sans-serif' }}>
                        {c.caso_id}
                      </span>
                    </td>
                    <td className="px-3 py-2.5" style={{ color: 'var(--text)' }}>{c.ciudad}</td>
                    <td className="px-3 py-2.5 max-w-32 truncate" style={{ color: 'var(--text-muted)' }}>
                      {c.motivo_reclamo}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-bold" style={{ color: 'var(--text)', fontFamily: 'IBM Plex Sans, sans-serif' }}>
                        ${c.compensacion_solicitada_mxn}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded-lg"
                        style={{
                          color: c.recomendacion === 'APROBAR' ? 'var(--success)' : c.recomendacion === 'RECHAZAR' ? 'var(--danger)' : 'var(--warning)',
                          background: c.recomendacion === 'APROBAR' ? 'rgba(34,197,94,0.08)' : c.recomendacion === 'RECHAZAR' ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)',
                        }}
                      >
                        {c.recomendacion}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg w-fit"
                        style={{ color: ds.color, background: ds.bg, border: `1px solid ${ds.border}` }}
                      >
                        {ds.icon}
                        {c.decision_manual}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className="flex items-center gap-1 text-xs"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {c.despachado_por === 'CHAT' ? <Bot size={11} /> : <User size={11} />}
                        {c.despachado_por === 'CHAT' ? 'Chat' : 'Agente'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5" style={{ color: 'var(--text-light)', whiteSpace: 'nowrap' }}>
                      {formatDate(c.despachado_en)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
