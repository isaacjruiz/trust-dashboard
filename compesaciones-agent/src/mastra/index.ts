import { Mastra } from '@mastra/core/mastra';
import { registerApiRoute } from '@mastra/core/server';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { trustAgent } from './agents/trust-agent.js';
import { caseProcessingWorkflow } from './workflows/case-processing.js';
import { caseStore } from '../data/store.js';
import { parseCSV, parseJSON, generateRandomCase } from '../data/parser.js';
import { createPendingDecision } from '../data/pending.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ─── Mastra instance ────────────────────────────────────────
export const mastra = new Mastra({
  workflows: { 'case-processing': caseProcessingWorkflow },
  agents: { trustAgent },
  storage: new LibSQLStore({
    id: 'mastra-storage',
    url: 'file:./mastra.db',
  }),
  logger: new PinoLogger({ name: 'Mastra', level: 'info' }),
  server: {
    cors: {
      origin: '*',
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      allowHeaders: ['Content-Type'],
      credentials: false,
    },
    apiRoutes: [
      // Health
      registerApiRoute('/health', {
        method: 'GET',
        handler: async () => jsonResponse({ status: 'ok', timestamp: new Date().toISOString() }),
      }),

      // List cases with filters
      registerApiRoute('/cases', {
        method: 'GET',
        handler: async (c) => {
          const q = (k: string) => c.req.query(k);
          const cases = caseStore.getAll({
            status: q('status') || undefined,
            ciudad: q('ciudad') || undefined,
            minScore: q('minScore') ? Number(q('minScore')) : undefined,
            maxScore: q('maxScore') ? Number(q('maxScore')) : undefined,
            search: q('search') || undefined,
            limit: q('limit') ? Number(q('limit')) : 500,
            offset: q('offset') ? Number(q('offset')) : 0,
            sortBy: q('sortBy') || undefined,
            sortDir: (q('sortDir') || 'desc') as 'asc' | 'desc',
          });
          return jsonResponse({ total: cases.length, cases });
        },
      }),

      // Batch dispatch — must be registered before /:id to avoid param shadowing
      registerApiRoute('/cases/dispatch-batch', {
        method: 'POST',
        handler: async (c) => {
          try {
            const body = await c.req.json() as {
              caseIds: string[];
              decision: 'APROBAR' | 'RECHAZAR';
              by?: 'AGENTE' | 'CHAT';
            };
            if (!Array.isArray(body.caseIds) || body.caseIds.length === 0)
              return jsonResponse({ error: 'caseIds debe ser un array no vacío' }, 400);
            if (body.decision !== 'APROBAR' && body.decision !== 'RECHAZAR')
              return jsonResponse({ error: 'decision debe ser APROBAR o RECHAZAR' }, 400);
            const result = caseStore.updateDecisionBatch(body.caseIds, body.decision, body.by ?? 'AGENTE');
            return jsonResponse({ updated: result.updated, cases: result.cases });
          } catch (e) {
            return jsonResponse({ error: String(e) }, 400);
          }
        },
      }),

      // Get single case
      registerApiRoute('/cases/:id', {
        method: 'GET',
        handler: async (c) => {
          const id = c.req.param('id');
          const found = caseStore.getById(id);
          if (!found) return jsonResponse({ error: `Case ${id} not found` }, 404);
          return jsonResponse(found);
        },
      }),

      // Manual dispatch decision
      registerApiRoute('/cases/:id/decision', {
        method: 'POST',
        handler: async (c) => {
          try {
            const id = c.req.param('id');
            const body = await c.req.json() as { decision: 'APROBAR' | 'RECHAZAR'; by?: 'AGENTE' | 'CHAT' };
            if (body.decision !== 'APROBAR' && body.decision !== 'RECHAZAR') {
              return jsonResponse({ error: 'decision must be APROBAR or RECHAZAR' }, 400);
            }
            const updated = caseStore.updateDecision(id, body.decision, body.by ?? 'AGENTE');
            if (!updated) return jsonResponse({ error: `Case ${id} not found` }, 404);
            return jsonResponse({ success: true, case: updated });
          } catch (e) {
            return jsonResponse({ error: String(e) }, 400);
          }
        },
      }),

      // Get dispatched cases
      registerApiRoute('/cases/dispatched', {
        method: 'GET',
        handler: async () => jsonResponse({ cases: caseStore.getDispatched() }),
      }),

      // Metrics
      registerApiRoute('/metrics', {
        method: 'GET',
        handler: async () => jsonResponse(caseStore.getMetrics()),
      }),

      // Export CSV
      registerApiRoute('/export/csv', {
        method: 'GET',
        handler: async () => new Response(caseStore.exportToCSV(), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename="rappi-trust-safety-results.csv"',
          },
        }),
      }),

      // Ingest CSV (background processing)
      registerApiRoute('/ingest/csv', {
        method: 'POST',
        handler: async (c) => {
          try {
            const body = await c.req.text();
            const cases = parseCSV(body);
            caseStore.upsertMany(cases.map(createPendingDecision));

            const workflow = mastra.getWorkflow('case-processing');
            const run = await workflow.createRun();
            run.start({ inputData: { source: 'csv' as const, csvContent: body } }).catch(console.error);
            return jsonResponse({
              success: true,
              message: `Analizando ${cases.length} casos en segundo plano.`,
              count: cases.length,
              pending: cases.length,
            });
          } catch (e) {
            return jsonResponse({ error: String(e) }, 400);
          }
        },
      }),

      // Ingest single case
      registerApiRoute('/ingest/case', {
        method: 'POST',
        handler: async (c) => {
          try {
            const body = await c.req.json();
            const cases = parseJSON([body]);
            caseStore.upsertMany(cases.map(createPendingDecision));

            const workflow = mastra.getWorkflow('case-processing');
            const run = await workflow.createRun();
            run.start({ inputData: { source: 'manual' as const, jsonData: cases } }).catch(console.error);
            return jsonResponse({
              success: true,
              message: `Analizando ${cases[0].caso_id} en segundo plano.`,
              case: caseStore.getById(cases[0].caso_id),
            });
          } catch (e) {
            return jsonResponse({ error: String(e) }, 400);
          }
        },
      }),

      // Simulate random case
      registerApiRoute('/ingest/simulate', {
        method: 'POST',
        handler: async () => {
          try {
            const randomCase = generateRandomCase();
            caseStore.upsert(createPendingDecision(randomCase));

            const workflow = mastra.getWorkflow('case-processing');
            const run = await workflow.createRun();
            run.start({ inputData: { source: 'json' as const, jsonData: [randomCase] } }).catch(console.error);
            return jsonResponse({ success: true, case: caseStore.getById(randomCase.caso_id) });
          } catch (e) {
            return jsonResponse({ error: String(e) }, 500);
          }
        },
      }),

      // Agent chat
      registerApiRoute('/agent/chat', {
        method: 'POST',
        handler: async (c) => {
          try {
            const body = await c.req.json() as {
              message: string;
              history?: Array<{ role: 'user' | 'assistant'; content: string }>;
              threadId?: string;
            };
            const agent = mastra.getAgent('trustAgent');

            // Build messages array with conversation history + new user message
            const messages = [
              ...(body.history ?? []),
              { role: 'user' as const, content: body.message },
            ];

            const result = await agent.generate(messages);
            return jsonResponse({ response: result.text, threadId: body.threadId || `thread-${Date.now()}` });
          } catch (e) {
            return jsonResponse({ error: String(e) }, 500);
          }
        },
      }),
    ],
  },
});

// ─── Preload CSV data on startup ────────────────────────────
async function preloadData() {
  if (caseStore.size() > 0) return;
  try {
    const { readFile } = await import('fs/promises');
    const { resolve } = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = fileURLToPath(new URL('.', import.meta.url));

    const csvPaths = [
      resolve(process.cwd(), 'dataset.csv'),
      resolve(process.cwd(), 'Untitled spreadsheet - Sheet1.csv'),
      resolve(__dirname, '..', '..', 'dataset.csv'),
      resolve(__dirname, '../../../..', 'Untitled spreadsheet - Sheet1.csv'),
    ];

    let csvContent: string | null = null;
    for (const p of csvPaths) {
      try { csvContent = await readFile(p, 'utf-8'); console.log(`[Mastra] Cargando: ${p}`); break; }
      catch { /* next */ }
    }

    if (!csvContent) { console.log('[Mastra] CSV no encontrado — usa /ingest/csv'); return; }

    const workflow = mastra.getWorkflow('case-processing');
    const run = await workflow.createRun();
    await run.start({ inputData: { source: 'csv' as const, csvContent } });
    const m = caseStore.getMetrics();
    console.log(`[Mastra] ${m.total} casos | APROBAR:${m.por_status.APROBAR} RECHAZAR:${m.por_status.RECHAZAR} ESCALAR:${m.por_status.ESCALAR}`);
  } catch (e) {
    console.error('[Mastra] Error preload:', e);
  }
}

setTimeout(preloadData, 3000);
