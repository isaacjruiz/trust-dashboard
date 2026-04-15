import type { CaseEnriched } from '../mastra/schemas/enriched-case.js';
import {
  SCORE_WEIGHTS,
  NUEVO_FACTOR_MENOS_90D,
  NUEVO_FACTOR_MENOS_180D,
  NUEVO_FACTOR_MAYOR_180D,
  FRECUENCIA_MAX_NORM,
  INTENSIDAD_MAX_NORM,
} from './policies.js';

/**
 * Calcula el risk score compuesto de 0 a 100.
 *
 * Pesos:
 *   - flags_fraude_previos: 25 pts (señal más directa)
 *   - GPS invertido:        10 pts (GPS confirmada NO reduce riesgo)
 *   - frecuencia:           20 pts (compensaciones frecuentes)
 *   - ratio_compensacion:   20 pts (pedir casi el 100% del valor)
 *   - intensidad:           10 pts (monto acumulado en 90d)
 *   - usuario_nuevo:        15 pts (usuarios nuevos son más riesgosos)
 *
 * NOTA SOBRE GPS: el dataset muestra que el 100% de casos de fraude claro
 * tienen GPS confirmada — los defraudadores confirman la entrega.
 * Por esto, GPS confirmada = gps_score=0 y NO reduce el risk score.
 * Solo GPS no confirmada (gps_score=3) sube el riesgo 10 pts (problema técnico real).
 */
export function calculateRiskScore(enriched: CaseEnriched): number {
  // Componente 1: Flags de fraude previos (0-4 flags → 0-25 pts)
  const flagsComponent =
    (enriched.flags_fraude_previos / 4) * SCORE_WEIGHTS.flags_fraude;

  // Componente 2: GPS invertido (GPS confirmada=0pts, NO confirmada=10pts)
  // Solo se penaliza la NO confirmación — no recompensar GPS confirmada
  const gpsComponent =
    (enriched.gps_score / 3) * SCORE_WEIGHTS.gps;

  // Componente 3: Frecuencia normalizada (normalizada a 0-1, clamped)
  const frecuenciaNorm = Math.min(enriched.frecuencia_normalizada / 10, FRECUENCIA_MAX_NORM);
  const frecuenciaComponent = frecuenciaNorm * SCORE_WEIGHTS.frecuencia;

  // Componente 4: Ratio de compensación (0.50-1.00 → normalizado 0-1)
  // ratio_compensacion ya está entre 0.5 y 1.0 en el dataset
  // Normalizamos: (ratio - 0.5) / 0.5 → 0 si ratio=0.5, 1 si ratio=1.0
  const ratioNorm = Math.max(0, Math.min((enriched.ratio_compensacion - 0.5) / 0.5, 1));
  const ratioComponent = ratioNorm * SCORE_WEIGHTS.ratio_compensacion;

  // Componente 5: Intensidad de compensación acumulada (clamped a INTENSIDAD_MAX_NORM)
  const intensidadNorm = Math.min(enriched.intensidad_compensacion / INTENSIDAD_MAX_NORM, 1);
  const intensidadComponent = intensidadNorm * SCORE_WEIGHTS.intensidad;

  // Componente 6: Factor de usuario nuevo
  let usuarioNuevoFactor: number;
  if (enriched.antiguedad_usuario_dias < 90) {
    usuarioNuevoFactor = NUEVO_FACTOR_MENOS_90D;
  } else if (enriched.antiguedad_usuario_dias < 180) {
    usuarioNuevoFactor = NUEVO_FACTOR_MENOS_180D;
  } else {
    usuarioNuevoFactor = NUEVO_FACTOR_MAYOR_180D;
  }

  const total =
    flagsComponent +
    gpsComponent +
    frecuenciaComponent +
    ratioComponent +
    intensidadComponent +
    usuarioNuevoFactor;

  // Clamp a 0-100
  return Math.round(Math.min(100, Math.max(0, total)));
}

/**
 * Retorna el desglose del score por componente para visualización.
 */
export function getScoreBreakdown(enriched: CaseEnriched): Record<string, number> {
  const flagsComponent = (enriched.flags_fraude_previos / 4) * SCORE_WEIGHTS.flags_fraude;
  const gpsComponent = (enriched.gps_score / 3) * SCORE_WEIGHTS.gps;
  const frecuenciaNorm = Math.min(enriched.frecuencia_normalizada / 10, 1);
  const frecuenciaComponent = frecuenciaNorm * SCORE_WEIGHTS.frecuencia;
  const ratioNorm = Math.max(0, Math.min((enriched.ratio_compensacion - 0.5) / 0.5, 1));
  const ratioComponent = ratioNorm * SCORE_WEIGHTS.ratio_compensacion;
  const intensidadNorm = Math.min(enriched.intensidad_compensacion / 5, 1);
  const intensidadComponent = intensidadNorm * SCORE_WEIGHTS.intensidad;
  let usuarioNuevoFactor = 0;
  if (enriched.antiguedad_usuario_dias < 90) usuarioNuevoFactor = NUEVO_FACTOR_MENOS_90D;
  else if (enriched.antiguedad_usuario_dias < 180) usuarioNuevoFactor = NUEVO_FACTOR_MENOS_180D;

  return {
    flags_fraude: Math.round(flagsComponent),
    gps: Math.round(gpsComponent),
    frecuencia: Math.round(frecuenciaComponent),
    ratio_compensacion: Math.round(ratioComponent),
    intensidad: Math.round(intensidadComponent),
    usuario_nuevo: Math.round(usuarioNuevoFactor),
  };
}
