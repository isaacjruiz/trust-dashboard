import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { caseStore } from '../../data/store.js';

export const getCasesByUserTool = createTool({
  id: 'get-cases-by-user',
  description: 'Busca todos los casos de un usuario específico por su ID. Permite ver el historial completo y detectar patrones de abuso.',
  inputSchema: z.object({
    userId: z.string().describe('ID del usuario, ej: USR-11567'),
  }),
  outputSchema: z.object({
    usuario_id: z.string(),
    total_casos: z.number(),
    casos: z.array(z.object({
      caso_id: z.string(),
      fecha: z.string().optional(),
      motivo_reclamo: z.string(),
      compensacion_solicitada_mxn: z.number(),
      risk_score: z.number(),
      recomendacion: z.string(),
    })),
    resumen: z.string(),
  }),
  execute: async (inputData) => {
    const { userId } = inputData;
    const cases = caseStore.getByUser(userId);

    const rechazados = cases.filter((c) => c.recomendacion === 'RECHAZAR').length;
    const totalMonto = cases.reduce((s, c) => s + c.compensacion_solicitada_mxn, 0);
    const avgScore = cases.length > 0
      ? Math.round(cases.reduce((s, c) => s + c.risk_score, 0) / cases.length)
      : 0;

    const resumen = cases.length === 0
      ? `No se encontraron casos para el usuario ${userId}.`
      : `Usuario ${userId}: ${cases.length} caso(s), ${rechazados} rechazado(s), $${Math.round(totalMonto)} MXN solicitados, score promedio ${avgScore}/100.`;

    return {
      usuario_id: userId,
      total_casos: cases.length,
      casos: cases.map((c) => ({
        caso_id: c.caso_id,
        fecha: c.procesado_en,
        motivo_reclamo: c.motivo_reclamo,
        compensacion_solicitada_mxn: c.compensacion_solicitada_mxn,
        risk_score: c.risk_score,
        recomendacion: c.recomendacion,
      })),
      resumen,
    };
  },
});
