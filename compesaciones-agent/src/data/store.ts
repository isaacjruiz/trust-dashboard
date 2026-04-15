import type { CaseDecision } from '../mastra/schemas/decision.js';

export interface CaseMetrics {
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

/**
 * In-memory store for processed cases.
 * Singleton — persists for the lifetime of the server process.
 * In production would be replaced with a proper database.
 */
class CaseStore {
  private cases = new Map<string, CaseDecision>();

  upsert(decision: CaseDecision): void {
    this.cases.set(decision.caso_id, {
      ...decision,
      procesado_en: decision.procesado_en ?? new Date().toISOString(),
    });
  }

  upsertMany(decisions: CaseDecision[]): void {
    for (const d of decisions) {
      this.upsert(d);
    }
  }

  getById(caseId: string): CaseDecision | undefined {
    return this.cases.get(caseId);
  }

  getAll(filters?: {
    status?: string;
    ciudad?: string;
    minScore?: number;
    maxScore?: number;
    search?: string;
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
  }): CaseDecision[] {
    let results = Array.from(this.cases.values());

    if (filters?.status && filters.status !== 'TODOS') {
      results = results.filter((c) => c.recomendacion === filters.status);
    }
    if (filters?.ciudad) {
      results = results.filter((c) =>
        c.ciudad.toLowerCase().includes(filters.ciudad!.toLowerCase())
      );
    }
    if (filters?.minScore !== undefined) {
      results = results.filter((c) => c.risk_score >= filters.minScore!);
    }
    if (filters?.maxScore !== undefined) {
      results = results.filter((c) => c.risk_score <= filters.maxScore!);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      results = results.filter(
        (c) =>
          c.caso_id.toLowerCase().includes(q) ||
          c.usuario_id.toLowerCase().includes(q) ||
          c.restaurante.toLowerCase().includes(q)
      );
    }

    // Sorting
    const sortBy = filters?.sortBy ?? 'risk_score';
    const sortDir = filters?.sortDir ?? 'desc';
    results.sort((a, b) => {
      const av = (a as Record<string, unknown>)[sortBy] ?? 0;
      const bv = (b as Record<string, unknown>)[sortBy] ?? 0;
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });

    const offset = filters?.offset ?? 0;
    const limit = filters?.limit ?? 1000;
    return results.slice(offset, offset + limit);
  }

  getByStatus(status: 'APROBAR' | 'RECHAZAR' | 'ESCALAR', limit = 50): CaseDecision[] {
    return this.getAll({ status, limit });
  }

  getHighRisk(limit = 20, minScore = 70): CaseDecision[] {
    return this.getAll({ minScore, limit, sortBy: 'risk_score', sortDir: 'desc' });
  }

  getByUser(userId: string): CaseDecision[] {
    return Array.from(this.cases.values()).filter((c) => c.usuario_id === userId);
  }

  updateDecision(caseId: string, decision: 'APROBAR' | 'RECHAZAR', by: 'AGENTE' | 'CHAT'): CaseDecision | null {
    const existing = this.cases.get(caseId);
    if (!existing) return null;
    const updated: CaseDecision = {
      ...existing,
      decision_manual: decision,
      despachado_en: new Date().toISOString(),
      despachado_por: by,
    };
    this.cases.set(caseId, updated);
    return updated;
  }

  updateDecisionBatch(
    caseIds: string[],
    decision: 'APROBAR' | 'RECHAZAR',
    by: 'AGENTE' | 'CHAT' = 'AGENTE'
  ): { updated: number; cases: CaseDecision[] } {
    const timestamp = new Date().toISOString();
    const updated: CaseDecision[] = [];
    for (const id of caseIds) {
      const existing = this.cases.get(id);
      if (!existing) continue;
      const record: CaseDecision = {
        ...existing,
        decision_manual: decision,
        despachado_en: timestamp,
        despachado_por: by,
      };
      this.cases.set(id, record);
      updated.push(record);
    }
    return { updated: updated.length, cases: updated };
  }

  getDispatched(): CaseDecision[] {
    return Array.from(this.cases.values())
      .filter((c) => c.decision_manual != null)
      .sort((a, b) => (b.despachado_en ?? '').localeCompare(a.despachado_en ?? ''));
  }

  getMetrics(): CaseMetrics {
    const all = Array.from(this.cases.values());
    const analyzed = all.filter((c) => c.recomendacion !== 'PENDIENTE');
    const total = all.length;

    const por_status = {
      APROBAR: all.filter((c) => c.recomendacion === 'APROBAR').length,
      RECHAZAR: all.filter((c) => c.recomendacion === 'RECHAZAR').length,
      ESCALAR: all.filter((c) => c.recomendacion === 'ESCALAR').length,
      PENDIENTE: all.filter((c) => c.recomendacion === 'PENDIENTE').length,
    };

    const monto_total_en_riesgo = all.reduce(
      (sum, c) => sum + c.compensacion_solicitada_mxn,
      0
    );
    const monto_aprobado = all
      .filter((c) => c.recomendacion === 'APROBAR')
      .reduce((sum, c) => sum + c.compensacion_solicitada_mxn, 0);
    const monto_rechazado = all
      .filter((c) => c.recomendacion === 'RECHAZAR')
      .reduce((sum, c) => sum + c.compensacion_solicitada_mxn, 0);

    const risk_score_promedio =
      analyzed.length > 0
        ? Math.round(analyzed.reduce((sum, c) => sum + c.risk_score, 0) / analyzed.length)
        : 0;

    return {
      total,
      por_status,
      monto_total_en_riesgo: Math.round(monto_total_en_riesgo),
      monto_aprobado: Math.round(monto_aprobado),
      monto_rechazado: Math.round(monto_rechazado),
      risk_score_promedio,
      procesado_en: new Date().toISOString(),
    };
  }

  clear(): void {
    this.cases.clear();
  }

  size(): number {
    return this.cases.size;
  }

  exportToCSV(): string {
    const headers = [
      'caso_id', 'usuario_id', 'antiguedad_usuario_dias', 'ciudad', 'vertical',
      'restaurante', 'valor_orden_mxn', 'compensacion_solicitada_mxn',
      'num_compensaciones_90d', 'monto_compensado_90d_mxn', 'entrega_confirmada_gps',
      'tiempo_entrega_real_min', 'flags_fraude_previos', 'motivo_reclamo',
      'descripcion_reclamo', 'recomendacion_agente', 'recomendacion', 'risk_score',
      'confianza', 'justificacion', 'senales_clave',
    ];

    const rows = Array.from(this.cases.values()).map((c) =>
      [
        c.caso_id, c.usuario_id, c.antiguedad_usuario_dias, c.ciudad, c.vertical,
        c.restaurante, c.valor_orden_mxn, c.compensacion_solicitada_mxn,
        c.num_compensaciones_90d, c.monto_compensado_90d_mxn, c.entrega_confirmada_gps,
        c.tiempo_entrega_real_min, c.flags_fraude_previos, c.motivo_reclamo,
        `"${c.descripcion_reclamo.replace(/"/g, '""')}"`, c.recomendacion_agente,
        c.recomendacion, c.risk_score, c.confianza,
        `"${c.justificacion.replace(/"/g, '""')}"`,
        `"${c.senales_clave.join('; ').replace(/"/g, '""')}"`,
      ].join(',')
    );

    return [headers.join(','), ...rows].join('\n');
  }
}

// Singleton instance
export const caseStore = new CaseStore();
