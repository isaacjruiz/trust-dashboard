import { z } from 'zod';
import { CaseEnrichedSchema } from './enriched-case.js';

export const RecomendacionSchema = z.enum(['APROBAR', 'RECHAZAR', 'ESCALAR', 'PENDIENTE']);

export const CaseDecisionSchema = CaseEnrichedSchema.extend({
  risk_score: z.number().min(0).max(100),
  recomendacion: RecomendacionSchema,
  justificacion: z.string(),
  senales_clave: z.array(z.string()),
  confianza: z.enum(['ALTA', 'MEDIA', 'BAJA']),
  // ESCALAR enrichment — populated by LLM for ambiguous cases
  accion_sugerida: z.string().optional(),
  subtipo_ambiguedad: z.enum([
    'motivo_salud',
    'gps_ambiguo',
    'usuario_nuevo',
    'ratio_alto',
    'multiples_flags',
    'descripcion_generica',
  ]).optional(),
  procesado_en: z.string().optional(),
  // Human dispatch fields
  decision_manual: z.enum(['APROBAR', 'RECHAZAR']).nullable().optional(),
  despachado_en: z.string().nullable().optional(),
  despachado_por: z.enum(['AGENTE', 'CHAT']).nullable().optional(),
});

export type CaseDecision = z.infer<typeof CaseDecisionSchema>;
export type Recomendacion = z.infer<typeof RecomendacionSchema>;
