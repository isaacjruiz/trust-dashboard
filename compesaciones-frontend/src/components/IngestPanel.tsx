import { useState, useRef } from 'react';
import { Upload, Wand2, FileText, X, CheckCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  onUploadCSV: (csv: string) => Promise<void>;
  onSimulate: () => Promise<unknown>;
  onIngestCase: (caseData: Record<string, unknown>) => Promise<unknown>;
  onClose: () => void;
  processing: boolean;
}

type Tab = 'upload' | 'simulate' | 'manual';

const createEmptyForm = () => ({
  caso_id: `COMP-MANUAL-${Date.now()}`,
  usuario_id: '',
  antiguedad_usuario_dias: '',
  ciudad: 'CDMX',
  vertical: 'Comida',
  restaurante: '',
  valor_orden_mxn: '',
  compensacion_solicitada_mxn: '',
  num_compensaciones_90d: '',
  monto_compensado_90d_mxn: '',
  entrega_confirmada_gps: 'SÍ - confirmada',
  tiempo_entrega_real_min: '',
  flags_fraude_previos: '',
  motivo_reclamo: 'Orden no llegó',
  descripcion_reclamo: '',
});

const TABS: { key: Tab; icon: React.ReactNode; label: string }[] = [
  { key: 'upload', icon: <Upload size={13} />, label: 'Subir CSV' },
  { key: 'simulate', icon: <Wand2 size={13} />, label: 'Caso aleatorio' },
  { key: 'manual', icon: <FileText size={13} />, label: 'Manual' },
];

export function IngestPanel({ onUploadCSV, onSimulate, onIngestCase, onClose, processing }: Props) {
  const [tab, setTab] = useState<Tab>('upload');
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [csvContent, setCSVContent] = useState<string | null>(null);
  const [form, setForm] = useState(createEmptyForm);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.name.endsWith('.csv') && !file.name.endsWith('.txt')) {
      toast.error('Por favor sube un archivo CSV');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setCSVContent(e.target?.result as string);
      setFileName(file.name);
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleUpload = async () => {
    if (!csvContent) return;
    setSubmitting(true);
    try {
      await onUploadCSV(csvContent);
      toast.success('Casos agregados. Analizando...');
      onClose();
    } catch {
      toast.error('Error al cargar el CSV');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSimulate = async () => {
    setSubmitting(true);
    try {
      await onSimulate();
      toast.success('Caso agregado. Analizando...');
      onClose();
    } catch {
      toast.error('Error al simular caso');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.42)', backdropFilter: 'blur(5px)' }}
        onClick={onClose}
      />

      {/* Card */}
      <div
        className="dashboard-panel relative w-full max-w-lg overflow-hidden"
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface-solid)',
          }}
        >
          <h2 className="text-sm font-bold" style={{ color: 'var(--text)' }}>
            Cargar datos
          </h2>
          <button
            onClick={onClose}
            className="action-button p-1.5 transition-all"
            style={{
              color: 'var(--text-muted)',
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Tabs */}
        <div
          className="control-surface flex mx-5 my-3 p-1 gap-1"
        >
          {TABS.map(({ key, icon, label }) => {
            const isActive = tab === key;
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all"
                style={{
                  background: isActive ? 'var(--primary)' : 'transparent',
                  color: isActive ? '#fff' : 'var(--text-muted)',
                  boxShadow: isActive ? 'var(--small-shadow)' : 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'IBM Plex Sans, sans-serif',
                }}
              >
                {icon}{label}
              </button>
            );
          })}
        </div>

        <div className="px-5 pb-5">
          {/* Upload tab */}
          {tab === 'upload' && (
            <div className="space-y-4">
              <div
                className="rounded-2xl p-8 text-center cursor-pointer transition-all"
                style={{
                  background: 'var(--surface)',
                  boxShadow: dragging
                    ? `0 0 0 3px var(--primary-glow)`
                    : fileName
                    ? '0 0 0 3px var(--success-bg)'
                    : 'var(--small-shadow)',
                  border: dragging
                    ? '2px dashed var(--primary)'
                    : fileName
                    ? '2px dashed var(--success)'
                    : '2px dashed var(--shadow-dark)',
                }}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  const f = e.dataTransfer.files[0];
                  if (f) handleFile(f);
                }}
                onClick={() => fileRef.current?.click()}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                />
                {fileName ? (
                  <>
                    <CheckCircle size={32} className="mx-auto mb-2" style={{ color: 'var(--success)' }} />
                    <p className="text-sm font-bold" style={{ color: 'var(--success)' }}>{fileName}</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Listo para procesar</p>
                  </>
                ) : (
                  <>
                    <Upload size={32} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
                    <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>
                      Arrastra tu CSV aquí o haz click
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-light)' }}>
                      Formato: CSV con los campos del dataset
                    </p>
                  </>
                )}
              </div>
              <button
                onClick={handleUpload}
                disabled={!csvContent || submitting || processing}
                className="action-button primary-button w-full py-2.5 text-xs font-bold flex items-center justify-center gap-2 transition-all"
                style={{
                  opacity: !csvContent || submitting || processing ? 0.5 : 1,
                }}
              >
                {(submitting || processing) && <Loader2 size={13} className="animate-spin" />}
                {submitting || processing ? 'Procesando...' : 'Procesar CSV'}
              </button>
            </div>
          )}

          {/* Simulate tab */}
          {tab === 'simulate' && (
            <div className="space-y-4 text-center py-4">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
                style={{
                  background: 'var(--primary-light)',
                  border: '1px solid var(--border)',
                }}
              >
                <Wand2 size={28} style={{ color: 'var(--primary)' }} />
              </div>
              <div>
                <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--text)' }}>
                  Generar caso aleatorio
                </h3>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Genera un caso con datos realistas y lo procesa en tiempo real.
                  Ideal para demos en vivo.
                </p>
              </div>
              <button
                onClick={handleSimulate}
                disabled={submitting}
                className="action-button primary-button w-full py-2.5 text-xs font-bold flex items-center justify-center gap-2 transition-all"
                style={{
                  opacity: submitting ? 0.5 : 1,
                }}
              >
                {submitting && <Loader2 size={13} className="animate-spin" />}
                {submitting ? 'Generando...' : 'Generar y procesar caso'}
              </button>
            </div>
          )}

          {/* Manual tab */}
          {tab === 'manual' && (
            <form
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                setSubmitting(true);
                try {
                  const data = {
                    ...form,
                    antiguedad_usuario_dias: Number(form.antiguedad_usuario_dias),
                    valor_orden_mxn: Number(form.valor_orden_mxn),
                    compensacion_solicitada_mxn: Number(form.compensacion_solicitada_mxn),
                    num_compensaciones_90d: Number(form.num_compensaciones_90d),
                    monto_compensado_90d_mxn: Number(form.monto_compensado_90d_mxn),
                    tiempo_entrega_real_min: Number(form.tiempo_entrega_real_min),
                    flags_fraude_previos: Number(form.flags_fraude_previos),
                  };
                  await onIngestCase(data);
                  setForm(createEmptyForm());
                  toast.success('Caso agregado. Analizando...');
                  onClose();
                } catch {
                  toast.error('Error al procesar caso');
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                {([
                  ['usuario_id', 'Usuario ID'],
                  ['antiguedad_usuario_dias', 'Antigüedad (días)'],
                  ['restaurante', 'Restaurante'],
                  ['valor_orden_mxn', 'Valor orden (MXN)'],
                  ['compensacion_solicitada_mxn', 'Comp. solicitada (MXN)'],
                  ['num_compensaciones_90d', 'Comp. en 90 días'],
                  ['monto_compensado_90d_mxn', 'Monto comp. 90d'],
                  ['tiempo_entrega_real_min', 'Tiempo entrega (min)'],
                  ['flags_fraude_previos', 'Flags fraude'],
                ] as const).map(([key, label]) => (
                  <div key={key}>
                    <label
                      className="text-xs font-bold block mb-1"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {label}
                    </label>
                    <input
                      type="text"
                      value={(form as Record<string, string>)[key]}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                      className="input-surface w-full px-2.5 py-1.5 text-xs"
                      style={{ fontSize: '11px' }}
                    />
                  </div>
                ))}
                <div className="col-span-2">
                  <label
                    className="text-xs font-bold block mb-1"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Descripción del reclamo
                  </label>
                  <textarea
                    rows={2}
                    value={form.descripcion_reclamo}
                    onChange={(e) => setForm((f) => ({ ...f, descripcion_reclamo: e.target.value }))}
                    className="input-surface w-full px-2.5 py-1.5 text-xs resize-none"
                    style={{ fontSize: '11px' }}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="action-button primary-button w-full py-2.5 text-xs font-bold flex items-center justify-center gap-2 transition-all"
                style={{
                  opacity: submitting ? 0.5 : 1,
                }}
              >
                {submitting && <Loader2 size={13} className="animate-spin" />}
                {submitting ? 'Procesando...' : 'Procesar caso'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
