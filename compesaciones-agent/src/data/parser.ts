import { parse } from 'csv-parse/sync';
import type { CaseRaw } from '../mastra/schemas/case.js';
import { CaseRawSchema } from '../mastra/schemas/case.js';

/**
 * Parses a CSV buffer into an array of CaseRaw objects.
 * Handles UTF-8 with BOM, Spanish characters, and quoted fields.
 */
export function parseCSV(buffer: Buffer | string): CaseRaw[] {
  const raw = typeof buffer === 'string' ? buffer : buffer.toString('utf-8');

  // Strip UTF-8 BOM and leading whitespace
  let content = raw.replace(/^\uFEFF/, '').trimStart();

  // Skip metadata/title rows: any line before the actual header that doesn't start with 'caso_id'
  const lines = content.split('\n');
  const headerIdx = lines.findIndex((l) => l.trim().toLowerCase().startsWith('caso_id'));
  if (headerIdx > 0) {
    content = lines.slice(headerIdx).join('\n');
  }

  // Auto-detect delimiter: use tab if the header line contains tabs, else comma
  const firstLine = content.split('\n')[0] || '';
  const delimiter = firstLine.includes('\t') ? '\t' : ',';

  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: false, // BOM already stripped above
    delimiter,
  }) as Record<string, string>[];

  return records.map((row, i) => {
    try {
      return CaseRawSchema.parse({
        caso_id: row['caso_id'] || row['caso_id '] || '',
        usuario_id: row['usuario_id'] || '',
        antiguedad_usuario_dias: parseFloat(row['antiguedad_usuario_dias'] || '0'),
        ciudad: row['ciudad'] || '',
        vertical: row['vertical'] || '',
        restaurante: row['restaurante'] || '',
        valor_orden_mxn: parseFloat(row['valor_orden_mxn'] || '0'),
        compensacion_solicitada_mxn: parseFloat(row['compensacion_solicitada_mxn'] || '0'),
        num_compensaciones_90d: parseFloat(row['num_compensaciones_90d'] || '0'),
        monto_compensado_90d_mxn: parseFloat(row['monto_compensado_90d_mxn'] || '0'),
        entrega_confirmada_gps: row['entrega_confirmada_gps'] || 'NO confirmada',
        tiempo_entrega_real_min: parseFloat(row['tiempo_entrega_real_min'] || '0'),
        flags_fraude_previos: parseFloat(row['flags_fraude_previos'] || '0'),
        motivo_reclamo: row['motivo_reclamo'] || '',
        descripcion_reclamo: row['descripcion_reclamo'] || '',
        recomendacion_agente: row['recomendacion_agente'] || 'PENDIENTE',
      });
    } catch (e) {
      throw new Error(`Error parsing row ${i + 1} (caso_id=${row['caso_id']}): ${e}`);
    }
  });
}

/**
 * Parses an array of plain JSON objects into CaseRaw[].
 * Used for the REST API single-case and simulate endpoints.
 */
export function parseJSON(data: unknown[]): CaseRaw[] {
  return data.map((row, i) => {
    try {
      return CaseRawSchema.parse(row);
    } catch (e) {
      throw new Error(`Error parsing JSON record ${i + 1}: ${e}`);
    }
  });
}

/**
 * Generates a realistic random case for demo purposes.
 */
export function generateRandomCase(): CaseRaw {
  const ciudades = ['CDMX', 'Bogotá', 'Buenos Aires', 'Lima', 'São Paulo', 'Santiago', 'Medellín'];
  const verticales = ['Comida', 'Mercado', 'Farmacia'];
  const restaurantes = ['La Cocina de Doña Rosa', 'Taquería El Torito', 'SuperFresh', 'Farmacia Express'];
  const motivos = [
    'Orden cancelada sin reembolso',
    'Producto incorrecto',
    'Orden no llegó',
    'Cobro incorrecto',
    'Producto incompleto',
    'Producto en mal estado',
    'Orden llegó tarde',
  ];
  const descripciones = [
    'Mi orden fue cancelada sin previo aviso y no he recibido reembolso.',
    'El producto que llegó no corresponde a lo que ordené.',
    'Mi pedido nunca llegó aunque el sistema lo marca como entregado.',
    'Me cobraron un monto diferente al que aparece en la app.',
    'Faltaban varios productos de mi orden.',
  ];
  const gpsOptions: string[] = ['SÍ - confirmada', 'Parcial', 'Señal perdida', 'NO confirmada'];

  const antiguedad = Math.floor(Math.random() * 1800) + 6;
  const valor_orden = Math.floor(Math.random() * 600) + 100;
  const ratio = 0.5 + Math.random() * 0.5;
  const compensacion = Math.round(valor_orden * ratio);
  const num_comp = Math.floor(Math.random() * 10);
  const flags = Math.floor(Math.random() * 4);

  const caseId = `COMP-SIM-${Date.now()}`;

  return {
    caso_id: caseId,
    usuario_id: `USR-${Math.floor(Math.random() * 90000) + 10000}`,
    antiguedad_usuario_dias: antiguedad,
    ciudad: ciudades[Math.floor(Math.random() * ciudades.length)],
    vertical: verticales[Math.floor(Math.random() * verticales.length)],
    restaurante: restaurantes[Math.floor(Math.random() * restaurantes.length)],
    valor_orden_mxn: valor_orden,
    compensacion_solicitada_mxn: compensacion,
    num_compensaciones_90d: num_comp,
    monto_compensado_90d_mxn: num_comp * compensacion * 0.8,
    entrega_confirmada_gps: gpsOptions[Math.floor(Math.random() * gpsOptions.length)],
    tiempo_entrega_real_min: Math.floor(Math.random() * 80) + 20,
    flags_fraude_previos: flags,
    motivo_reclamo: motivos[Math.floor(Math.random() * motivos.length)],
    descripcion_reclamo: descripciones[Math.floor(Math.random() * descripciones.length)],
    recomendacion_agente: 'PENDIENTE',
  };
}
