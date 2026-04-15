import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { caseStore } from '../../data/store.js';

export const getCaseTool = createTool({
  id: 'get-case',
  description: 'Busca un caso de compensación por su ID (ej: COMP-0058). Retorna todos los datos del caso incluyendo el score de riesgo, la recomendación y la justificación.',
  inputSchema: z.object({
    caseId: z.string().describe('ID del caso, ej: COMP-0058'),
  }),
  outputSchema: z.object({
    found: z.boolean(),
    case: z.any().nullable(),
    message: z.string().optional(),
  }),
  execute: async (inputData) => {
    const { caseId } = inputData;
    const found = caseStore.getById(caseId);

    if (!found) {
      return {
        found: false,
        case: null,
        message: `No se encontró el caso ${caseId}. Verifica que el ID sea correcto y que los casos hayan sido procesados.`,
      };
    }

    return { found: true, case: found };
  },
});
