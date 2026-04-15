import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { caseStore } from '../../data/store.js';

export const dispatchCaseTool = createTool({
  id: 'dispatch-case',
  description: 'Despacha un caso con una decisión final humana: APROBAR o RECHAZAR. Úsalo cuando el agente de CS confirme explícitamente que quiere aprobar o rechazar un caso.',
  inputSchema: z.object({
    caseId: z.string().describe('ID del caso, ej: COMP-0058'),
    decision: z.enum(['APROBAR', 'RECHAZAR']).describe('Decisión final: APROBAR o RECHAZAR'),
    motivo: z.string().optional().describe('Motivo opcional de la decisión del agente CS'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    case: z.any().nullable(),
  }),
  execute: async (inputData) => {
    const { caseId, decision, motivo } = inputData;
    const updated = caseStore.updateDecision(caseId, decision, 'CHAT');

    if (!updated) {
      return {
        success: false,
        message: `No se encontró el caso ${caseId}.`,
        case: null,
      };
    }

    const motivoStr = motivo ? ` Motivo: ${motivo}.` : '';
    return {
      success: true,
      message: `Caso ${caseId} despachado como ${decision} vía chat.${motivoStr}`,
      case: updated,
    };
  },
});
