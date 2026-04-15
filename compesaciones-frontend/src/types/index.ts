export type Recomendacion = 'APROBAR' | 'RECHAZAR' | 'ESCALAR' | 'PENDIENTE';
export type Confianza = 'ALTA' | 'MEDIA' | 'BAJA';

export interface CaseDecision {
  // Raw case fields
  caso_id: string;
  usuario_id: string;
  antiguedad_usuario_dias: number;
  ciudad: string;
  vertical: string;
  restaurante: string;
  valor_orden_mxn: number;
  compensacion_solicitada_mxn: number;
  num_compensaciones_90d: number;
  monto_compensado_90d_mxn: number;
  entrega_confirmada_gps: string;
  tiempo_entrega_real_min: number;
  flags_fraude_previos: number;
  motivo_reclamo: string;
  descripcion_reclamo: string;
  recomendacion_agente: string;
  // Derived
  ratio_compensacion: number;
  frecuencia_normalizada: number;
  gps_score: number;
  intensidad_compensacion: number;
  es_usuario_nuevo: boolean;
  comp_por_dia: number;
  // Decision
  risk_score: number;
  recomendacion: Recomendacion;
  justificacion: string;
  senales_clave: string[];
  confianza: Confianza;
  // ESCALAR enrichment — populated by LLM for ambiguous cases
  accion_sugerida?: string;
  subtipo_ambiguedad?: 'motivo_salud' | 'gps_ambiguo' | 'usuario_nuevo' | 'ratio_alto' | 'multiples_flags' | 'descripcion_generica';
  procesado_en?: string;
  // Human dispatch
  decision_manual?: 'APROBAR' | 'RECHAZAR' | null;
  despachado_en?: string | null;
  despachado_por?: 'AGENTE' | 'CHAT' | null;
}

export interface Metrics {
  total: number;
  por_status: {
    APROBAR: number;
    RECHAZAR: number;
    ESCALAR: number;
    PENDIENTE: number;
  };
  monto_total_en_riesgo: number;
  monto_aprobado: number;
  monto_rechazado: number;
  risk_score_promedio: number;
  procesado_en: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: Date;
}
