import { z } from 'zod';

export const GPS_STATUS = {
  CONFIRMED: 'SÍ - confirmada',
  PARTIAL: 'Parcial',
  LOST: 'Señal perdida',
  NOT_CONFIRMED: 'NO confirmada',
} as const;

export const RECOMMENDATION = {
  APPROVE: 'APROBAR',
  REJECT: 'RECHAZAR',
  ESCALATE: 'ESCALAR',
  PENDING: 'PENDIENTE',
} as const;

export const CaseRawSchema = z.object({
  caso_id: z.string(),
  usuario_id: z.string(),
  antiguedad_usuario_dias: z.number(),
  ciudad: z.string(),
  vertical: z.string(),
  restaurante: z.string(),
  valor_orden_mxn: z.number(),
  compensacion_solicitada_mxn: z.number(),
  num_compensaciones_90d: z.number(),
  monto_compensado_90d_mxn: z.number(),
  entrega_confirmada_gps: z.string(),
  tiempo_entrega_real_min: z.number(),
  flags_fraude_previos: z.number(),
  motivo_reclamo: z.string(),
  descripcion_reclamo: z.string(),
  recomendacion_agente: z.string().default('PENDIENTE'),
});

export type CaseRaw = z.infer<typeof CaseRawSchema>;
