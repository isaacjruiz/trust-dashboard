import type { CaseRaw } from '../mastra/schemas/case.js';
import type { CaseEnriched } from '../mastra/schemas/enriched-case.js';
import { GPS_SCORES } from './policies.js';

/**
 * Enriquece un caso crudo con variables derivadas necesarias para el scoring.
 * Todas las variables son determinísticas y reproducibles.
 */
export function enrichCase(raw: CaseRaw): CaseEnriched {
  const ratio_compensacion =
    raw.compensacion_solicitada_mxn / raw.valor_orden_mxn;

  // Frecuencia normalizada: compensaciones por 90 días, ajustada a la antigüedad del usuario
  // Usuarios nuevos con muchas compensaciones producen un número alto
  const frecuencia_normalizada =
    (raw.num_compensaciones_90d / Math.max(raw.antiguedad_usuario_dias, 1)) * 90;

  // GPS score numérico (0 = confirmada, 3 = no confirmada)
  const gps_score = GPS_SCORES[raw.entrega_confirmada_gps] ?? 2;

  // Intensidad: cuánto se ha compensado en 90d vs el valor de esta orden
  const intensidad_compensacion =
    raw.monto_compensado_90d_mxn / Math.max(raw.valor_orden_mxn, 1);

  // Umbral de usuario nuevo: <90 días = flagged
  const es_usuario_nuevo = raw.antiguedad_usuario_dias < 90;

  // Compensaciones por día (sin normalizar por ventana de 90d)
  const comp_por_dia =
    raw.num_compensaciones_90d / Math.max(raw.antiguedad_usuario_dias, 1);

  return {
    ...raw,
    ratio_compensacion,
    frecuencia_normalizada,
    gps_score,
    intensidad_compensacion,
    es_usuario_nuevo,
    comp_por_dia,
  };
}
