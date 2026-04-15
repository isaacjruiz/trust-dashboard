import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { caseStore } from '../../data/store.js';

export const generateReportTool = createTool({
  id: 'generate-report',
  description: 'Genera un reporte ejecutivo para supervisor con resumen de casos procesados, patrones detectados y recomendaciones operativas.',
  inputSchema: z.object({
    format: z.enum(['resumen', 'detallado']).optional().default('resumen'),
  }),
  outputSchema: z.object({
    reporte: z.string(),
  }),
  execute: async (inputData) => {
    const { format } = inputData;
    const metrics = caseStore.getMetrics();
    const rechazados = caseStore.getByStatus('RECHAZAR', 5);
    const escalados = caseStore.getByStatus('ESCALAR', 5);

    const pctRechazar = metrics.total > 0
      ? ((metrics.por_status.RECHAZAR / metrics.total) * 100).toFixed(1)
      : '0';
    const pctAprobar = metrics.total > 0
      ? ((metrics.por_status.APROBAR / metrics.total) * 100).toFixed(1)
      : '0';
    const pctEscalar = metrics.total > 0
      ? ((metrics.por_status.ESCALAR / metrics.total) * 100).toFixed(1)
      : '0';

    const fecha = new Date().toLocaleDateString('es-MX', {
      year: 'numeric', month: 'long', day: 'numeric',
    });

    let reporte = `═══════════════════════════════════════════
REPORTE EJECUTIVO — TRUST & SAFETY
${fecha}
═══════════════════════════════════════════

RESUMEN GENERAL
───────────────
Total casos procesados: ${metrics.total}
├── APROBAR:  ${metrics.por_status.APROBAR} casos (${pctAprobar}%)
├── RECHAZAR: ${metrics.por_status.RECHAZAR} casos (${pctRechazar}%)
└── ESCALAR:  ${metrics.por_status.ESCALAR} casos (${pctEscalar}%)

MONTOS EN JUEGO
───────────────
Total en riesgo: $${metrics.monto_total_en_riesgo.toLocaleString('es-MX')} MXN
Monto aprobado: $${metrics.monto_aprobado.toLocaleString('es-MX')} MXN
Monto rechazado: $${metrics.monto_rechazado.toLocaleString('es-MX')} MXN (fraude bloqueado)
Risk score promedio: ${metrics.risk_score_promedio}/100
`;

    if (format === 'detallado' && rechazados.length > 0) {
      reporte += `
CASOS RECHAZADOS (top ${rechazados.length})
─────────────────────────────────────────
`;
      for (const c of rechazados) {
        reporte += `${c.caso_id} | ${c.usuario_id} | Score: ${c.risk_score} | $${c.compensacion_solicitada_mxn} MXN\n`;
        reporte += `  → ${c.senales_clave[0] || 'Señal de fraude detectada'}\n\n`;
      }
    }

    if (format === 'detallado' && escalados.length > 0) {
      reporte += `
CASOS ESCALADOS PRIORITARIOS (top ${escalados.length})
──────────────────────────────────────────────────────
`;
      for (const c of escalados) {
        reporte += `${c.caso_id} | ${c.usuario_id} | Score: ${c.risk_score} | $${c.compensacion_solicitada_mxn} MXN\n`;
        reporte += `  → ${c.justificacion.slice(0, 120)}...\n\n`;
      }
    }

    reporte += `
RECOMENDACIONES OPERATIVAS
──────────────────────────
1. Revisar los ${metrics.por_status.ESCALAR} casos ESCALADOS — requieren decisión humana.
2. Los ${metrics.por_status.RECHAZAR} casos RECHAZADOS pueden procesarse automáticamente.
3. Los ${metrics.por_status.APROBAR} casos APROBADOS tienen riesgo bajo y se pueden aprobar.

═══════════════════════════════════════════
Generado por Trust & Safety Agent v1.0
Powered by Mastra + Claude
═══════════════════════════════════════════`;

    return { reporte };
  },
});
