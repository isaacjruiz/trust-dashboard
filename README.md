# Rappi Trust & Safety Agent

Agente inteligente que automatiza la revisión de compensaciones potencialmente fraudulentas. Dashboard interactivo + chat conversacional donde el agente de CS puede explorar casos, cuestionar decisiones y reanalizar con nueva evidencia.

## Entrega

- Repositorio: https://github.com/isaacjruiz/trust-dashboard
- App funcional: https://rappi-trust-frontend-3rus6fvyy-isaacs-projects-9c6bab35.vercel.app/
- Backend API: https://rappi-trust-agent-production.up.railway.app

La opción recomendada para revisar la solución es abrir la App funcional. El frontend está desplegado en Vercel y consume el backend desplegado en Railway.

## El problema

Un agente de CS tarda **15–25 minutos por caso** revisando manualmente señales de fraude. Con 150+ casos/día: 50 horas de trabajo humano, criterio inconsistente entre agentes, y fraudes que se cuelan.

## La solución

```
Sin IA:   150 casos × 20 min = 50 horas de trabajo humano
Con IA:   92 casos confirmados en 3 min
        + 58 casos escalados revisados en ~30 seg c/u
        = ~32 minutos total
```

El AI ya procesó todo. El agente CS llega a su turno y ve su **bandeja de trabajo**:

- **RECHAZAR / APROBAR** de alta confianza → confirma con un click
- **ESCALAR** → lee la acción sugerida (30 seg) y decide

## Stack

```
Backend:   Mastra (TypeScript) + Node.js
AI:        OpenAI GPT-5.4 mini via @ai-sdk/openai
Frontend:  React + Vite + TypeScript + Tailwind CSS
Datos:     In-memory store (Map) — producción usaría PostgreSQL
```

## Pipeline de decisión

```
CSV / webhook
     ↓
Enriquecimiento   → ratio_compensacion, frecuencia_normalizada, gps_score, etc.
     ↓
Risk scoring      → score 0–100 con 6 componentes ponderados
     ↓
Motor de reglas   → RECHAZAR (5 reglas) · APROBAR (1 regla) · ESCALAR (ambiguos)
     ↓
Análisis LLM      → solo ESCALAR: analiza descripción libre + genera accion_sugerida
     ↓
Output            → recomendacion · justificacion · senales_clave · accion_sugerida
```

El LLM solo procesa los ~40% de casos ambiguos. Los casos claros van directo por reglas determinísticas — esto mantiene la latencia baja y escala a 200+ casos/día sin costo proporcional de tokens.

## Decisiones de diseño

**1. Reglas determinísticas primero, LLM después**
El 60% de casos tienen señales inequívocas (4 flags de fraude, score >70, usuario de 19 días con 8 compensaciones). Para estos el LLM es costoso e innecesario. Las reglas los clasifican con confianza ALTA en milisegundos.

**2. GPS confirmada NO reduce el riesgo**
Contraintuitivo pero crítico: en el dataset, el 100% de los casos de fraude claro tienen GPS "SÍ confirmada". Los defraudadores sofisticados confirman la entrega. Los usuarios legítimos que no recibieron nada frecuentemente tienen GPS "NO confirmada". GPS confirmada es weight-neutral en el scoring.

**3. RECHAZAR con confianza BAJA → ESCALAR**
Si el LLM decide rechazar pero su propia confianza es BAJA, el sistema mantiene el caso como ESCALAR. Una duda del modelo es exactamente la definición de ambigüedad — el humano debe revisarlo, no auto-rechazarlo.

**4. Agente conversacional, no script**
El chat está embebido dentro del detalle del caso. El agente de CS puede preguntar "¿por qué?" sin perder el contexto de qué caso está revisando.

**5. Bandeja de trabajo, no panel de analytics**
El dashboard es para ejecutar decisiones rápido. Los APROBAR/RECHAZAR de alta confianza se confirman en batch. Los ESCALAR muestran la acción sugerida directo en la tabla, sin necesidad de abrir el detalle.

## Ejecutar el proyecto localmente

### Requisitos

- Node.js 22.13 o superior
- pnpm 10.x
- Variables de entorno para funcionalidad completa de IA:
  - `OPENAI_API_KEY`: análisis LLM de casos ambiguos
  - `TRUST_AGENT_MODEL`: modelo OpenAI opcional para el agente; default `gpt-5.4-mini`

Sin `OPENAI_API_KEY`, el motor determinístico y la UI pueden correr, pero las respuestas LLM quedan limitadas.

### Backend

```bash
cd compesaciones-agent
pnpm install
pnpm dev
```

El backend corre en `http://localhost:4111` y carga automáticamente `dataset.csv` al iniciar.

### Frontend

En otra terminal:

```bash
cd compesaciones-frontend
pnpm install
pnpm dev
```

El frontend corre en `http://localhost:5173` y conecta al backend local vía proxy Vite.

Para apuntar el frontend local al backend desplegado en Railway:

```bash
cd compesaciones-frontend
VITE_API_URL=https://rappi-trust-agent-production.up.railway.app pnpm dev
```

## Docker

El repositorio incluye `compesaciones-agent/Dockerfile` para desplegar el backend en Railway. Para revisión local, la ruta más directa es usar `pnpm install` y `pnpm dev` en cada carpeta como se indica arriba. No se requiere Docker para correr el frontend.

## Qué mejoraría con más tiempo

- Modelo supervisado entrenado con decisiones humanas históricas
- Integración real con Zendesk vía webhook
- A/B testing de políticas para optimizar umbrales por ciudad/vertical
- Multi-idioma (portugués para Brasil)
- Detección de copy-paste por embedding similarity de descripciones

## Archivos clave


| Archivo                                   | Descripción                                              |
| ----------------------------------------- | -------------------------------------------------------- |
| `POLICIES.md`                             | Criterios completos de decisión con ejemplos del dataset |
| `src/engine/rules.ts`                     | Motor de reglas determinístico                           |
| `src/engine/scoring.ts`                   | Cálculo del risk score                                   |
| `src/engine/policies.ts`                  | Umbrales y constantes centralizados                      |
| `src/mastra/workflows/case-processing.ts` | Pipeline completo de análisis                            |
| `src/mastra/agents/trust-agent.ts`        | Agente conversacional y sus tools                        |
