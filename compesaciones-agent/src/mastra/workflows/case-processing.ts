import { createWorkflow, createStep } from '@mastra/core/workflows';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { parseCSV, parseJSON } from '../../data/parser.js';
import { caseStore } from '../../data/store.js';
import { enrichCase } from '../../engine/enrichment.js';
import { calculateRiskScore, getScoreBreakdown } from '../../engine/scoring.js';
import { applyRules } from '../../engine/rules.js';
import type { CaseDecision } from '../schemas/decision.js';
import type { CaseEnriched } from '../schemas/enriched-case.js';
import { TRUST_AGENT_MODEL } from '../models.js';

// ─────────────────────────────────────────────────────────────
// Step 1: Process all cases in a single step
// Avoids passing large arrays through Mastra's LibSQL serialization
// ─────────────────────────────────────────────────────────────
const processAllCasesStep = createStep({
  id: 'process-all-cases',
  inputSchema: z.object({
    source: z.enum(['csv', 'json', 'manual']),
    csvContent: z.string().optional(),
    jsonData: z.array(z.any()).optional(),
  }),
  outputSchema: z.object({
    processed: z.number(),
    stats: z.object({
      total: z.number(),
      APROBAR: z.number(),
      RECHAZAR: z.number(),
      ESCALAR: z.number(),
    }),
  }),
  execute: async ({ inputData }) => {
    const { source, csvContent, jsonData } = inputData;

    // ── Parse ──────────────────────────────────────────────────
    let rawCases;
    if (source === 'csv' && csvContent) {
      rawCases = parseCSV(csvContent);
    } else if ((source === 'json' || source === 'manual') && jsonData) {
      rawCases = parseJSON(jsonData);
    } else {
      throw new Error('Invalid input: provide csvContent for csv source or jsonData for json/manual');
    }

    console.log(`[Workflow] Parsed ${rawCases.length} cases from ${source}`);

    // ── Enrich + Score + Rules ─────────────────────────────────
    const stats = { total: 0, APROBAR: 0, RECHAZAR: 0, ESCALAR: 0 };
    const decidedCases: (CaseEnriched & {
      risk_score: number;
      score_breakdown: ReturnType<typeof getScoreBreakdown>;
      recomendacion: 'APROBAR' | 'RECHAZAR' | 'ESCALAR';
      justificacion: string;
      senales_clave: string[];
      confianza: string;
      accion_sugerida?: string;
      subtipo_ambiguedad?: CaseDecision['subtipo_ambiguedad'];
    })[] = [];

    for (const raw of rawCases) {
      const enriched = enrichCase(raw);
      const risk_score = calculateRiskScore(enriched);
      const score_breakdown = getScoreBreakdown(enriched);
      const result = applyRules(enriched, risk_score);

      const rec = result.recomendacion as 'APROBAR' | 'RECHAZAR' | 'ESCALAR';
      decidedCases.push({
        ...enriched,
        risk_score,
        score_breakdown,
        recomendacion: rec,
        justificacion: result.justificacion_template,
        senales_clave: result.senales_clave,
        confianza: result.confianza,
      });

      stats.total++;
      stats[rec]++;
    }

    console.log(`[Workflow] Rules applied: APROBAR=${stats.APROBAR} RECHAZAR=${stats.RECHAZAR} ESCALAR=${stats.ESCALAR}`);

    // ── LLM Analysis for ESCALAR cases ─────────────────────────
    const hasApiKey = !!process.env.OPENAI_API_KEY;
    if (hasApiKey) {
      const escalateCases = decidedCases.filter((c) => c.recomendacion === 'ESCALAR');
      console.log(`[Workflow] Running LLM analysis on ${escalateCases.length} ESCALAR cases...`);

      const batchSize = 5;
      for (let i = 0; i < escalateCases.length; i += batchSize) {
        const batch = escalateCases.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (c) => {
            try {
              const prompt = buildEscalarPrompt(c as unknown as CaseDecision);
              const { text } = await generateText({
                model: openai(TRUST_AGENT_MODEL),
                prompt,
              });

              const jsonMatch = text.match(/\{[\s\S]*\}/);
              if (!jsonMatch) return;

              const analysis = JSON.parse(jsonMatch[0]) as {
                recomendacion: 'APROBAR' | 'RECHAZAR' | 'ESCALAR';
                justificacion: string;
                senales_clave: string[];
                confianza: 'ALTA' | 'MEDIA' | 'BAJA';
                accion_sugerida?: string;
                subtipo_ambiguedad?: string;
              };

              const idx = decidedCases.findIndex((d) => d.caso_id === c.caso_id);
              if (idx === -1) return;

              // If LLM says RECHAZAR/APROBAR with BAJA confidence, it's still ambiguous —
              // keep as ESCALAR so a human reviews it, but use the LLM's justification as context.
              const effectiveRec: 'APROBAR' | 'RECHAZAR' | 'ESCALAR' =
                (analysis.recomendacion !== 'ESCALAR' && analysis.confianza === 'BAJA')
                  ? 'ESCALAR'
                  : analysis.recomendacion;

              const prev = decidedCases[idx].recomendacion;
              decidedCases[idx] = {
                ...decidedCases[idx],
                recomendacion: effectiveRec,
                justificacion: analysis.justificacion,
                senales_clave: analysis.senales_clave || decidedCases[idx].senales_clave,
                confianza: analysis.confianza || 'MEDIA',
                // Populated when case is ESCALAR (either explicitly or downgraded from low-confidence decision)
                accion_sugerida: effectiveRec === 'ESCALAR' ? (analysis.accion_sugerida || undefined) : undefined,
                subtipo_ambiguedad: effectiveRec === 'ESCALAR' ? (analysis.subtipo_ambiguedad as CaseDecision['subtipo_ambiguedad'] || undefined) : undefined,
              };

              if (prev !== effectiveRec) {
                stats[prev]--;
                stats[effectiveRec]++;
              }
            } catch (err) {
              console.warn(`[Workflow] LLM failed for ${c.caso_id}:`, String(err).slice(0, 100));
              // Keep original ESCALAR — don't crash the pipeline
            }
          })
        );
      }
    } else {
      console.log('[Workflow] OPENAI_API_KEY not set — skipping LLM analysis, keeping ESCALAR decisions');
    }

    // ── Save to store ──────────────────────────────────────────
    const timestamp = new Date().toISOString();
    const toSave: CaseDecision[] = decidedCases.map((c) => ({
      ...(c as unknown as CaseDecision),
      recomendacion_agente: c.recomendacion,
      procesado_en: timestamp,
    }));

    caseStore.upsertMany(toSave);
    console.log(`[Workflow] Saved ${toSave.length} cases to store`);

    return { processed: toSave.length, stats };
  },
});

// ─────────────────────────────────────────────────────────────
// Step 2: Generate output summary
// ─────────────────────────────────────────────────────────────
const generateOutputStep = createStep({
  id: 'generate-output',
  inputSchema: z.object({
    processed: z.number(),
    stats: z.object({
      total: z.number(),
      APROBAR: z.number(),
      RECHAZAR: z.number(),
      ESCALAR: z.number(),
    }),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    processed: z.number(),
    stats: z.object({
      total: z.number(),
      APROBAR: z.number(),
      RECHAZAR: z.number(),
      ESCALAR: z.number(),
    }),
    message: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { processed, stats } = inputData;
    return {
      success: true,
      processed,
      stats,
      message: `Procesados ${processed} casos: ${stats.APROBAR} aprobar, ${stats.RECHAZAR} rechazar, ${stats.ESCALAR} escalar.`,
    };
  },
});

// ─────────────────────────────────────────────────────────────
// Helper: build LLM prompt for ESCALAR cases
// ─────────────────────────────────────────────────────────────
function buildEscalarPrompt(c: CaseDecision): string {
  return `Eres el Agente de Trust & Safety de Rappi. Analiza este caso de compensación ambiguo.

CASO ${c.caso_id}:
Usuario: ${c.usuario_id}
Antigüedad: ${c.antiguedad_usuario_dias} días
Ciudad: ${c.ciudad} | Vertical: ${c.vertical}
Restaurante: ${c.restaurante}
Valor orden: $${c.valor_orden_mxn} MXN
Compensación solicitada: $${c.compensacion_solicitada_mxn} MXN (${(((c as unknown as { ratio_compensacion: number }).ratio_compensacion ?? 0) * 100).toFixed(0)}% del valor)
Compensaciones en 90d: ${c.num_compensaciones_90d}
Monto compensado en 90d: $${c.monto_compensado_90d_mxn} MXN
Flags de fraude previos: ${c.flags_fraude_previos}
GPS: ${c.entrega_confirmada_gps}
Tiempo entrega: ${c.tiempo_entrega_real_min} min
Risk score: ${c.risk_score}/100

MOTIVO: ${c.motivo_reclamo}
DESCRIPCIÓN DEL USUARIO: "${c.descripcion_reclamo}"

SEÑALES YA DETECTADAS: ${c.senales_clave.join(', ')}

CONTEXTO IMPORTANTE:
- GPS confirmada NO es señal de legitimidad — los defraudadores sofisticados confirman la entrega
- Usuarios con <90 días de antigüedad y múltiples compensaciones son de alto riesgo
- Descripciones genéricas o copy-paste son señal de fraude organizado
- Ratio compensación/orden >90% en motivos menores es sospechoso

Analiza la coherencia entre la descripción del reclamo, los datos numéricos y el historial.
Decide: APROBAR (reclamo legítimo), RECHAZAR (señales claras de fraude), o ESCALAR (requiere revisión humana adicional).

Responde SOLO con JSON válido:
{
  "recomendacion": "APROBAR|RECHAZAR|ESCALAR",
  "justificacion": "2-3 líneas explicando la decisión con datos concretos",
  "senales_clave": ["señal 1", "señal 2"],
  "confianza": "ALTA|MEDIA|BAJA",
  "accion_sugerida": "Solo si recomendacion es ESCALAR: acción concreta de una línea para el agente CS. Ej: 'Verificar si el usuario tiene alergia documentada en cuenta' o 'Confirmar con el restaurante si hubo problema de stock esa noche'.",
  "subtipo_ambiguedad": "Solo si recomendacion es ESCALAR. UNO DE: motivo_salud | gps_ambiguo | usuario_nuevo | ratio_alto | multiples_flags | descripcion_generica"
}

Guía para subtipo_ambiguedad:
- motivo_salud: reclamo menciona alergia, reacción adversa, intoxicación o riesgo para la salud
- gps_ambiguo: GPS parcial o señal perdida es la señal dominante de incertidumbre
- usuario_nuevo: cuenta con <90 días es la principal fuente de ambigüedad
- ratio_alto: compensación >85% del valor sin otras señales claras de fraude
- multiples_flags: 2-3 flags previos pero sin evidencia suficiente para rechazar
- descripcion_generica: descripción del reclamo es vaga, genérica o probable copy-paste`;
}

// ─────────────────────────────────────────────────────────────
// Workflow: 2 steps (all processing + output summary)
// ─────────────────────────────────────────────────────────────
export const caseProcessingWorkflow = createWorkflow({
  id: 'case-processing',
  inputSchema: z.object({
    source: z.enum(['csv', 'json', 'manual']),
    csvContent: z.string().optional(),
    jsonData: z.array(z.any()).optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    processed: z.number(),
    stats: z.object({
      total: z.number(),
      APROBAR: z.number(),
      RECHAZAR: z.number(),
      ESCALAR: z.number(),
    }),
    message: z.string(),
  }),
})
  .then(processAllCasesStep)
  .then(generateOutputStep)
  .commit();
