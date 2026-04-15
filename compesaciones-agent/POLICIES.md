# Políticas de Decisión — Rappi Trust & Safety Agent

Este documento describe los criterios que usa el agente para clasificar cada solicitud de compensación como **APROBAR**, **RECHAZAR** o **ESCALAR**.

---

## Pipeline de decisión

```
CSV / formulario
      ↓
1. Enriquecimiento   → variables derivadas (ratio, frecuencia, GPS score, etc.)
      ↓
2. Risk scoring      → score de 0 a 100 con 6 componentes ponderados
      ↓
3. Motor de reglas   → RECHAZAR (5 reglas) · APROBAR (1 regla) · ESCALAR (resto)
      ↓
4. Análisis LLM      → solo para casos ESCALAR: analiza descripción libre + contexto
      ↓
Output: recomendacion · justificacion · senales_clave · confianza · accion_sugerida
```

---

## Componentes del Risk Score (0–100 pts)

| Componente | Peso | Lógica |
|---|---|---|
| `flags_fraude_previos` | 25 pts | `(flags / 4) * 25` |
| GPS | 10 pts | `(gps_score / 3) * 10` — score 0–3 según confirmación |
| Frecuencia normalizada | 20 pts | `(comp_90d / antiguedad_dias) * 90`, clamped a 1.0 |
| Ratio compensación/orden | 20 pts | `(ratio - 0.50) / 0.50`, clamped a 1.0 |
| Intensidad acumulada | 10 pts | `monto_compensado_90d / valor_orden`, clamped a 5.0 |
| Usuario nuevo | 15/7/0 pts | <90 días = 15, 90–180 días = 7, >180 días = 0 |

**Umbrales:**
- Score > 70 → zona de RECHAZAR
- Score < 30 → zona de APROBAR
- Score 30–70 → zona de ESCALAR (análisis LLM)

---

## Insight crítico: GPS confirmada ≠ legítimo

En el dataset, el **100% de los casos de fraude claro** tienen GPS "SÍ - confirmada". Los defraudadores sofisticados confirman la entrega porque están presentes o manipulan el sistema — luego reclaman que el pedido estaba mal.

Los usuarios legítimos con problemas reales frecuentemente tienen GPS "NO confirmada" porque el repartidor no llegó.

**Por esto:** GPS confirmada es weight-neutral (score = 0). No reduce ni aumenta el riesgo. Se usa como señal contextual en el análisis LLM, no en el scoring.

---

## Reglas de RECHAZAR (confianza ALTA)

Las reglas determinísticas se aplican antes del LLM. Si cualquiera se cumple → RECHAZAR directo.

### Regla 1: Flags absolutos
```
flags_fraude_previos >= 4
```
Cuatro flags previos es evidencia de un patrón sistemático. Sin excepción.

*Ejemplo: USR con 4 flags, 2 compensaciones en 90d, ratio 0.82 → RECHAZAR*

### Regla 2: Risk score alto
```
risk_score > 70
```
El score compuesto supera el umbral de riesgo alto.

*Ejemplo: usuario de 19 días, 3 flags, 8 compensaciones → score ~82 → RECHAZAR*

### Regla 3: Flags + compensaciones
```
flags_fraude_previos >= 3 AND num_compensaciones_90d >= 8
```
Combinación de historial de fraude con alta frecuencia de reclamos.

*Ejemplo: USR con 3 flags y 9 compensaciones → RECHAZAR*

### Regla 4: Patrón usuario nuevo
```
antiguedad_usuario_dias < 30 AND num_compensaciones_90d >= 6 AND ratio_compensacion > 0.90
```
Cuenta nueva + compensaciones inmediatas + piden casi todo el valor = patrón de fraude organizado.

*Ejemplo: cuenta de 19 días, 7 compensaciones, ratio 0.94 → RECHAZAR*

### Regla 5: Volumen + ratio
```
num_compensaciones_90d >= 10 AND ratio_compensacion > 0.90
```
Diez o más compensaciones reclamando >90% del valor cada vez.

*Ejemplo: USR con 12 compensaciones, ratio promedio 0.92 → RECHAZAR*

---

## Regla de APROBAR (confianza ALTA)

```
risk_score < 30
AND flags_fraude_previos == 0
AND num_compensaciones_90d <= 2
AND ratio_compensacion <= 0.85
```
**Todas las condiciones deben cumplirse.** Un usuario consolidado, sin historial de fraude, con pocas compensaciones y un monto razonable.

*Ejemplo: usuario de 1590 días, 0 flags, 1 compensación en 90d, ratio 0.81 → APROBAR*

**Respaldo de confianza:** Casos con score <30 y 0 flags tienen un perfil consistente con el 100% de los usuarios "legítimos" identificados en el dataset (usuarios >365 días, 0 flags, ≤2 compensaciones).

---

## Lógica de ESCALAR: con criterio, no por default

Un caso llega a ESCALAR cuando **ninguna de las 5 reglas de RECHAZAR aplica** y **tampoco cumple la regla de APROBAR**. No es un bucket de descarte — es el espacio de ambigüedad genuina donde el texto libre del reclamo y el contexto son determinantes.

El LLM analiza cada ESCALAR con:
- Datos numéricos + risk score + señales ya detectadas
- La descripción del reclamo (texto libre del usuario)
- El motivo del reclamo (categoría)

El LLM puede: **resolver** el caso (flip a APROBAR o RECHAZAR) o **mantener** el ESCALAR si la ambigüedad requiere verificación humana real.

### Subtipos de ambigüedad

Cada caso ESCALAR que el LLM mantiene incluye un `subtipo_ambiguedad` y una `accion_sugerida` concreta:

| Subtipo | Señal dominante | Qué verificar |
|---|---|---|
| `motivo_salud` | Reclamo menciona alergia, reacción adversa, intoxicación | Verificar si el usuario tiene alergia documentada en la cuenta |
| `gps_ambiguo` | GPS parcial o señal perdida como señal principal | Confirmar señal GPS con el repartidor asignado — puede ser falla técnica |
| `usuario_nuevo` | Cuenta <90 días como única fuente de incertidumbre | Revisar si es primera orden y si el restaurante tuvo problemas esa noche |
| `ratio_alto` | Compensación >85% del valor sin otras señales claras | Verificar si el motivo (cobro doble, cancelación) justifica el monto total |
| `multiples_flags` | 2–3 flags previos pero descripción coherente | Revisar historial de flags — ¿son todos por el mismo motivo? |
| `descripcion_generica` | Descripción vaga o posible copy-paste | Comparar con otras descripciones del mismo restaurante/motivo |

---

## Niveles de confianza

| Nivel | Origen | Significado |
|---|---|---|
| `ALTA` | Motor de reglas determinístico | Caso claro. El patrón es inconfundible. Auto-ejecutable. |
| `MEDIA` | Análisis LLM con señales claras | LLM tiene suficiente evidencia pero el texto libre fue determinante. |
| `BAJA` | Análisis LLM con señales mixtas | Ambigüedad genuina. El humano debe verificar la `accion_sugerida`. |

---

## Distribución esperada (dataset de 150 casos)

| Decisión | Casos estimados | Descripción |
|---|---|---|
| RECHAZAR | 35–45 | Fraude claro: usuarios nuevos con flags altos y muchas compensaciones |
| APROBAR | 50–60 | Usuarios consolidados (>365 días) sin flags y pocas compensaciones |
| ESCALAR | 50–65 | Señales mixtas: el bucket más grande y el más valioso para el LLM |

---

## Patrón de fraude identificado en el dataset

- **31 casos** de fraude claro: usuarios <90 días, 2+ flags, 5+ compensaciones
- **100%** de estos tienen GPS "SÍ - confirmada"
- Ratio compensación/orden promedio: 0.95
- Usan ~15 descripciones distintas en modo copy-paste

**Descripciones más frecuentes (señal de fraude organizado):**
- (15x) "Cancelaron mi orden por falta de repartidor y no me reembolsaron."
- (14x) "El restaurante canceló pero el cargo sigue en mi tarjeta."
- (10x) "El monto cobrado no corresponde a lo que aparece en mi resumen."
- (9x) "Me mandaron una hamburguesa con queso y tengo alergia al lácteo."

Una descripción genérica + score alto = señal fuerte de fraude organizado. Una descripción específica con detalles únicos (número de orden, hora, nombre del repartidor) = indicador de reclamo legítimo.
