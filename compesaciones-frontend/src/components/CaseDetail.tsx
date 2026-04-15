import { useState, useRef, useEffect } from 'react';
import { X, MessageSquare, RefreshCw, MapPin, Clock, Shield, AlertTriangle, User, CheckCircle, XCircle, Loader2, Bot, Send, ChevronDown } from 'lucide-react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import { InfoTooltip } from './InfoTooltip';
import type { CaseDecision } from '../types';
import { StatusBadge } from './StatusBadge';

interface Props {
  case_: CaseDecision;
  onClose: () => void;
  onReanalyze: (caseId: string, info: string) => Promise<void>;
  onDispatch: (caseId: string, decision: 'APROBAR' | 'RECHAZAR') => Promise<void>;
}

interface LocalMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
}

// Tiny inline chat — self-contained, no global state
function InlineChat({ caseId, initialMessage }: { caseId: string; initialMessage: string }) {
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const threadId = useRef(`inline-${caseId}-${Date.now()}`);
  const messagesRef = useRef(messages);
  const hasSent = useRef(false);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // Auto-send the initial message on mount.
  // hasSent guard prevents double-fire from React StrictMode in development.
  useEffect(() => {
    if (hasSent.current) return;
    hasSent.current = true;
    void send(initialMessage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (content: string) => {
    if (!content.trim() || loading) return;
    const userMsg: LocalMessage = { id: `u-${Date.now()}`, role: 'user', content };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    try {
      const history = messagesRef.current.map((m) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      }));
      const res = await axios.post<{ response: string }>('/agent/chat', {
        message: content,
        history,
        threadId: threadId.current,
      });
      setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: 'agent', content: res.data.response }]);
    } catch {
      setMessages((prev) => [...prev, { id: `e-${Date.now()}`, role: 'agent', content: 'Error al conectar con el agente.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col" style={{ minHeight: 0 }}>
      {/* Message list */}
      <div
        className="flex flex-col gap-2 overflow-y-auto px-1 py-2"
        style={{ maxHeight: '260px' }}
      >
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className="text-xs rounded-xl px-3 py-2 max-w-[85%] leading-relaxed"
              style={
                m.role === 'user'
                  ? { background: 'var(--primary)', color: '#fff' }
                  : { background: 'var(--surface-elevated)', color: 'var(--text)', border: '1px solid var(--border)' }
              }
            >
              {m.role === 'agent' ? (
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                    strong: ({ children }) => {
                      const text = String(children);
                      const color =
                        text === 'RECHAZAR' ? 'var(--danger)' :
                        text === 'APROBAR' ? 'var(--success)' :
                        text === 'ESCALAR' ? 'var(--warning)' : undefined;
                      return <strong style={color ? { color } : undefined}>{children}</strong>;
                    },
                    ul: ({ children }) => <ul className="list-disc pl-4 space-y-0.5">{children}</ul>,
                  }}
                >
                  {m.content}
                </ReactMarkdown>
              ) : (
                m.content
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div
              className="text-xs rounded-xl px-3 py-2 flex items-center gap-1.5"
              style={{ background: 'var(--surface-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
            >
              <Loader2 size={10} className="animate-spin" /> Pensando...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        className="flex gap-2 pt-2"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(input); } }}
          placeholder="Pregunta al agente..."
          className="input-surface flex-1 px-3 py-1.5 text-xs outline-none"
          disabled={loading}
        />
        <button
          onClick={() => void send(input)}
          disabled={!input.trim() || loading}
          className="action-button flex items-center justify-center p-2 transition-all"
          style={{ opacity: !input.trim() || loading ? 0.4 : 1 }}
        >
          <Send size={12} />
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, mono = false, tooltip }: { label: string; value: string | number | boolean; mono?: boolean; tooltip?: string }) {
  return (
    <div>
      <dt className="text-xs font-bold mb-0.5" style={{ color: 'var(--text-muted)' }}>
        {tooltip ? <InfoTooltip text={tooltip} iconSize={10}>{label}</InfoTooltip> : label}
      </dt>
      <dd
        className="text-xs"
        style={{
          color: 'var(--text)',
          fontFamily: mono ? 'IBM Plex Sans, sans-serif' : 'IBM Plex Sans, sans-serif',
          fontWeight: mono ? 500 : 400,
        }}
      >
        {String(value)}
      </dd>
    </div>
  );
}

function ScoreComponent({ label, value, max, tooltip }: { label: string; value: number; max: number; tooltip?: string }) {
  const pct = Math.round((value / max) * 100);
  const color = pct > 70 ? 'var(--danger)' : pct > 40 ? 'var(--warning)' : 'var(--success)';
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs w-28 shrink-0" style={{ color: 'var(--text-muted)' }}>
        {tooltip ? <InfoTooltip text={tooltip} iconSize={10}>{label}</InfoTooltip> : label}
      </span>
      <div
        className="flex-1 rounded-full"
        style={{
          height: '6px',
          background: 'var(--surface-muted)',
          border: '1px solid var(--border)',
        }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span
        className="text-xs w-10 text-right shrink-0"
        style={{ color: 'var(--text)', fontFamily: 'IBM Plex Sans, sans-serif' }}
      >
        {value}/{max}
      </span>
    </div>
  );
}

export function CaseDetail({ case_: c, onClose, onReanalyze, onDispatch }: Props) {
  const [newInfo, setNewInfo] = useState('');
  const [reanalyzing, setReanalyzing] = useState(false);
  const [dispatching, setDispatching] = useState<'APROBAR' | 'RECHAZAR' | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const isPending = c.recomendacion === 'PENDIENTE';
  const isDispatched = c.decision_manual != null;

  const handleReanalyze = async () => {
    if (!newInfo.trim()) return;
    setReanalyzing(true);
    try {
      await onReanalyze(c.caso_id, newInfo);
      setNewInfo('');
    } finally {
      setReanalyzing(false);
    }
  };

  const handleDispatch = async (decision: 'APROBAR' | 'RECHAZAR') => {
    setDispatching(decision);
    try {
      await onDispatch(c.caso_id, decision);
      onClose();
    } finally {
      setDispatching(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.42)', backdropFilter: 'blur(5px)' }}
        onClick={onClose}
      />

      {/* Panel — flex column so header is sticky and content scrolls */}
      <div
        className="dashboard-panel relative w-full max-w-lg h-full flex flex-col"
        style={{ borderRadius: 0 }}
      >
        {/* Header — fixed, never scrolls */}
        <div
          className="shrink-0 px-5 py-4 flex items-center justify-between"
          style={{
            background: 'var(--surface-solid)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div>
            <div
              className="text-sm font-bold"
              style={{ color: 'var(--primary)', fontFamily: 'IBM Plex Sans, sans-serif' }}
            >
              {c.caso_id}
            </div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {c.usuario_id} · {c.ciudad}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={c.recomendacion} />
            <button
              onClick={onClose}
              className="action-button p-1.5 transition-all"
              style={{ color: 'var(--text-muted)' }}
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* ── Decision banner — lo primero que ve el agente CS ── */}
          {!isPending && !isDispatched && (
            <div
              className="rounded-xl p-4 space-y-3"
              style={{
                background:
                  c.recomendacion === 'APROBAR' ? 'rgba(34,197,94,0.07)' :
                  c.recomendacion === 'RECHAZAR' ? 'rgba(239,68,68,0.07)' :
                  'rgba(245,158,11,0.07)',
                border: `1px solid ${
                  c.recomendacion === 'APROBAR' ? 'rgba(34,197,94,0.25)' :
                  c.recomendacion === 'RECHAZAR' ? 'rgba(239,68,68,0.25)' :
                  'rgba(245,158,11,0.25)'
                }`,
              }}
            >
              {/* Score + recomendacion */}
              <div className="flex items-center gap-3">
                <div
                  className="text-2xl font-bold shrink-0"
                  style={{ color: 'var(--text)', fontFamily: 'IBM Plex Sans, sans-serif' }}
                >
                  {c.risk_score}
                  <span className="text-sm font-normal" style={{ color: 'var(--text-muted)' }}>/100</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={c.recomendacion} />
                    <span className="text-xs font-bold" style={{
                      color: c.confianza === 'ALTA' ? 'var(--success)' : c.confianza === 'MEDIA' ? 'var(--warning)' : 'var(--text-light)',
                    }}>
                      Confianza {c.confianza}
                    </span>
                  </div>
                  {/* Razón principal — primera señal clave */}
                  {c.senales_clave[0] && (
                    <p className="text-xs mt-1 leading-snug" style={{ color: 'var(--text-muted)' }}>
                      {c.senales_clave[0]}
                    </p>
                  )}
                </div>
              </div>

              {/* Botones de despacho aquí arriba también */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleDispatch('APROBAR')}
                  disabled={dispatching != null}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all"
                  style={{
                    background: 'rgba(34,197,94,0.15)',
                    border: '1px solid rgba(34,197,94,0.35)',
                    color: 'var(--success)',
                    opacity: dispatching != null ? 0.5 : 1,
                    cursor: dispatching != null ? 'not-allowed' : 'pointer',
                  }}
                >
                  {dispatching === 'APROBAR' ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                  Aprobar
                </button>
                <button
                  onClick={() => handleDispatch('RECHAZAR')}
                  disabled={dispatching != null}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all"
                  style={{
                    background: 'rgba(239,68,68,0.15)',
                    border: '1px solid rgba(239,68,68,0.35)',
                    color: 'var(--danger)',
                    opacity: dispatching != null ? 0.5 : 1,
                    cursor: dispatching != null ? 'not-allowed' : 'pointer',
                  }}
                >
                  {dispatching === 'RECHAZAR' ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
                  Rechazar
                </button>
              </div>
            </div>
          )}

          {/* Risk Score */}
          <div className="data-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3
                className="text-xs font-bold flex items-center gap-1.5"
                style={{ color: 'var(--text)' }}
              >
                <Shield size={13} style={{ color: 'var(--primary)' }} /> Risk Score
              </h3>
              <div
                className="text-2xl font-bold"
                style={{ color: 'var(--text)', fontFamily: 'IBM Plex Sans, sans-serif' }}
              >
                {isPending ? '...' : c.risk_score}
                {!isPending && (
                  <span className="text-sm font-normal" style={{ color: 'var(--text-muted)' }}>
                    /100
                  </span>
                )}
              </div>
            </div>
            {isPending ? (
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                Analizando el caso. El score y la recomendacion se actualizaran automaticamente al terminar el workflow.
              </p>
            ) : (
              <div className="space-y-2">
                <ScoreComponent label="Flags fraude" value={Math.round((c.flags_fraude_previos / 4) * 25)} max={25}
                  tooltip="Alertas de fraude previas en el perfil. Cada flag sube el riesgo. 0 = historial limpio. Aporta hasta 25 pts al score." />
                <ScoreComponent label="GPS" value={Math.round((c.gps_score / 3) * 10)} max={10}
                  tooltip="Confirmación de entrega por GPS. 'SÍ confirmada' = 0 riesgo. 'Parcial/Señal perdida' = riesgo medio. 'NO confirmada' = riesgo máximo. Aporta hasta 10 pts." />
                <ScoreComponent label="Frecuencia" value={Math.round(Math.min(c.frecuencia_normalizada / 10, 1) * 20)} max={20}
                  tooltip="Número de compensaciones en los últimos 90 días. Más de 5 compensaciones en 90 días es señal de abuso sistemático. Aporta hasta 20 pts." />
                <ScoreComponent label="Ratio comp." value={Math.round(Math.max(0, Math.min((c.ratio_compensacion - 0.5) / 0.5, 1)) * 20)} max={20}
                  tooltip="Proporción entre lo que pide y el valor real de la orden. Si pide más del 80% del valor de la orden, es sospechoso. Aporta hasta 20 pts." />
                <ScoreComponent label="Intensidad" value={Math.round(Math.min(c.intensidad_compensacion / 5, 1) * 10)} max={10}
                  tooltip="Monto total compensado en 90 días dividido entre antigüedad. Mide si el usuario acumula compensaciones de forma acelerada. Aporta hasta 10 pts." />
                <ScoreComponent label="Usuario nuevo" value={c.es_usuario_nuevo ? (c.antiguedad_usuario_dias < 90 ? 15 : 7) : 0} max={15}
                  tooltip="Cuentas con menos de 90 días tienen historial insuficiente para validar si el reclamo es legítimo. A menor antigüedad, mayor penalización. Aporta hasta 15 pts." />
              </div>
            )}
          </div>

          {/* Justificación */}
          <div className="data-card p-4">
            <h3
              className="text-xs font-bold mb-2 flex items-center gap-1.5"
              style={{ color: 'var(--text)' }}
            >
              <AlertTriangle size={13} style={{ color: 'var(--warning)' }} /> Justificación
            </h3>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text)' }}>
              {c.justificacion}
            </p>
            <div className="mt-3 space-y-1">
              {c.senales_clave.map((s, i) => (
                <div key={i} className="flex items-start gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <span style={{ color: 'var(--warning)', flexShrink: 0 }}>▸</span>
                  <span>{s}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Datos del caso */}
          <div className="data-card p-4">
            <h3
              className="text-xs font-bold mb-3 flex items-center gap-1.5"
              style={{ color: 'var(--text)' }}
            >
              <User size={13} style={{ color: 'var(--text-muted)' }} /> Datos del caso
            </h3>
            <dl className="grid grid-cols-2 gap-3">
              <Field label="Antigüedad" value={`${c.antiguedad_usuario_dias} días`}
                tooltip="Días desde que el usuario creó su cuenta. Cuentas muy nuevas (<30 días) con reclamos grandes son señal de alerta." />
              <Field label="Vertical" value={c.vertical}
                tooltip="Categoría del negocio: Comida, Mercado o Farmacia." />
              <Field label="Restaurante" value={c.restaurante} />
              <Field label="Valor orden" value={`$${c.valor_orden_mxn} MXN`} mono
                tooltip="Monto total que el usuario pagó por la orden original." />
              <Field label="Comp. solicitada" value={`$${c.compensacion_solicitada_mxn} MXN`} mono
                tooltip="Monto que el usuario reclama como compensación. Si supera el 80% del valor de la orden, es una señal de alerta importante." />
              <Field label="Ratio comp." value={`${(c.ratio_compensacion * 100).toFixed(0)}%`} mono
                tooltip="Porcentaje que representa la compensación pedida sobre el valor total de la orden. >80% es sospechoso." />
              <Field label="Comp. en 90d" value={c.num_compensaciones_90d}
                tooltip="Número de compensaciones que este usuario recibió en los últimos 90 días. Más de 5 es señal de abuso." />
              <Field label="Monto en 90d" value={`$${c.monto_compensado_90d_mxn} MXN`} mono
                tooltip="Suma de todas las compensaciones que el usuario ha recibido en los últimos 90 días." />
              <Field label="Flags fraude" value={c.flags_fraude_previos}
                tooltip="Alertas de fraude registradas previamente en el perfil. 0 = limpio, 1–2 = historial a revisar, 3+ = perfil de alto riesgo." />
              <Field label="GPS" value={c.entrega_confirmada_gps}
                tooltip="Confirmación de entrega por GPS del repartidor. 'SÍ confirmada' = entrega registrada. 'Parcial/Señal perdida' = datos incompletos. 'NO confirmada' = sin registro de entrega." />
              <Field label="T. entrega" value={`${c.tiempo_entrega_real_min} min`}
                tooltip="Tiempo real que tardó la orden en llegar. Órdenes muy tardías (>90 min) pueden justificar un reclamo legítimo." />
              <Field label="Usuario nuevo" value={c.es_usuario_nuevo ? 'Sí (<90 días)' : 'No'}
                tooltip="Usuarios con menos de 90 días en la plataforma. Sin historial suficiente para validar comportamiento, lo que eleva el nivel de análisis." />
            </dl>
          </div>

          {/* Reclamo */}
          <div className="data-card p-4 space-y-2">
            <h3
              className="text-xs font-bold flex items-center gap-1.5"
              style={{ color: 'var(--text)' }}
            >
              <MessageSquare size={13} style={{ color: 'var(--text-muted)' }} /> Reclamo
            </h3>
            <div>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Motivo: </span>
              <span className="text-xs font-bold" style={{ color: 'var(--primary)' }}>
                {c.motivo_reclamo}
              </span>
            </div>
            <p className="text-xs leading-relaxed italic" style={{ color: 'var(--text)' }}>
              "{c.descripcion_reclamo}"
            </p>
          </div>

          {/* Dispatch actions */}
          {isDispatched ? (
            <div
              className="rounded-xl p-4 flex items-center gap-3"
              style={{
                background: c.decision_manual === 'APROBAR' ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                border: `1px solid ${c.decision_manual === 'APROBAR' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
              }}
            >
              {c.decision_manual === 'APROBAR'
                ? <CheckCircle size={18} style={{ color: 'var(--success)', flexShrink: 0 }} />
                : <XCircle size={18} style={{ color: 'var(--danger)', flexShrink: 0 }} />}
              <div>
                <p className="text-xs font-bold" style={{ color: c.decision_manual === 'APROBAR' ? 'var(--success)' : 'var(--danger)' }}>
                  Despachado como {c.decision_manual}
                </p>
                <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                  {c.despachado_por === 'CHAT' ? <Bot size={10} /> : <User size={10} />}
                  {c.despachado_por === 'CHAT' ? 'Chat' : 'Agente'} ·{' '}
                  {c.despachado_en ? new Date(c.despachado_en).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : ''}
                </p>
              </div>
            </div>
          ) : !isPending ? (
            <div className="space-y-2">
              <p className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>Decisión final</p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleDispatch('APROBAR')}
                  disabled={dispatching != null}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all"
                  style={{
                    background: 'rgba(34,197,94,0.12)',
                    border: '1px solid rgba(34,197,94,0.3)',
                    color: 'var(--success)',
                    opacity: dispatching != null ? 0.5 : 1,
                    cursor: dispatching != null ? 'not-allowed' : 'pointer',
                  }}
                >
                  {dispatching === 'APROBAR' ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                  Aprobar compensación
                </button>
                <button
                  onClick={() => handleDispatch('RECHAZAR')}
                  disabled={dispatching != null}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all"
                  style={{
                    background: 'rgba(239,68,68,0.12)',
                    border: '1px solid rgba(239,68,68,0.3)',
                    color: 'var(--danger)',
                    opacity: dispatching != null ? 0.5 : 1,
                    cursor: dispatching != null ? 'not-allowed' : 'pointer',
                  }}
                >
                  {dispatching === 'RECHAZAR' ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />}
                  Rechazar
                </button>
              </div>
            </div>
          ) : null}

          {/* Inline agent chat */}
          <div
            className="data-card overflow-hidden"
            style={{ padding: 0 }}
          >
            <button
              onClick={() => setChatOpen((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-xs font-bold transition-all"
              style={{
                background: chatOpen ? 'var(--primary-light)' : 'transparent',
                color: chatOpen ? 'var(--primary)' : 'var(--text-muted)',
                border: 'none',
                cursor: 'pointer',
                borderBottom: chatOpen ? '1px solid var(--border)' : 'none',
              }}
            >
              <span className="flex items-center gap-2">
                <Bot size={13} />
                Preguntar al agente sobre este caso
              </span>
              <ChevronDown
                size={13}
                style={{ transform: chatOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
              />
            </button>
            {chatOpen && (
              <div className="px-3 pb-3 pt-2">
                <InlineChat
                  key={c.caso_id}
                  caseId={c.caso_id}
                  initialMessage={`Analiza el caso ${c.caso_id}`}
                />
              </div>
            )}
          </div>

          {/* Reanalyze */}
          <div className="space-y-2">
            <p className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>Nueva información</p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Nueva información (ej: usuario confirmó alergia)..."
                value={newInfo}
                onChange={(e) => setNewInfo(e.target.value)}
                className="input-surface flex-1 px-3 py-2 text-xs outline-none transition-all"
                onKeyDown={(e) => e.key === 'Enter' && handleReanalyze()}
              />
              <button
                onClick={handleReanalyze}
                disabled={!newInfo.trim() || reanalyzing}
                className="action-button flex items-center gap-1 px-3 py-2 text-xs font-bold transition-all"
                style={{
                  color: 'var(--text-muted)',
                  opacity: !newInfo.trim() || reanalyzing ? 0.5 : 1,
                }}
              >
                <RefreshCw size={12} className={reanalyzing ? 'animate-spin' : ''} />
                {reanalyzing ? 'Analizando...' : 'Reanalizar'}
              </button>
            </div>
          </div>

          {/* Location indicators */}
          <div className="flex gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
            <span className="flex items-center gap-1">
              <MapPin size={10} /> {c.ciudad}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={10} /> {c.tiempo_entrega_real_min} min entrega
            </span>
            {c.procesado_en && (
              <span>
                Procesado:{' '}
                {new Date(c.procesado_en).toLocaleString('es-MX', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
