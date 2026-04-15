import type { Recomendacion } from '../types';

interface Props {
  status: Recomendacion;
  size?: 'sm' | 'md';
}

const CONFIG: Record<Recomendacion, { label: string; bg: string; color: string }> = {
  APROBAR: {
    label: 'APROBAR',
    bg: 'var(--success-bg)',
    color: 'var(--success)',
  },
  RECHAZAR: {
    label: 'RECHAZAR',
    bg: 'var(--danger-bg)',
    color: 'var(--danger)',
  },
  ESCALAR: {
    label: 'ESCALAR',
    bg: 'var(--warning-bg)',
    color: 'var(--warning)',
  },
  PENDIENTE: {
    label: 'ANALIZANDO',
    bg: 'var(--surface-muted)',
    color: 'var(--text-muted)',
  },
};

export function StatusBadge({ status, size = 'md' }: Props) {
  const config = CONFIG[status] ?? CONFIG.PENDIENTE;
  const padding = size === 'sm' ? '2px 8px' : '3px 10px';
  return (
    <span
      className="inline-flex items-center rounded-full font-bold tracking-wide"
      style={{
        background: config.bg,
        color: config.color,
        border: '1px solid var(--border)',
        fontSize: size === 'sm' ? '10px' : '11px',
        padding,
        fontFamily: 'IBM Plex Sans, sans-serif',
      }}
    >
      {config.label}
    </span>
  );
}
