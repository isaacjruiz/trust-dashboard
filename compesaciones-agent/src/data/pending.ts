import { enrichCase } from '../engine/enrichment.js';
import type { CaseRaw } from '../mastra/schemas/case.js';
import type { CaseDecision } from '../mastra/schemas/decision.js';

export function createPendingDecision(raw: CaseRaw): CaseDecision {
  const enriched = enrichCase(raw);

  return {
    ...enriched,
    risk_score: 0,
    recomendacion: 'PENDIENTE',
    recomendacion_agente: 'PENDIENTE',
    justificacion: 'Analizando con el agente AI. El resultado final aparecera al terminar el procesamiento.',
    senales_clave: ['Analizando'],
    confianza: 'BAJA',
    procesado_en: new Date().toISOString(),
  };
}
