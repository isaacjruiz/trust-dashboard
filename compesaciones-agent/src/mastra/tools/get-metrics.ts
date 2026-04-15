import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { caseStore } from '../../data/store.js';

export const getMetricsTool = createTool({
  id: 'get-metrics',
  description: 'Obtiene métricas resumen de todos los casos procesados: totales por estado, montos en riesgo, score promedio y distribución.',
  inputSchema: z.object({}),
  outputSchema: z.object({
    total: z.number(),
    por_status: z.object({
      APROBAR: z.number(),
      RECHAZAR: z.number(),
      ESCALAR: z.number(),
      PENDIENTE: z.number(),
    }),
    monto_total_en_riesgo: z.number(),
    monto_aprobado: z.number(),
    monto_rechazado: z.number(),
    risk_score_promedio: z.number(),
    procesado_en: z.string(),
  }),
  execute: async (_inputData) => {
    return caseStore.getMetrics();
  },
});
