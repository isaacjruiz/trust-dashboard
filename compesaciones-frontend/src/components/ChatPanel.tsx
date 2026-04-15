import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Bot, User, PanelRightClose, PanelRightOpen } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { ChatMessage } from '../types';

interface Props {
  messages: ChatMessage[];
  loading: boolean;
  onSendMessage: (msg: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const QUICK_ACTIONS = [
  'Dame los casos críticos',
  'Resumen ejecutivo',
  'Patrones de fraude',
  '¿Cuántos casos procesamos?',
];

const STATUS_COLORS: Record<string, string> = {
  RECHAZAR: '#ef4444',
  APROBAR: '#22c55e',
  ESCALAR: '#f59e0b',
};

/** Wrap bare RECHAZAR/APROBAR/ESCALAR (not already bold) so ReactMarkdown colors them */
function highlightKeywords(text: string): string {
  return text.replace(/(?<!\*)\b(RECHAZAR|APROBAR|ESCALAR)\b(?!\*)/g, '**$1**');
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div
        className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
        style={
          isUser
            ? {
                background: 'var(--primary)',
                color: '#fff',
                boxShadow: '0 10px 18px var(--primary-glow)',
              }
            : {
                background: 'var(--surface-muted)',
                color: 'var(--text-muted)',
                border: '1px solid var(--border)',
              }
        }
      >
        {isUser ? <User size={12} /> : <Bot size={12} />}
      </div>

      {/* Bubble */}
      <div
        className="max-w-[85%] px-3.5 py-2.5 text-xs leading-relaxed"
        style={
          isUser
            ? {
                background: 'var(--primary)',
                color: '#fff',
                borderRadius: '8px 4px 8px 8px',
                boxShadow: '0 12px 24px var(--primary-glow)',
                fontFamily: 'IBM Plex Sans, sans-serif',
              }
            : {
                background: 'var(--surface-elevated)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: '4px 8px 8px 8px',
                boxShadow: 'var(--small-shadow)',
                fontFamily: 'IBM Plex Sans, sans-serif',
              }
        }
      >
        {isUser ? (
          <p style={{ margin: 0 }}>{msg.content}</p>
        ) : (
          <ReactMarkdown
            components={{
              p: ({ children }) => <p style={{ margin: '0 0 4px 0' }}>{children}</p>,
              ul: ({ children }) => <ul style={{ paddingLeft: '16px', margin: '4px 0', listStyle: 'disc' }}>{children}</ul>,
              ol: ({ children }) => <ol style={{ paddingLeft: '16px', margin: '4px 0', listStyle: 'decimal' }}>{children}</ol>,
              li: ({ children }) => <li style={{ marginBottom: '2px' }}>{children}</li>,
              strong: ({ children }) => {
                const text = String(children);
                const color = STATUS_COLORS[text] ?? 'var(--primary)';
                return (
                  <strong
                    style={{
                      fontWeight: 700,
                      color,
                      ...(STATUS_COLORS[text]
                        ? {
                            background: `${color}22`,
                            padding: '1px 5px',
                            borderRadius: '4px',
                            border: `1px solid ${color}55`,
                          }
                        : {}),
                    }}
                  >
                    {children}
                  </strong>
                );
              },
              code: ({ children }) => (
                <code
                  style={{
                    background: 'var(--surface-muted)',
                    padding: '1px 5px',
                    borderRadius: '4px',
                    fontFamily: 'IBM Plex Sans, sans-serif',
                    fontSize: '11px',
                  }}
                >
                  {children}
                </code>
              ),
              pre: ({ children }) => (
                <pre
                  style={{
                    background: 'var(--surface-muted)',
                    padding: '8px',
                    borderRadius: '8px',
                    fontFamily: 'IBM Plex Sans, sans-serif',
                    fontSize: '11px',
                    overflowX: 'auto',
                    margin: '4px 0',
                  }}
                >
                  {children}
                </pre>
              ),
            }}
          >
            {highlightKeywords(msg.content)}
          </ReactMarkdown>
        )}
        <div
          className="text-xs mt-1"
          style={{ color: isUser ? 'rgba(255,255,255,0.6)' : 'var(--text-light)', fontSize: '10px' }}
        >
          {msg.timestamp.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-2.5">
      <div
        className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
        style={{
          background: 'var(--surface-muted)',
          border: '1px solid var(--border)',
        }}
      >
        <Bot size={12} style={{ color: 'var(--text-muted)' }} />
      </div>
      <div
        className="px-3.5 py-3 flex items-center gap-1.5"
        style={{
          background: 'var(--surface-elevated)',
          border: '1px solid var(--border)',
          borderRadius: '4px 8px 8px 8px',
          boxShadow: 'var(--small-shadow)',
        }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full animate-bounce"
            style={{ background: 'var(--primary)', animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </div>
    </div>
  );
}

export function ChatPanel({ messages, loading, onSendMessage, collapsed, onToggleCollapse }: Props) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    onSendMessage(trimmed);
    setInput('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (collapsed) {
    return (
      <div className="flex flex-col h-full items-center py-4 gap-3">
        <button
          onClick={onToggleCollapse}
          className="p-2 rounded-xl transition-colors"
          style={{ color: 'var(--text-muted)', background: 'var(--surface-muted)', border: '1px solid var(--border)' }}
          title="Abrir chat"
        >
          <PanelRightOpen size={15} />
        </button>
        <div
          className="w-2 h-2 rounded-full animate-pulse mt-1"
          style={{ background: 'var(--success)' }}
        />
        {/* Vertical label */}
        <span
          className="text-xs font-bold"
          style={{
            color: 'var(--text-muted)',
            writingMode: 'vertical-rl',
            textOrientation: 'mixed',
            letterSpacing: '0.05em',
            marginTop: '8px',
          }}
        >
          Chat
        </span>
        {loading && (
          <Loader2 size={12} className="animate-spin mt-auto mb-2" style={{ color: 'var(--primary)' }} />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center gap-2"
        style={{
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div
          className="w-2 h-2 rounded-full animate-pulse"
          style={{ background: 'var(--success)' }}
        />
        <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>
          Trust & Safety Agent
        </span>
        <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>
          · Claude
        </span>
        <button
          onClick={onToggleCollapse}
          className="ml-auto p-1.5 rounded-lg transition-colors"
          style={{ color: 'var(--text-muted)' }}
          title="Colapsar chat"
        >
          <PanelRightClose size={14} />
        </button>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
        style={{
          background: 'transparent',
        }}
      >
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}
        {loading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Quick actions */}
      {messages.length <= 1 && (
        <div
          className="px-4 py-2 flex flex-wrap gap-1.5"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action}
              onClick={() => onSendMessage(action)}
              disabled={loading}
              className="action-button text-xs px-3 py-1 font-bold transition-all"
              style={{
                color: 'var(--primary)',
                fontFamily: 'IBM Plex Sans, sans-serif',
                opacity: loading ? 0.4 : 1,
              }}
            >
              {action}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div
        className="px-4 pb-4 pt-2"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe un mensaje... (Enter para enviar)"
            rows={1}
            className="input-surface flex-1 px-3 py-2.5 text-xs resize-none outline-none transition-all"
            style={{
              minHeight: '40px',
              maxHeight: '120px',
            }}
            onInput={(e) => {
              const t = e.currentTarget;
              t.style.height = 'auto';
              t.style.height = `${Math.min(t.scrollHeight, 120)}px`;
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className={`action-button p-2.5 transition-all flex items-center justify-center ${input.trim() && !loading ? 'primary-button' : ''}`}
            style={{
              color: !input.trim() || loading ? 'var(--text-muted)' : '#fff',
              opacity: !input.trim() || loading ? 0.5 : 1,
            }}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
