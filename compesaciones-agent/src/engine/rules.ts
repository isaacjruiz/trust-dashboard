import type { CaseEnriched } from '../mastra/schemas/enriched-case.js';
import type { Recomendacion } from '../mastra/schemas/decision.js';
import {
  RECHAZAR_RISK_THRESHOLD,
  APROBAR_RISK_THRESHOLD,
  RECHAZAR_RULES,
  APROBAR_RULES,
} from './policies.js';

export interface RulesResult {
  recomendacion: Recomendacion;
  confianza: 'ALTA' | 'MEDIA' | 'BAJA';
  senales_clave: string[];
  justificacion_template: string;
}

/**
 * Motor de reglas determinístico.
 * Retorna APROBAR/RECHAZAR para casos claros y ESCALAR para ambiguos.
 * El LLM sólo analiza los ESCALAR — ahorrando tokens y latencia.
 */
export function applyRules(
  enriched: CaseEnriched,
  riskScore: number
): RulesResult {
  const senales: string[] = [];

  // ══════════════════════════════════════════
  // REGLAS DE RECHAZO — señales claras de fraude
  // ══════════════════════════════════════════

  if (enriched.flags_fraude_previos >= RECHAZAR_RULES.max_flags_absoluto) {
    senales.push(`${enriched.flags_fraude_previos} flags de fraude previos (máximo absoluto)`);
    return buildResult('RECHAZAR', 'ALTA', senales, enriched, riskScore);
  }

  if (riskScore > RECHAZAR_RISK_THRESHOLD) {
    senales.push(`Risk score ${riskScore}/100 supera umbral de rechazo (${RECHAZAR_RISK_THRESHOLD})`);
    if (enriched.flags_fraude_previos > 0) senales.push(`${enriched.flags_fraude_previos} flags previos`);
    if (enriched.num_compensaciones_90d > 5) senales.push(`${enriched.num_compensaciones_90d} compensaciones en 90 días`);
    if (enriched.ratio_compensacion > 0.90) senales.push(`Ratio compensación/orden: ${(enriched.ratio_compensacion * 100).toFixed(0)}%`);
    return buildResult('RECHAZAR', 'ALTA', senales, enriched, riskScore);
  }

  if (
    enriched.flags_fraude_previos >= RECHAZAR_RULES.min_flags_con_compensaciones &&
    enriched.num_compensaciones_90d >= RECHAZAR_RULES.min_compensaciones_para_flags
  ) {
    senales.push(`${enriched.flags_fraude_previos} flags + ${enriched.num_compensaciones_90d} compensaciones en 90 días`);
    return buildResult('RECHAZAR', 'ALTA', senales, enriched, riskScore);
  }

  if (
    enriched.antiguedad_usuario_dias < RECHAZAR_RULES.max_antiguedad_fraude_nuevo &&
    enriched.num_compensaciones_90d >= RECHAZAR_RULES.min_comp_usuario_nuevo &&
    enriched.ratio_compensacion > RECHAZAR_RULES.max_ratio_usuario_nuevo
  ) {
    senales.push(`Usuario de ${enriched.antiguedad_usuario_dias} días con ${enriched.num_compensaciones_90d} compensaciones y ratio ${(enriched.ratio_compensacion * 100).toFixed(0)}%`);
    return buildResult('RECHAZAR', 'ALTA', senales, enriched, riskScore);
  }

  if (
    enriched.num_compensaciones_90d >= RECHAZAR_RULES.min_compensaciones_ratio_alto &&
    enriched.ratio_compensacion > RECHAZAR_RULES.max_ratio_comp_alto
  ) {
    senales.push(`${enriched.num_compensaciones_90d} compensaciones con ratio ${(enriched.ratio_compensacion * 100).toFixed(0)}%`);
    return buildResult('RECHAZAR', 'ALTA', senales, enriched, riskScore);
  }

  // ══════════════════════════════════════════
  // REGLAS DE APROBACIÓN — reclamo consistente
  // ══════════════════════════════════════════

  if (
    riskScore < APROBAR_RISK_THRESHOLD &&
    enriched.flags_fraude_previos === APROBAR_RULES.max_flags &&
    enriched.num_compensaciones_90d <= APROBAR_RULES.max_compensaciones &&
    enriched.ratio_compensacion <= APROBAR_RULES.max_ratio
  ) {
    if (enriched.antiguedad_usuario_dias > 365) senales.push(`Usuario consolidado: ${enriched.antiguedad_usuario_dias} días de antigüedad`);
    if (enriched.num_compensaciones_90d === 0) senales.push('Primera compensación — sin historial de reclamos');
    senales.push(`Sin flags previos. Risk score bajo: ${riskScore}/100`);
    return buildResult('APROBAR', 'ALTA', senales, enriched, riskScore);
  }

  // ══════════════════════════════════════════
  // ESCALAR — caso ambiguo, requiere análisis LLM
  // ══════════════════════════════════════════

  // Registrar señales mixtas para contexto del LLM
  if (enriched.flags_fraude_previos > 0 && enriched.flags_fraude_previos < 3) {
    senales.push(`${enriched.flags_fraude_previos} flag(s) previo(s) — señal moderada`);
  }
  if (enriched.es_usuario_nuevo) {
    senales.push(`Usuario nuevo: ${enriched.antiguedad_usuario_dias} días de antigüedad`);
  }
  if (enriched.gps_score === 1) senales.push('GPS parcial — señal ambigua');
  if (enriched.gps_score === 2) senales.push('Señal GPS perdida — posible problema técnico o manipulación');
  if (enriched.ratio_compensacion > 0.85) {
    senales.push(`Ratio compensación alto: ${(enriched.ratio_compensacion * 100).toFixed(0)}%`);
  }
  if (enriched.num_compensaciones_90d > 2 && enriched.num_compensaciones_90d < 8) {
    senales.push(`${enriched.num_compensaciones_90d} compensaciones en 90 días — frecuencia moderada`);
  }

  return buildResult('ESCALAR', 'BAJA', senales, enriched, riskScore);
}

function buildResult(
  recomendacion: Recomendacion,
  confianza: 'ALTA' | 'MEDIA' | 'BAJA',
  senales: string[],
  enriched: CaseEnriched,
  riskScore: number
): RulesResult {
  return {
    recomendacion,
    confianza,
    senales_clave: senales.length > 0 ? senales : ['Análisis estándar sin señales destacadas'],
    justificacion_template: buildJustificacion(recomendacion, enriched, riskScore, senales),
  };
}

function buildJustificacion(
  recomendacion: Recomendacion,
  enriched: CaseEnriched,
  riskScore: number,
  senales: string[]
): string {
  const usuario = `Usuario de ${enriched.antiguedad_usuario_dias} días`;
  const historial = `${enriched.num_compensaciones_90d} compensaciones en 90 días`;
  const flags = `${enriched.flags_fraude_previos} flag(s) previo(s)`;
  const ratio = `Solicita ${(enriched.ratio_compensacion * 100).toFixed(0)}% del valor de la orden (${enriched.compensacion_solicitada_mxn} MXN)`;
  const gps = enriched.entrega_confirmada_gps;

  if (recomendacion === 'RECHAZAR') {
    return `${usuario}, ${historial}, ${flags}. ${ratio}. GPS: ${gps}. Risk score: ${riskScore}/100. Señal principal: ${senales[0] || 'múltiples indicadores de fraude'}.`;
  }

  if (recomendacion === 'APROBAR') {
    return `${usuario} sin flags previos. ${historial}. ${ratio}. Risk score bajo: ${riskScore}/100. Reclamo consistente con historial del usuario.`;
  }

  return `Señales mixtas: ${usuario}, ${historial}, ${flags}. GPS: ${gps}. Risk score: ${riskScore}/100. Requiere análisis de descripción del reclamo y contexto adicional.`;
}
