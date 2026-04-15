import { useState, useCallback, useEffect } from 'react';
import { Shield, Upload, Loader2, Moon, Sun, ClipboardList, CheckCheck } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import { Dashboard } from './components/Dashboard';
import { DespachoPanel } from './components/DespachoPanel';
import { ChatPanel } from './components/ChatPanel';
import { IngestPanel } from './components/IngestPanel';
import { useCases } from './hooks/useCases';
import { useAgent } from './hooks/useAgent';
import './index.css';

export default function App() {
  const [showIngest, setShowIngest] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('dashboard-theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  });
  const [mainTab, setMainTab] = useState<'revision' | 'despacho'>('revision');
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const { cases, metrics, loading, processing, refresh, uploadCSV, simulateCase, ingestCase, dispatchCase, dispatchBatch } = useCases();
  const { messages, loading: agentLoading, sendMessage } = useAgent();

  const handleDispatch = useCallback(async (caseId: string, decision: 'APROBAR' | 'RECHAZAR') => {
    await dispatchCase(caseId, decision);
    toast.success(`${caseId} → ${decision}`, { icon: decision === 'APROBAR' ? '✅' : '❌' });
  }, [dispatchCase]);

  const handleDispatchBatch = useCallback(async (caseIds: string[], decision: 'APROBAR' | 'RECHAZAR') => {
    await dispatchBatch(caseIds, decision);
    toast.success(`${caseIds.length} casos → ${decision}`, { icon: decision === 'APROBAR' ? '✅' : '❌' });
  }, [dispatchBatch]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('dashboard-theme', theme);
  }, [theme]);

  const handleAskAgent = useCallback((msg: string) => {
    sendMessage(msg);
    document.querySelector('#chat-panel')?.scrollIntoView({ behavior: 'smooth' });
  }, [sendMessage]);

  return (
    <div className="app-shell flex flex-col">
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'var(--surface-elevated)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--panel-shadow)',
            fontFamily: 'var(--font-primary)',
            fontSize: '14px',
            borderRadius: '8px',
          },
        }}
      />

      {/* Header */}
      <header className="app-header sticky top-0 z-40">
        <div className="max-w-screen-2xl mx-auto px-5 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="brand-mark p-2 rounded-xl"
            >
              <Shield size={18} />
            </div>
            <div>
              <h1
                className="text-base font-bold leading-none"
                style={{ color: 'var(--text)' }}
              >
                Rappi Trust & Safety Agent
              </h1>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Automatización de revisión de compensaciones
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            {processing && (
              <div className="flex items-center gap-1.5 text-xs font-bold" style={{ color: 'var(--warning)' }}>
                <Loader2 size={12} className="animate-spin" />
                Procesando casos...
              </div>
            )}
            {metrics && metrics.total > 0 && (
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                <span className="font-bold" style={{ color: 'var(--primary)' }}>{metrics.total}</span>{' '}
                casos en memoria
              </div>
            )}
            <button
              type="button"
              className="theme-toggle text-xs font-bold"
              aria-label={`Cambiar a tema ${theme === 'dark' ? 'claro' : 'oscuro'}`}
              aria-pressed={theme === 'dark'}
              onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
            >
              {theme === 'dark' ? <Moon size={14} /> : <Sun size={14} />}
              <span className="hidden sm:inline">{theme === 'dark' ? 'Oscuro' : 'Claro'}</span>
            </button>
            <button
              onClick={() => setShowIngest(true)}
              className="action-button primary-button flex items-center gap-2 px-4 py-2 text-xs font-bold transition-all"
            >
              <Upload size={13} /> Cargar datos
            </button>
          </div>
        </div>
      </header>

      {/* Main layout: split pane */}
      <main
        className="app-main flex-1 max-w-screen-2xl mx-auto w-full px-5 py-5 flex flex-col lg:flex-row gap-5"
      >
        {/* Left: tabs + content */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          {/* Tab bar */}
          <div className="control-surface flex p-1 gap-1 self-start">
            <button
              onClick={() => setMainTab('revision')}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={{
                background: mainTab === 'revision' ? 'var(--primary)' : 'transparent',
                color: mainTab === 'revision' ? '#fff' : 'var(--text-muted)',
                boxShadow: mainTab === 'revision' ? 'var(--small-shadow)' : 'none',
              }}
            >
              <ClipboardList size={12} />
              Revisión
              {metrics && metrics.por_status.PENDIENTE > 0 && (
                <span
                  className="ml-0.5 px-1.5 py-0.5 rounded-full text-xs font-bold"
                  style={{ background: 'rgba(255,255,255,0.25)', fontSize: '10px' }}
                >
                  {metrics.por_status.PENDIENTE}
                </span>
              )}
            </button>
            <button
              onClick={() => setMainTab('despacho')}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={{
                background: mainTab === 'despacho' ? 'var(--success)' : 'transparent',
                color: mainTab === 'despacho' ? '#fff' : 'var(--text-muted)',
                boxShadow: mainTab === 'despacho' ? 'var(--small-shadow)' : 'none',
              }}
            >
              <CheckCheck size={12} />
              Despacho
              {cases.filter((c) => c.decision_manual != null).length > 0 && (
                <span
                  className="ml-0.5 px-1.5 py-0.5 rounded-full text-xs font-bold"
                  style={{ background: 'rgba(255,255,255,0.25)', fontSize: '10px' }}
                >
                  {cases.filter((c) => c.decision_manual != null).length}
                </span>
              )}
            </button>
          </div>

          <div className="overflow-y-auto pr-1">
            {mainTab === 'revision' ? (
              <Dashboard
                cases={cases}
                metrics={metrics}
                loading={loading}
                onAskAgent={handleAskAgent}
                onRefresh={() => refresh()}
                onDispatch={handleDispatch}
                onDispatchBatch={handleDispatchBatch}
              />
            ) : (
              <DespachoPanel cases={cases} />
            )}
          </div>
        </div>

        {/* Right: Chat — collapsible */}
        <div
          id="chat-panel"
          className={`dashboard-panel shrink-0 flex flex-col${chatCollapsed ? '' : ' w-full lg:w-96'}`}
          style={{
            height: '100%',
            width: chatCollapsed ? '48px' : undefined,
            transition: 'width 0.2s ease',
            overflow: 'hidden',
          }}
        >
          <ChatPanel
            messages={messages}
            loading={agentLoading}
            onSendMessage={sendMessage}
            collapsed={chatCollapsed}
            onToggleCollapse={() => setChatCollapsed((v) => !v)}
          />
        </div>
      </main>

      {/* Ingest modal */}
      {showIngest && (
        <IngestPanel
          onUploadCSV={uploadCSV}
          onSimulate={simulateCase}
          onIngestCase={ingestCase}
          onClose={() => setShowIngest(false)}
          processing={processing}
        />
      )}

      {/* Footer */}
      <footer
        className="py-2 px-4 text-center"
        style={{
          fontSize: '11px',
          color: 'var(--text-light)',
          borderTop: '1px solid var(--border)',
        }}
      >
        Trust & Safety Agent v1.0 · Powered by Mastra + Claude Sonnet
      </footer>
    </div>
  );
}
