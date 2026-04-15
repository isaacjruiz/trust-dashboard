// ══════════════════════════════════════════════════
// POLÍTICAS DE DECISIÓN — Trust & Safety Agent
// ══════════════════════════════════════════════════
// Todos los umbrales están documentados aquí para
// facilitar A/B testing y ajustes de política.

// ─── Umbrales de Risk Score ───────────────────────
export const RECHAZAR_RISK_THRESHOLD = 70;
export const APROBAR_RISK_THRESHOLD = 30;

// ─── Pesos del Risk Score (suma = 100 puntos) ─────
export const SCORE_WEIGHTS = {
  flags_fraude: 25,       // señal más directa de fraude
  gps: 10,                // GPS confirmada NO reduce riesgo
  frecuencia: 20,         // compensaciones frecuentes = señal
  ratio_compensacion: 20, // pedir casi el 100% del valor = señal
  intensidad: 10,         // monto acumulado en 90d vs valor orden
  usuario_nuevo: 15,      // usuarios nuevos con compensaciones = señal
} as const;

// ─── Puntaje por antigüedad (usuario_nuevo_factor) ─
export const NUEVO_FACTOR_MENOS_90D = 15;   // <90 días
export const NUEVO_FACTOR_MENOS_180D = 7;   // 90-180 días
export const NUEVO_FACTOR_MAYOR_180D = 0;   // >180 días

// ─── GPS Score (0 = menos riesgo, 3 = más riesgo) ─
// NOTA: GPS confirmada = fraude sofisticado. NO reduce riesgo.
export const GPS_SCORES: Record<string, number> = {
  'SÍ - confirmada': 0,
  'Parcial': 1,
  'Señal perdida': 2,
  'NO confirmada': 3,
};

// ─── Reglas de RECHAZAR ───────────────────────────
export const RECHAZAR_RULES = {
  min_flags_con_compensaciones: 3,   // flags >= 3 AND comp >= 8
  min_compensaciones_para_flags: 8,
  max_antiguedad_fraude_nuevo: 30,   // <30 días + 6 comp + ratio >0.90
  min_comp_usuario_nuevo: 6,
  max_ratio_usuario_nuevo: 0.90,
  min_compensaciones_ratio_alto: 10, // >= 10 comp AND ratio > 0.90
  max_ratio_comp_alto: 0.90,
  max_flags_absoluto: 4,             // 4 flags = rechazar sin importar nada
};

// ─── Reglas de APROBAR ────────────────────────────
export const APROBAR_RULES = {
  max_flags: 0,
  max_compensaciones: 2,
  max_ratio: 0.85,
};

// ─── Frecuencia normalizada — umbral para máx puntuación ─
export const FRECUENCIA_MAX_NORM = 1.0;  // clamped a 1.0 antes de multiplicar
export const INTENSIDAD_MAX_NORM = 5.0;  // clamped a 5.0 antes de escalar

// ─── Distribución esperada del dataset ─────────────
// RECHAZAR: ~35-45 casos
// APROBAR:  ~50-60 casos
// ESCALAR:  ~50-65 casos
