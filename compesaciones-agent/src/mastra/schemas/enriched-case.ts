import { z } from 'zod';
import { CaseRawSchema } from './case.js';

export const CaseEnrichedSchema = CaseRawSchema.extend({
  // Derived variables
  ratio_compensacion: z.number(),        // compensacion / valor_orden
  frecuencia_normalizada: z.number(),    // (num_comp_90d / antiguedad_dias) * 90
  gps_score: z.number(),                 // 0=confirmada, 1=parcial, 2=perdida, 3=no_confirmada
  intensidad_compensacion: z.number(),   // monto_compensado_90d / valor_orden
  es_usuario_nuevo: z.boolean(),         // antiguedad < 90 dias
  comp_por_dia: z.number(),              // num_compensaciones_90d / antiguedad_dias
});

export type CaseEnriched = z.infer<typeof CaseEnrichedSchema>;
