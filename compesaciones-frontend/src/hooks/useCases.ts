import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import type { CaseDecision, Metrics } from '../types';

const BASE = '';  // uses Vite proxy

export function useCases() {
  const [cases, setCases] = useState<CaseDecision[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  const fetchCases = useCallback(async (filters?: {
    status?: string;
    search?: string;
    minScore?: number;
    maxScore?: number;
    ciudad?: string;
  }) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters?.status && filters.status !== 'TODOS') params.set('status', filters.status);
      if (filters?.search) params.set('search', filters.search);
      if (filters?.minScore !== undefined) params.set('minScore', String(filters.minScore));
      if (filters?.maxScore !== undefined) params.set('maxScore', String(filters.maxScore));
      if (filters?.ciudad) params.set('ciudad', filters.ciudad);
      params.set('limit', '500');

      const res = await axios.get<{ cases: CaseDecision[]; total: number }>(
        `${BASE}/cases?${params.toString()}`
      );
      setCases(res.data.cases);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await axios.get<Metrics>(`${BASE}/metrics`);
      setMetrics(res.data);
      return res.data;
    } catch {
      return null;
    }
  }, []);

  const refresh = useCallback(async (filters?: Parameters<typeof fetchCases>[0]) => {
    const [, nextMetrics] = await Promise.all([fetchCases(filters), fetchMetrics()]);
    return nextMetrics;
  }, [fetchCases, fetchMetrics]);

  const waitForAnalysis = useCallback(async () => {
    try {
      for (let attempts = 0; attempts < 60; attempts++) {
        const nextMetrics = await refresh();
        if (!nextMetrics || nextMetrics.por_status.PENDIENTE === 0) return;
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } finally {
      setProcessing(false);
    }
  }, [refresh]);

  const uploadCSV = useCallback(async (csvText: string) => {
    setProcessing(true);
    try {
      await axios.post(`${BASE}/ingest/csv`, csvText, {
        headers: { 'Content-Type': 'text/plain' },
      });
      await refresh();
      void waitForAnalysis();
    } catch (e) {
      setProcessing(false);
      throw e;
    }
  }, [refresh, waitForAnalysis]);

  const simulateCase = useCallback(async () => {
    setProcessing(true);
    try {
      const res = await axios.post<{ case: CaseDecision }>(`${BASE}/ingest/simulate`);
      await refresh();
      void waitForAnalysis();
      return res.data.case;
    } catch (e) {
      setProcessing(false);
      throw e;
    }
  }, [refresh, waitForAnalysis]);

  const ingestCase = useCallback(async (caseData: Record<string, unknown>) => {
    setProcessing(true);
    try {
      const res = await axios.post<{ success: boolean; case: CaseDecision }>(`${BASE}/ingest/case`, caseData);
      await refresh();
      void waitForAnalysis();
      return res.data;
    } catch (e) {
      setProcessing(false);
      throw e;
    }
  }, [refresh, waitForAnalysis]);

  const dispatchCase = useCallback(async (caseId: string, decision: 'APROBAR' | 'RECHAZAR') => {
    const res = await axios.post<{ success: boolean; case: CaseDecision }>(
      `${BASE}/cases/${caseId}/decision`,
      { decision, by: 'AGENTE' }
    );
    await refresh();
    return res.data.case;
  }, [refresh]);

  const dispatchBatch = useCallback(async (caseIds: string[], decision: 'APROBAR' | 'RECHAZAR') => {
    await axios.post(`${BASE}/cases/dispatch-batch`, { caseIds, decision, by: 'AGENTE' });
    await refresh();
  }, [refresh]);

  // Auto-load on mount
  useEffect(() => { refresh(); }, [refresh]);

  // Auto-refresh every 5s while processing
  useEffect(() => {
    if (!processing) return;
    const interval = setInterval(() => refresh(), 3000);
    return () => clearInterval(interval);
  }, [processing, refresh]);

  return {
    cases,
    metrics,
    loading,
    processing,
    refresh,
    uploadCSV,
    simulateCase,
    ingestCase,
    dispatchCase,
    dispatchBatch,
  };
}
