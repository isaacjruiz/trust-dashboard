import { Info } from 'lucide-react';
import { useState, useRef, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  text: string;
  children?: ReactNode;
  iconSize?: number;
}

/**
 * Tooltip con position:fixed vía portal — escapa overflow:hidden de cualquier contenedor.
 * Usage:
 *   <InfoTooltip text="Explicación">Label</InfoTooltip>
 *   <InfoTooltip text="Explicación" />
 */
export function InfoTooltip({ text, children, iconSize = 11 }: Props) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const iconRef = useRef<HTMLSpanElement>(null);

  const show = useCallback(() => {
    if (!iconRef.current) return;
    const r = iconRef.current.getBoundingClientRect();
    setPos({ x: r.left + r.width / 2, y: r.top });
  }, []);

  const hide = useCallback(() => setPos(null), []);

  return (
    <span className="inline-flex items-center gap-1">
      {children}
      <span
        ref={iconRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        style={{ display: 'inline-flex', alignItems: 'center', cursor: 'help' }}
      >
        <Info size={iconSize} style={{ color: 'var(--text-light)', flexShrink: 0 }} />
      </span>

      {pos &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              left: pos.x,
              top: pos.y - 8,
              transform: 'translate(-50%, -100%)',
              zIndex: 9999,
              background: 'var(--surface-elevated)',
              border: '1px solid var(--border)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
              color: 'var(--text)',
              fontSize: '11px',
              fontWeight: 400,
              lineHeight: '1.5',
              padding: '7px 11px',
              borderRadius: '8px',
              maxWidth: '240px',
              whiteSpace: 'normal',
              pointerEvents: 'none',
            }}
          >
            {text}
          </div>,
          document.body
        )}
    </span>
  );
}
