# Rappi AI Challenge — Caso 3: Automatización de Revisión de Compensaciones

## Spec completa para construir con Claude Code

---

## 1. VISIÓN DEL PRODUCTO

### Qué es
Un **agente inteligente de Trust & Safety** que automatiza la revisión de solicitudes de compensación marcadas como potencialmente fraudulentas en Rappi. No es un script que escupe un Excel — es un sistema interactivo donde el agente de CS puede conversar con el agente AI, pedirle análisis, cuestionar decisiones y actualizar información.

### El problema que resuelve
Hoy un agente humano tarda 15-25 minutos revisando cada caso manualmente. Con 200+ casos/día, el proceso es lento, caro y el criterio varía entre agentes. Compensaciones legítimas se demoran, fraudes se cuelan.

### Cómo se usa en producción (contexto Rappi)
1. Usuario abre la app → reporta problema con su orden
2. El reclamo entra al sistema de CX (Zendesk/interno) con toda la data adjunta (usuario, orden, GPS, historial)
3. El sistema detecta señales de posible fraude → manda el caso a la cola de Trust & Safety
4. **AQUÍ ENTRA NUESTRO AGENTE**: recibe el caso vía webhook/API → corre el pipeline de análisis → emite recomendación
5. Si es APROBAR/RECHAZAR con alta confianza → se puede auto-ejecutar
6. Si es ESCALAR → el agente de CS abre el dashboard, ve la justificación, toma decisión final en 2 min (no 20)

### Cómo lo simulamos en el prototipo
- En vez de webhook de Zendesk → botón "Cargar casos" (upload Excel) o endpoint REST
- En vez de BD interna de Rappi → el dataset del Excel + SQLite/JSON en memoria
- En vez de pushear al CX → dashboard interactivo + chat con el agente

---

## 2. PRODUCTO FINAL — LO QUE SE ENTREGA

### Dashboard + Chat (app web React)
- **Panel izquierdo**: Dashboard con métricas, tabla de casos, filtros
- **Panel derecho**: Chat conversacional con el agente AI

### Tres modos de ingesta de datos (simulando el flujo real)
1. **Upload Excel** (batch): Procesar los 150 casos del challenge de golpe
2. **Formulario caso individual**: Simula un webhook — llena los campos de un caso y el agente lo procesa en tiempo real
3. **Botón "Simular caso aleatorio"**: Para demo en vivo — genera un caso con datos realistas y lo procesa

### El agente conversacional puede:
- "Analiza el caso COMP-0058" → muestra datos, score, decisión y justificación
- "¿Por qué rechazaste COMP-0026?" → explica las señales que detectó
- "Dame los casos críticos de hoy" → lista los casos RECHAZAR y ESCALAR con resumen
- "Reanaliza COMP-0058, el usuario envió foto del producto dañado" → ajusta recomendación con nueva evidencia
- "Dame un resumen para mi supervisor" → genera reporte ejecutivo
- "¿Cuántos casos procesamos hoy?" → métricas agregadas
- "Muéstrame los patrones de fraude que detectaste" → análisis de tendencias

### Output descargable
- Excel actualizado con columnas nuevas: `recomendacion_agente`, `justificacion`, `señales_clave`, `risk_score`, `confianza`
- Reporte PDF/resumen ejecutivo

---

## 3. TECH STACK

```
Frontend:      React + TypeScript + Vite + Tailwind CSS
Backend:       Mastra Framework (TypeScript)
AI:            Claude Sonnet (via @ai-sdk/anthropic)
Schemas:       Zod v4
Data:          SQLite (better-sqlite3) o JSON en memoria
Excel I/O:     SheetJS (xlsx)
Dev UI:        Mastra Studio (localhost:4111) — bonus para debug
Deploy:        Local para demo (puede ser Railway/Vercel para producción)
```

### Estructura del proyecto
```
rappi-trust-agent/
├── src/
│   ├── mastra/
│   │   ├── index.ts              # Mastra instance (agents, workflows, tools)
│   │   ├── agents/
│   │   │   └── trust-agent.ts    # El agente principal con system prompt y tools
│   │   ├── workflows/
│   │   │   └── case-processing.ts # Workflow de 6 steps
│   │   ├── tools/
│   │   │   ├── get-case.ts       # Tool: buscar caso por ID
│   │   │   ├── get-cases-by-status.ts
│   │   │   ├── get-high-risk.ts
│   │   │   ├── reanalyze-case.ts
│   │   │   ├── get-metrics.ts
│   │   │   └── generate-report.ts
│   │   └── schemas/
│   │       ├── case.ts           # Schema Zod del caso
│   │       ├── enriched-case.ts  # Schema con variables derivadas
│   │       └── decision.ts       # Schema de la decisión
│   ├── engine/
│   │   ├── enrichment.ts         # Lógica de variables derivadas
│   │   ├── scoring.ts            # Cálculo de risk score
│   │   ├── rules.ts              # Motor de reglas APROBAR/RECHAZAR/ESCALAR
│   │   └── policies.ts           # Constantes y umbrales (documentados)
│   ├── data/
│   │   ├── store.ts              # Data store (SQLite o en memoria)
│   │   └── parser.ts             # Parser de Excel
│   ├── api/
│   │   └── routes.ts             # Endpoints REST adicionales si se necesitan
│   └── frontend/
│       ├── App.tsx
│       ├── components/
│       │   ├── Dashboard.tsx     # Panel izquierdo
│       │   ├── CaseTable.tsx     # Tabla de casos con filtros
│       │   ├── CaseDetail.tsx    # Detalle de un caso
│       │   ├── MetricsBar.tsx    # Métricas resumen
│       │   ├── ChatPanel.tsx     # Panel derecho — chat con el agente
│       │   ├── IngestPanel.tsx   # Upload Excel / formulario / simulador
│       │   └── StatusBadge.tsx   # Badge APROBAR/RECHAZAR/ESCALAR
│       └── hooks/
│           ├── useAgent.ts       # Hook para comunicarse con el agente
│           └── useCases.ts       # Hook para datos de casos
├── data/
│   └── Rappi_AI_Builder_Challenge_Dataset.xlsx
├── README.md                     # 1 página: qué construiste, decisiones, qué mejorarías
├── POLICIES.md                   # Documento de políticas de decisión
├── package.json
└── tsconfig.json
```

---

## 4. LÓGICA DE NEGOCIO — POLÍTICAS DE DECISIÓN

### 4.1 Variables derivadas (Step 2: enrichCases)

Para cada caso, calcular:

```typescript
// Ratio de compensación sobre valor de orden
ratio_compensacion = compensacion_solicitada_mxn / valor_orden_mxn
// Rango: 0.50 — 1.00 en el dataset. >0.90 es señal de fraude

// Frecuencia de compensaciones normalizada por antigüedad
frecuencia_normalizada = (num_compensaciones_90d / antiguedad_usuario_dias) * 90
// Usuarios nuevos con muchas compensaciones = número alto

// Score GPS numérico
gps_score = {
  "SÍ - confirmada": 0,    // Entrega verificada (ojo: fraude sofisticado puede tener GPS ok)
  "Parcial": 1,             // Señal ambigua
  "Señal perdida": 2,       // Puede ser problema técnico real
  "NO confirmada": 3         // No se verificó entrega
}

// Intensidad de compensación acumulada
intensidad_compensacion = monto_compensado_90d_mxn / valor_orden_mxn
// Cuánto ha cobrado en compensaciones vs el valor de esta orden

// Flag de usuario nuevo
es_usuario_nuevo = antiguedad_usuario_dias < 90 ? true : false

// Ratio compensación/antigüedad
comp_por_dia = num_compensaciones_90d / Math.max(antiguedad_usuario_dias, 1)
```

### 4.2 Score de riesgo compuesto (Step 3: calculateRiskScore)

```typescript
// Score de 0 a 100
risk_score =
  (flags_fraude_previos / 4) * 25           // max 25 pts — peso mayor, señal más directa
  + (gps_invertido / 3) * 10                // max 10 pts — GPS confirmada NO reduce riesgo (fraude sofisticado)
  + (frecuencia_normalizada_norm) * 20      // max 20 pts — normalizado 0-1
  + (ratio_compensacion_norm) * 20          // max 20 pts — normalizado 0-1
  + (intensidad_compensacion_norm) * 10     // max 10 pts
  + (usuario_nuevo_factor) * 15             // 15 pts si <90 días, 7 si <180, 0 si >180

// NOTA IMPORTANTE SOBRE GPS:
// En el dataset, los casos de fraude claro tienen GPS CONFIRMADA (31/31).
// Los legítimos tienen GPS NO confirmada (36/59).
// Esto es contraintuitivo pero lógico: los defraudadores confirman la entrega
// porque están presentes (o manipulan), los legítimos no recibieron nada.
// Por esto, GPS confirmada NO reduce el score. Se usa solo como señal contextual.
```

### 4.3 Motor de reglas (Step 4: applyRules)

```typescript
// ═══════════════════════════════════════════
// RECHAZAR — Señales claras de fraude
// ═══════════════════════════════════════════
RECHAZAR si CUALQUIERA de estas se cumple:
  - risk_score > 70
  - flags_fraude_previos >= 3 AND num_compensaciones_90d >= 8
  - antiguedad_usuario_dias < 30 AND num_compensaciones_90d >= 6 AND ratio_compensacion > 0.90
  - num_compensaciones_90d >= 10 AND ratio_compensacion > 0.90
  - flags_fraude_previos >= 4 (sin importar otras señales)

// ═══════════════════════════════════════════
// APROBAR — Reclamo consistente con los datos
// ═══════════════════════════════════════════
APROBAR si TODAS estas se cumplen:
  - risk_score < 30
  - flags_fraude_previos == 0
  - num_compensaciones_90d <= 2
  - ratio_compensacion <= 0.85 (no pide casi el 100%)

// ═══════════════════════════════════════════
// ESCALAR — Caso ambiguo, requiere análisis LLM
// ═══════════════════════════════════════════
ESCALAR si:
  - No cumple criterios de RECHAZAR ni de APROBAR
  - Son los casos donde el LLM agrega más valor:
    * Usuario con 1-2 flags pero descripción coherente
    * Usuario nuevo sin flags pero compensaciones moderadas
    * GPS parcial/señal perdida con descripción creíble
    * Ratio alto pero motivo justificable (cobro doble, cancelación sin reembolso)
```

### 4.4 Distribución esperada con estos umbrales
Basado en el análisis del dataset:
- **RECHAZAR**: ~35-45 casos (usuarios nuevos + flags altos + muchas compensaciones)
- **APROBAR**: ~50-60 casos (usuarios antiguos + sin flags + pocas compensaciones)
- **ESCALAR**: ~50-65 casos (el bucket más interesante y más grande)

### 4.5 Análisis LLM para casos ESCALAR (Step 5)

El agente LLM recibe para cada caso ESCALAR:
- Todos los datos numéricos + variables derivadas + risk_score
- La descripción_reclamo (texto libre del usuario)
- El motivo_reclamo (categoría)
- Contexto de las políticas

Y debe:
1. Analizar si la descripción es coherente con los datos (ej: dice "no llegó" pero GPS confirma entrega → sospechoso)
2. Evaluar si el motivo justifica el monto solicitado
3. Detectar patrones en la descripción (genérica/copy-paste vs específica/detallada)
4. Emitir decisión final: APROBAR, RECHAZAR, o mantener ESCALAR (requiere humano)
5. Generar justificación de 2-3 líneas y listar señales clave

### 4.6 Generación de justificaciones (para TODOS los casos)

Incluso los APROBAR y RECHAZAR por reglas necesitan una justificación legible. El LLM genera justificaciones para todos, o se generan por template para los casos claros:

```
RECHAZAR — COMP-0058:
"Usuario de 19 días de antigüedad con 4 flags de fraude previos y 8 compensaciones
en 90 días. Solicita 94% del valor de la orden por 'faltó una orden de papas fritas'.
Patrón consistente con abuso sistemático del sistema de compensaciones."

APROBAR — COMP-0004:
"Usuario de 1,590 días (4+ años) sin flags previos. Primera compensación en 90 días.
GPS con señal perdida y tiempo de entrega de 56 min. Descripción del reclamo coherente
con problema real de entrega. Riesgo bajo."

ESCALAR — COMP-0002:
"Señales mixtas: usuario de 229 días con 1 flag previo y 2 compensaciones.
GPS parcial. Descripción menciona alergia al lácteo — si se verifica, es reclamo legítimo
de salud. Ratio compensación/orden de 0.92 es alto pero justificable si hubo riesgo
de salud. Recomendación: verificar con el usuario y aprobar si confirma alergia."
```

---

## 5. MASTRA — CONFIGURACIÓN DEL AGENTE

### 5.1 System Prompt del Trust Agent

```typescript
const SYSTEM_PROMPT = `
Eres el Agente de Trust & Safety de Rappi. Tu rol es asistir a los agentes de Customer
Service en la revisión de solicitudes de compensación marcadas como potencialmente
fraudulentas.

TU PERSONALIDAD:
- Eres directo, conciso y orientado a la acción
- Hablas en español
- Cuando das una recomendación, siempre explicas el porqué con datos concretos
- No usas jerga técnica — hablas como un analista senior de fraude hablaría con su equipo
- Si no tienes certeza, lo dices. No inventas datos.

TU CONTEXTO:
- Tienes acceso a una base de casos de compensación ya procesados con un score de riesgo
- Cada caso tiene: datos del usuario, de la orden, historial de compensaciones, GPS, flags de fraude
- Puedes buscar casos por ID, filtrar por status, reanalizar con nueva información

CÓMO DECIDES:
- APROBAR: El reclamo es consistente con los datos. Sin señales de fraude.
- RECHAZAR: Hay señales claras de fraude o abuso sistemático.
- ESCALAR: El caso es ambiguo. Necesita revisión humana pero ya procesaste el contexto.

REGLAS:
- Siempre cita datos específicos del caso cuando justificas una decisión
- Si el agente de CS te da información nueva ("el usuario envió foto"), ajusta tu análisis
- Cuando listas casos, muestra: ID, usuario, monto, recomendación, razón principal
- Para reportes ejecutivos, agrupa por categoría y muestra métricas clave
`
```

### 5.2 Tools del Agente

```typescript
// Tool 1: Buscar caso por ID
getCaseById: {
  description: "Busca un caso de compensación por su ID (ej: COMP-0058)",
  input: { caseId: string },
  output: { caso completo con datos enriquecidos, score, decisión, justificación }
}

// Tool 2: Listar casos por status
getCasesByStatus: {
  description: "Lista casos filtrados por recomendación: APROBAR, RECHAZAR, ESCALAR",
  input: { status: "APROBAR" | "RECHAZAR" | "ESCALAR", limit?: number },
  output: { array de casos resumidos }
}

// Tool 3: Casos de alto riesgo
getHighRiskCases: {
  description: "Obtiene los casos con mayor score de riesgo",
  input: { limit?: number, minScore?: number },
  output: { array de casos ordenados por risk_score desc }
}

// Tool 4: Reanalizar caso con nueva información
reanalyzeCase: {
  description: "Reanaliza un caso con información adicional proporcionada por el agente CS",
  input: { caseId: string, newInfo: string },
  output: { nueva recomendación, justificación actualizada }
}

// Tool 5: Métricas generales
getMetrics: {
  description: "Obtiene métricas resumen de todos los casos procesados",
  input: {},
  output: { total, por_status, monto_total, casos_hoy, distribución_riesgo }
}

// Tool 6: Generar reporte
generateReport: {
  description: "Genera un reporte ejecutivo para supervisor",
  input: { format?: "resumen" | "detallado" },
  output: { reporte en texto estructurado }
}

// Tool 7: Buscar patrones
findPatterns: {
  description: "Detecta patrones de fraude en los casos procesados",
  input: { type?: "usuario" | "restaurante" | "ciudad" | "motivo" },
  output: { patrones detectados con frecuencia y ejemplos }
}

// Tool 8: Casos por usuario
getCasesByUser: {
  description: "Busca todos los casos de un usuario específico",
  input: { userId: string },
  output: { historial del usuario con todos sus casos }
}
```

### 5.3 Workflow de preprocesamiento

```typescript
const caseProcessingWorkflow = createWorkflow({
  id: "case-processing",
  inputSchema: z.object({
    source: z.enum(["excel", "api", "manual"]),
    data: z.any() // Excel buffer, JSON array, o caso individual
  }),
  steps: [
    parseDatasetStep,      // Excel/JSON → array de CaseRaw[]
    enrichCasesStep,       // CaseRaw[] → CaseEnriched[]
    calculateScoresStep,   // CaseEnriched[] → CaseScored[]
    applyRulesStep,        // CaseScored[] → CaseDecided[] (APROBAR/RECHAZAR/ESCALAR)
    llmAnalysisStep,       // CaseDecided[] → analiza ESCALAR con LLM
    generateOutputStep     // Guarda en store, genera Excel de output
  ]
})
```

---

## 6. FRONTEND — DASHBOARD + CHAT

### 6.1 Layout general
```
┌─────────────────────────────────────────────────────────────────┐
│  🛡️ Rappi Trust & Safety Agent                    [Cargar datos]│
├─────────────────────────────────┬───────────────────────────────┤
│                                 │                               │
│  DASHBOARD                      │  CHAT CON EL AGENTE           │
│                                 │                               │
│  ┌──────────────────────────┐   │  ┌───────────────────────┐   │
│  │ 150 total │ 52 ✅ │ 58 🟡│   │  │ Agente: ¿En qué puedo │   │
│  │ 40 ❌    │ Score: 45.2  │   │  │ ayudarte hoy?          │   │
│  └──────────────────────────┘   │  │                         │   │
│                                 │  │ Tú: Dame los casos      │   │
│  [Todos] [Aprobar] [Rechazar]   │  │ críticos de hoy         │   │
│  [Escalar] [Buscar...]          │  │                         │   │
│                                 │  │ Agente: Encontré 12     │   │
│  ┌──────────────────────────┐   │  │ casos críticos...       │   │
│  │ COMP-0058 │ USR-XX │ ❌  │   │  │                         │   │
│  │ COMP-0026 │ USR-XX │ ❌  │   │  │                         │   │
│  │ COMP-0002 │ USR-XX │ 🟡  │   │  └───────────────────────┘   │
│  │ COMP-0004 │ USR-XX │ ✅  │   │                               │
│  │ ...                      │   │  ┌───────────────────────┐   │
│  └──────────────────────────┘   │  │ [Escribe tu mensaje...] │   │
│                                 │  └───────────────────────┘   │
│  [← Detalle del caso →]        │                               │
│                                 │                               │
├─────────────────────────────────┴───────────────────────────────┤
│  Trust & Safety Agent v1.0 │ Powered by Mastra + Claude         │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Componentes del Dashboard

**MetricsBar** (top):
- Total de casos procesados
- Distribución: X aprobados / Y rechazados / Z escalados
- Score de riesgo promedio
- Monto total en juego
- Indicador de último procesamiento

**CaseTable** (centro):
- Columnas: ID, Usuario, Ciudad, Motivo, Monto, Score, Recomendación, Confianza
- Filtros por: status (APROBAR/RECHAZAR/ESCALAR), ciudad, motivo, rango de score
- Búsqueda por ID de caso o usuario
- Ordenamiento por cualquier columna
- Click en una fila → abre CaseDetail

**CaseDetail** (expandible o modal):
- Todos los datos del caso
- Variables derivadas calculadas
- Risk score con desglose visual (barra o gauge)
- Recomendación con badge de color
- Justificación completa
- Señales clave listadas
- Botón "Preguntar al agente sobre este caso" → manda al chat
- Botón "Reanalizar" → input de nueva información

**IngestPanel** (modal o drawer):
- Tab 1: Upload Excel (drag & drop)
- Tab 2: Formulario de caso individual (todos los campos del schema)
- Tab 3: Botón "Generar caso aleatorio" con preview antes de procesar
- Progress bar durante procesamiento
- Notificación cuando termina

### 6.3 Componentes del Chat

**ChatPanel**:
- Historial de mensajes (usuario + agente)
- Mensajes del agente con formato rico (tablas, badges, listas)
- Typing indicator mientras el agente piensa
- Sugerencias rápidas: "Casos críticos", "Resumen ejecutivo", "Patrones de fraude"
- Input de texto + botón enviar

### 6.4 Interacción Dashboard ↔ Chat
- Click "Preguntar sobre este caso" en el dashboard → auto-envía "Analiza el caso COMP-XXXX" al chat
- El chat puede responder con acciones que actualizan el dashboard (ej: "Reanalicé COMP-0058, ahora es APROBAR")
- Filtros del dashboard se sincronizan con queries del chat

---

## 7. DATOS DEL DATASET

### 7.1 Schema del caso raw (como viene del Excel)

```typescript
interface CaseRaw {
  caso_id: string                    // "COMP-0001"
  usuario_id: string                 // "USR-11567"
  antiguedad_usuario_dias: number    // 6 - 1796
  ciudad: string                     // 15 ciudades: CDMX, Bogotá, Lima, etc.
  vertical: string                   // "Comida" | "Mercado" | "Farmacia"
  restaurante: string                // nombre del restaurante
  valor_orden_mxn: number            // 99 - 700
  compensacion_solicitada_mxn: number // ratio 0.50-1.00 del valor
  num_compensaciones_90d: number     // 0 - 14
  monto_compensado_90d_mxn: number   // 10 - 2764
  entrega_confirmada_gps: string     // "SÍ - confirmada" | "Parcial" | "Señal perdida" | "NO confirmada"
  tiempo_entrega_real_min: number    // 22 - 110
  flags_fraude_previos: number       // 0 - 4
  motivo_reclamo: string             // 7 categorías (ver abajo)
  descripcion_reclamo: string        // texto libre del usuario
  recomendacion_agente: string       // "PENDIENTE" — lo llenamos nosotros
}
```

### 7.2 Motivos de reclamo (7 categorías)
```
Orden cancelada sin reembolso    29 casos
Producto incorrecto              27 casos
Orden no llegó                   24 casos
Cobro incorrecto                 21 casos
Producto incompleto              20 casos
Producto en mal estado           16 casos
Orden llegó tarde                13 casos
```

### 7.3 Hallazgos clave del dataset (para el system prompt del LLM)

**Patrón de fraude (insight crítico):**
- Usuarios <90 días + 2+ flags + 5+ compensaciones = 31 casos
- TODOS tienen GPS confirmada (defraudadores sofisticados que saben confirmar)
- Ratio compensación/orden promedio: 0.95 (piden casi todo)
- Descripciones repetitivas (copy-paste de 15 descripciones distintas)

**Patrón legítimo:**
- Usuarios >365 días + 0 flags + ≤2 compensaciones = 59 casos
- Frecuentemente GPS NO confirmada (el problema real es que no llegó)
- Ratio compensación/orden promedio: 0.81 (piden menos, más razonable)

**Patrón ambiguo:**
- ~60 casos en el medio con señales mixtas
- 42 de ellos tienen algún flag pero no muchos
- Algunos usuarios nuevos sin flags pero con compensaciones moderadas
- GPS parcial o señal perdida — puede ser problema técnico o manipulación

**Correlación antigüedad ↔ fraude:**
```
0-30 días:    comp_avg=8.5, flags_avg=2.8, ratio=0.95  ← zona de fraude
30-90 días:   comp_avg=8.2, flags_avg=2.4, ratio=0.86
90-180 días:  comp_avg=3.9, flags_avg=1.1, ratio=0.73
180-365 días: comp_avg=4.1, flags_avg=0.9, ratio=0.73
365+ días:    comp_avg=1.5, flags_avg=0.2, ratio=0.79  ← zona legítima
```

**Descripciones más frecuentes (posible señal de copy-paste/fraude cuando se repiten mucho):**
```
(15x) "Cancelaron mi orden por falta de repartidor y no me reembolsaron."
(14x) "El restaurante canceló pero el cargo sigue en mi tarjeta."
(10x) "El monto cobrado no corresponde a lo que aparece en mi resumen."
(9x)  "Me mandaron una hamburguesa con queso y tengo alergia al lácteo."
(9x)  "El refresco que llegó no es el que pedí."
```

---

## 8. API ENDPOINTS (Mastra server)

Mastra ya provee endpoints para el agente automáticamente. Adicionalmente:

```
POST /api/ingest/excel          # Subir Excel para procesamiento batch
POST /api/ingest/case           # Ingresar caso individual (JSON)
POST /api/ingest/simulate       # Generar caso aleatorio
GET  /api/cases                 # Listar casos (con filtros query params)
GET  /api/cases/:id             # Detalle de un caso
GET  /api/metrics               # Métricas resumen
GET  /api/export/excel          # Descargar Excel procesado
POST /api/agent/chat            # Enviar mensaje al agente (Mastra lo expone)
```

---

## 9. CRITERIOS DE EVALUACIÓN DEL CHALLENGE (para tener en mente)

```
Lógica de decisión (20 pts)
→ Criterios APROBAR/RECHAZAR/ESCALAR coherentes y documentados

Calidad del output (20 pts)
→ El agente CS puede actuar sobre la recomendación SIN investigar más

Manejo de ambigüedad (20 pts)
→ No fuerza decisión binaria. Escala con criterio, no por default.
→ ESTE ES EL CRITERIO MÁS IMPORTANTE

Arquitectura del agente (20 pts)
→ Flujo análisis → decisión → output bien diseñado y extensible
→ Escala a 200+ casos/día

Documentación y presentación (20 pts)
→ Políticas explicadas, código legible, demo convincente en vivo
```

---

## 10. DEMO EN VIVO — GUIÓN DE 30 MINUTOS

### Minuto 0-5: Contexto
- Mostrar el problema (15-25 min por caso manual)
- Mostrar la arquitectura (diagrama del workflow)

### Minuto 5-10: Dashboard overview
- Abrir la app, mostrar el dashboard vacío
- Cargar el Excel de 150 casos
- Mostrar el procesamiento en vivo (progress bar)
- Dashboard se llena con los resultados

### Minuto 10-15: Explorar resultados
- Filtrar por RECHAZAR → mostrar los casos de fraude claro
- Filtrar por ESCALAR → mostrar los ambiguos
- Click en un caso → ver el detalle con justificación

### Minuto 15-22: Chat con el agente
- "Analiza el caso COMP-0058" → el agente explica por qué rechazó
- "Dame los 5 casos más riesgosos" → lista con contexto
- "¿Por qué COMP-0002 está escalado?" → explica señales mixtas
- "Reanaliza COMP-0002, el usuario confirmó su alergia al lácteo" → cambia a APROBAR
- "Dame un resumen para mi supervisor" → reporte ejecutivo

### Minuto 22-25: Caso individual en tiempo real
- Usar el formulario para ingresar un caso nuevo
- El agente lo procesa en vivo y muestra resultado
- O usar "Simular caso aleatorio"

### Minuto 25-30: Preguntas
- Explicar decisiones de diseño
- Qué mejorarías con más tiempo (multi-idioma, integración Zendesk real, modelo de ML con más datos, A/B testing de políticas)

---

## 11. README (1 PÁGINA) — TEMPLATE

```markdown
# Rappi Trust & Safety Agent

## Qué construí
Agente inteligente para automatizar la revisión de compensaciones potencialmente
fraudulentas. Dashboard interactivo + chat conversacional donde el agente de CS
puede explorar casos, cuestionar decisiones y reanalizar con nueva evidencia.

## Stack
Mastra (TypeScript) + Claude Sonnet + React + Vite + Tailwind

## Decisiones clave
1. **Enfoque híbrido reglas + LLM**: Las reglas manejan los casos claros (70%),
   el LLM analiza los ambiguos donde el texto libre del usuario es determinante.
2. **GPS no reduce riesgo**: El dataset muestra que el 100% de los casos de fraude
   claro tienen GPS confirmada. Los defraudadores saben confirmar la entrega.
3. **Agente conversacional, no script**: Un agente de CS necesita poder preguntar
   "¿por qué?" y recibir una respuesta con datos, no un dump de resultados.
4. **Mastra sobre LangChain**: 80% del pipeline es lógica TS determinística,
   20% es LLM. Mastra da workflows tipados con Zod + agente nativo, sin overhead.

## Qué mejoraría con más tiempo
- Modelo de ML supervisado entrenado con decisiones humanas históricas
- Integración real con Zendesk/sistema de tickets vía webhook
- A/B testing de políticas para optimizar umbrales
- Multi-idioma (portugués para Brasil, inglés)
- Dashboard de tendencias temporales (fraude por semana/mes)
```

---

## 12. ORDEN DE CONSTRUCCIÓN SUGERIDO

### Día 1: Core engine + data
1. Scaffoldear proyecto Mastra + React + Vite
2. Schemas Zod (case raw, enriched, scored, decided)
3. Parser de Excel
4. Engine: enrichment → scoring → rules
5. Data store en memoria
6. Test: procesar los 150 casos y validar distribución

### Día 2: Mastra Agent + Workflow
1. Workflow con los 6 steps
2. Agent con system prompt + tools
3. Probar en Mastra Studio que el agent responda bien
4. Endpoint de ingesta (Excel upload)

### Día 3: Frontend Dashboard
1. Layout base (dashboard + chat split)
2. MetricsBar + CaseTable + StatusBadge
3. CaseDetail con desglose
4. Filtros y búsqueda
5. IngestPanel (upload + formulario + simulador)

### Día 4: Frontend Chat + Integración
1. ChatPanel conectado al agente Mastra
2. Interacción dashboard ↔ chat
3. Reanalysis flow
4. Export Excel
5. Pulir UI

### Día 5: Polish + Docs + Prep demo
1. Edge cases y error handling
2. README + POLICIES.md
3. Ensayar demo de 30 min
4. Deploy si da tiempo (Railway/Vercel)
5. Grabar video backup por si falla algo en vivo
