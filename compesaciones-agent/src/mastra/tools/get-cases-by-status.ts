import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { caseStore } from '../../data/store.js';

export const getCasesByStatusTool = createTool({
  id: 'get-cases-by-status',
  description: 'Lista casos filtrados por recomendación: APROBAR, RECHAZAR o ESCALAR. Útil para revisar grupos de casos o preparar reportes.',
  inputSchema: z.object({
    status: z.enum(['APROBAR', 'RECHAZAR', 'ESCALAR', 'TODOS']).describe('Estado de la recomendación del agente'),
    limit: z.number().optional().default(20).describe('Número máximo de casos a retornar'),
  }),
  outputSchema: z.object({
    total: z.number(),
    cases: z.array(z.object({
      caso_id: z.string(),
      usuario_id: z.string(),
      ciudad: z.string(),
      motivo_reclamo: z.string(),
      valor_orden_mxn: z.number(),
      compensacion_solicitada_mxn: z.number(),
      risk_score: z.number(),
      recomendacion: z.string(),
      confianza: z.string(),
      senales_clave: z.array(z.string()),
    })),
  }),
  execute: async (inputData) => {
    const { status, limit } = inputData;
    const cases = caseStore.getAll({ status, limit });

    return {
      total: cases.length,
      cases: cases.map((c) => ({
        caso_id: c.caso_id,
        usuario_id: c.usuario_id,
        ciudad: c.ciudad,
        motivo_reclamo: c.motivo_reclamo,
        valor_orden_mxn: c.valor_orden_mxn,
        compensacion_solicitada_mxn: c.compensacion_solicitada_mxn,
        risk_score: c.risk_score,
        recomendacion: c.recomendacion,
        confianza: c.confianza,
        senales_clave: c.senales_clave,
      })),
    };
  },
});
