import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { caseStore } from '../../data/store.js';

export const getHighRiskTool = createTool({
  id: 'get-high-risk',
  description: 'Obtiene los casos con mayor score de riesgo. Ideal para priorizar la revisión o identificar los fraudes más claros.',
  inputSchema: z.object({
    limit: z.number().optional().default(10).describe('Número de casos a retornar'),
    minScore: z.number().optional().default(70).describe('Score mínimo de riesgo (0-100)'),
  }),
  outputSchema: z.object({
    total: z.number(),
    cases: z.array(z.object({
      caso_id: z.string(),
      usuario_id: z.string(),
      risk_score: z.number(),
      recomendacion: z.string(),
      flags_fraude_previos: z.number(),
      num_compensaciones_90d: z.number(),
      antiguedad_usuario_dias: z.number(),
      justificacion: z.string(),
    })),
  }),
  execute: async (inputData) => {
    const { limit, minScore } = inputData;
    const cases = caseStore.getHighRisk(limit, minScore);

    return {
      total: cases.length,
      cases: cases.map((c) => ({
        caso_id: c.caso_id,
        usuario_id: c.usuario_id,
        risk_score: c.risk_score,
        recomendacion: c.recomendacion,
        flags_fraude_previos: c.flags_fraude_previos,
        num_compensaciones_90d: c.num_compensaciones_90d,
        antiguedad_usuario_dias: c.antiguedad_usuario_dias,
        justificacion: c.justificacion,
      })),
    };
  },
});
