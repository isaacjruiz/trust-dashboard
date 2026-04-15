import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { caseStore } from '../../data/store.js';

export const findPatternsTool = createTool({
  id: 'find-patterns',
  description: 'Detecta patrones de fraude en los casos procesados agrupando por usuario, ciudad, motivo o descripción. Identifica comportamientos recurrentes.',
  inputSchema: z.object({
    type: z.enum(['usuario', 'restaurante', 'ciudad', 'motivo', 'descripcion']).optional().default('motivo'),
  }),
  outputSchema: z.object({
    patrones: z.array(z.object({
      grupo: z.string(),
      total_casos: z.number(),
      rechazados: z.number(),
      risk_score_promedio: z.number(),
      monto_total: z.number(),
      casos_ejemplo: z.array(z.string()),
    })),
    insight: z.string(),
  }),
  execute: async (inputData) => {
    const { type } = inputData;
    const all = caseStore.getAll();

    // Group by the requested dimension
    const groups = new Map<string, typeof all>();
    for (const c of all) {
      let key: string;
      switch (type) {
        case 'usuario': key = c.usuario_id; break;
        case 'restaurante': key = c.restaurante; break;
        case 'ciudad': key = c.ciudad; break;
        case 'motivo': key = c.motivo_reclamo; break;
        case 'descripcion':
          // Normalize description (first 60 chars to detect copy-paste)
          key = c.descripcion_reclamo.slice(0, 60).trim();
          break;
        default: key = c.motivo_reclamo;
      }
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(c);
    }

    const patrones = Array.from(groups.entries())
      .map(([grupo, cases]) => ({
        grupo,
        total_casos: cases.length,
        rechazados: cases.filter((c) => c.recomendacion === 'RECHAZAR').length,
        risk_score_promedio: Math.round(
          cases.reduce((s, c) => s + c.risk_score, 0) / cases.length
        ),
        monto_total: Math.round(cases.reduce((s, c) => s + c.compensacion_solicitada_mxn, 0)),
        casos_ejemplo: cases.slice(0, 3).map((c) => c.caso_id),
      }))
      .filter((p) => p.total_casos >= 2)
      .sort((a, b) => b.rechazados - a.rechazados || b.total_casos - a.total_casos)
      .slice(0, 10);

    // Generate insight
    const topFraud = patrones.find((p) => p.rechazados > 0);
    const insight = topFraud
      ? `El patrón más frecuente en fraude es "${topFraud.grupo}" con ${topFraud.rechazados} rechazados de ${topFraud.total_casos} casos y score promedio ${topFraud.risk_score_promedio}.`
      : 'No se detectaron patrones claros de fraude en los datos actuales.';

    return { patrones, insight };
  },
});
