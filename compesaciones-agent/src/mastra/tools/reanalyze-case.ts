import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { caseStore } from '../../data/store.js';

export const reanalyzeCaseTool = createTool({
  id: 'reanalyze-case',
  description: 'Reanaliza un caso con información adicional proporcionada por el agente CS (ej: "el usuario envió foto del producto dañado", "confirmó su alergia"). Actualiza la recomendación si hay nuevas evidencias.',
  inputSchema: z.object({
    caseId: z.string().describe('ID del caso a reanalizar'),
    newInfo: z.string().describe('Nueva información o evidencia adicional proporcionada por el agente CS'),
  }),
  outputSchema: z.object({
    found: z.boolean(),
    recomendacion_anterior: z.string().optional(),
    recomendacion_nueva: z.string().optional(),
    justificacion: z.string(),
    cambiada: z.boolean(),
  }),
  execute: async (inputData) => {
    const { caseId, newInfo } = inputData;
    const existing = caseStore.getById(caseId);

    if (!existing) {
      return {
        found: false,
        justificacion: `No se encontró el caso ${caseId}.`,
        cambiada: false,
      };
    }

    const prompt = `Eres el Agente de Trust & Safety de Rappi. Debes reanalizar un caso de compensación con nueva información.

DATOS DEL CASO ${caseId}:
- Usuario: ${existing.usuario_id}, ${existing.antiguedad_usuario_dias} días de antigüedad
- Orden: ${existing.restaurante}, ${existing.valor_orden_mxn} MXN, vertical: ${existing.vertical}
- Compensación solicitada: ${existing.compensacion_solicitada_mxn} MXN (${(existing.ratio_compensacion * 100).toFixed(0)}% del valor)
- Historial 90 días: ${existing.num_compensaciones_90d} compensaciones, ${existing.monto_compensado_90d_mxn} MXN
- Flags de fraude previos: ${existing.flags_fraude_previos}
- GPS: ${existing.entrega_confirmada_gps}
- Motivo: ${existing.motivo_reclamo}
- Descripción original: "${existing.descripcion_reclamo}"
- Risk score calculado: ${existing.risk_score}/100
- Recomendación actual: ${existing.recomendacion}
- Justificación actual: ${existing.justificacion}

NUEVA INFORMACIÓN DEL AGENTE CS:
"${newInfo}"

Con esta nueva información, determina:
1. ¿Cambia la recomendación? (APROBAR / RECHAZAR / ESCALAR)
2. Justifica la decisión en 2-3 líneas citando datos concretos y la nueva evidencia.

Responde en formato JSON:
{
  "recomendacion": "APROBAR|RECHAZAR|ESCALAR",
  "justificacion": "..."
}`;

    try {
      const { text } = await generateText({
        model: openai('gpt-4o-mini'),
        prompt,
      });

      // Parse JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON in response');

      const parsed = JSON.parse(jsonMatch[0]) as { recomendacion: string; justificacion: string };
      const nueva = parsed.recomendacion as 'APROBAR' | 'RECHAZAR' | 'ESCALAR';
      const anterior = existing.recomendacion;

      // Update in store
      caseStore.upsert({
        ...existing,
        recomendacion: nueva,
        justificacion: parsed.justificacion,
        senales_clave: [
          ...existing.senales_clave,
          `Nueva evidencia (${new Date().toLocaleDateString('es-MX')}): ${newInfo.slice(0, 100)}`,
        ],
        procesado_en: new Date().toISOString(),
      });

      return {
        found: true,
        recomendacion_anterior: anterior,
        recomendacion_nueva: nueva,
        justificacion: parsed.justificacion,
        cambiada: anterior !== nueva,
      };
    } catch {
      return {
        found: true,
        recomendacion_anterior: existing.recomendacion,
        recomendacion_nueva: existing.recomendacion,
        justificacion: `No se pudo procesar el reanálisis. Nueva información registrada: "${newInfo}"`,
        cambiada: false,
      };
    }
  },
});
