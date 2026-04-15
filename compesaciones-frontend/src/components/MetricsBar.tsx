import { TrendingUp, CheckCircle, XCircle, AlertCircle, DollarSign, Activity } from 'lucide-react';
import type { Metrics } from '../types';
import { InfoTooltip } from './InfoTooltip';

interface Props {
  metrics: Metrics | null;
  loading?: boolean;
}

function StatCard({
  icon: Icon,
  label,
  tooltip,
  value,
  sub,
  iconBg,
  iconColor,
}: {
  icon: typeof TrendingUp;
  label: string;
  tooltip: string;
  value: string | number;
  sub?: string;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div
      className="metric-card p-4 grid gap-3"
      style={{ gridTemplateColumns: '44px minmax(0, 1fr)' }}
    >
      <div
        className="metric-icon rounded-xl shrink-0 flex items-center justify-center"
        style={{ background: iconBg, border: '1px solid var(--border)' }}
      >
        <Icon size={15} style={{ color: iconColor }} />
      </div>
      <div className="min-w-0">
        <div
          className="metric-label text-xs font-bold uppercase flex items-center gap-1"
          style={{ color: 'var(--text-muted)' }}
        >
          <InfoTooltip text={tooltip}>{label}</InfoTooltip>
        </div>
        <div
          className="text-xl font-bold leading-tight"
          style={{ color: 'var(--text)', fontFamily: 'IBM Plex Sans, sans-serif' }}
        >
          {value}
        </div>
        {sub && (
          <div className="metric-sub text-xs" style={{ color: 'var(--text-light)' }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}

export function MetricsBar({ metrics, loading }: Props) {
  if (!metrics || loading) {
    return (
      <div className="metrics-grid mb-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="metric-card p-4 animate-pulse h-20" />
        ))}
      </div>
    );
  }

  const mxn = (n: number) =>
    n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n}`;

  const pct = (n: number) =>
    metrics.total > 0 ? `${((n / metrics.total) * 100).toFixed(0)}% del total` : '0% del total';

  return (
    <div className="metrics-grid mb-4">
      <StatCard
        icon={Activity}
        label="Total"
        tooltip="Total de casos cargados. Incluye todos los estados: pendientes de análisis, aprobados, rechazados y escalados."
        value={metrics.total}
        sub={metrics.por_status.PENDIENTE > 0 ? `${metrics.por_status.PENDIENTE} analizando` : 'casos en memoria'}
        iconBg="var(--surface-muted)"
        iconColor="var(--text)"
      />
      <StatCard
        icon={CheckCircle}
        label="Aprobar"
        tooltip="Casos donde el agente IA recomienda emitir la compensación. El reclamo es legítimo: GPS confirmado, sin historial de abuso, monto razonable."
        value={metrics.por_status.APROBAR}
        sub={pct(metrics.por_status.APROBAR)}
        iconBg="var(--success-bg)"
        iconColor="var(--success)"
      />
      <StatCard
        icon={XCircle}
        label="Rechazar"
        tooltip="Casos con señales claras de fraude o abuso sistemático: historial excesivo de compensaciones, GPS sin confirmar, múltiples flags de fraude."
        value={metrics.por_status.RECHAZAR}
        sub={pct(metrics.por_status.RECHAZAR)}
        iconBg="var(--danger-bg)"
        iconColor="var(--danger)"
      />
      <StatCard
        icon={AlertCircle}
        label="Escalar"
        tooltip="Casos ambiguos que necesitan revisión humana. El modelo detectó señales contradictorias y no puede decidir con certeza suficiente."
        value={metrics.por_status.ESCALAR}
        sub={pct(metrics.por_status.ESCALAR)}
        iconBg="var(--warning-bg)"
        iconColor="var(--warning)"
      />
      <StatCard
        icon={TrendingUp}
        label="Score prom."
        tooltip="Promedio del score de riesgo (0–100) de todos los casos analizados. Un promedio alto indica una cartera con muchos reclamos sospechosos."
        value={`${metrics.risk_score_promedio}/100`}
        sub="riesgo promedio"
        iconBg="var(--primary-light)"
        iconColor="var(--primary)"
      />
      <StatCard
        icon={DollarSign}
        label="En riesgo"
        tooltip="Suma total de compensaciones solicitadas en todos los casos. 'Bloqueado' = monto acumulado de los casos recomendados RECHAZAR que aún no se han pagado."
        value={mxn(metrics.monto_total_en_riesgo)}
        sub={`${mxn(metrics.monto_rechazado)} bloqueado`}
        iconBg="var(--warning-bg)"
        iconColor="var(--warning)"
      />
    </div>
  );
}
