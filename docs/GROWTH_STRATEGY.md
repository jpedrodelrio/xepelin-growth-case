# Pregunta 2 — Growth criteria

## Diagnóstico

No asumir que AI ice-breakers es la prioridad sólo porque fue el entregable técnico. Durante una semana instrumentaría:

```text
lead asignado → intento → contactado → calificado → enrolado
```

Por país, canal, segmento y SDR mediría time-to-first-touch, intentos por lead, contact rate, qualified/contact y enrolled/qualified. Hipótesis inicial: el mayor desperdicio está en datos de contacto incompletos, duplicados y tiempo manual de research.

Baseline: 70 SDR × 3 enrolados/semana = 210 enrolados/semana. El objetivo +20% equivale a 3,6 por SDR y 252 totales, es decir, +42 enrolados semanales.

## Priorización

| Orden | Iniciativa | Métrica que mueve | Esfuerzo | Riesgo |
|---|---|---|---|---|
| 1 | Contactabilidad mejorada | Contact rate y enrolados/SDR/semana | M | Información incorrecta, privacidad o vendor lock-in |
| 2 | Dedupe/matching multi-fuente | % de intentos sobre leads únicos | M | False merge y pérdida de historia |
| 3 | AI ice-breakers | Tiempo de research y response rate | S | Alucinaciones o lift irrelevante |
| 4 | Slack-first cockpit | Time-to-first-touch y follow-ups en SLA | M | Fragmentar el workflow fuera del CRM |

El power-dialer se posterga: esfuerzo L, datos personales/transcripciones, dependencia operativa con Twilio y ausencia de capacidad de Engineering Core. Si las métricas muestran un cuello de botella en volumen de llamadas, compraría primero una solución existente.

## Build vs. comprar

- Contactabilidad: comprar Apollo/Hunter u otro proveedor; construir orquestación, reglas de confianza, cache y experimentación.
- Matching: construir identidad por RUT/RFC e histórico, porque es lógica diferenciadora y cruza todos los canales.
- AI: comprar LLM/search; construir prompt, evaluación, grounding, presupuesto y feedback loop.
- Slack: construir una integración delgada después de validar qué alertas generan acción.

Principio: comprar commodities; construir la lógica que aprende del funnel y crea ventaja acumulativa.

## Experimento de la iniciativa #1

- 70 SDRs en grupos tratamiento/control balanceados por país, segmento y productividad histórica.
- Duración: 4–6 semanas.
- Unidad de análisis: SDR-semana, con baseline previo para reducir varianza.
- Métrica de éxito: al menos +8% en enrolados por SDR por semana atribuible a contactabilidad.
- Guardrail: email/teléfono inválido o rebote no empeora más de 2 puntos porcentuales.
- Secondary diagnostics: contact rate, intentos hasta contacto, time-to-first-contact y enrolado/contactado.
- Legal/Risk aprueba proveedor, finalidad, retención y eliminación antes de cruzar datos personales.

Un +8% no completa por sí solo el objetivo trimestral de +20%; se espera combinarlo con dedupe, mejor priorización y reducción de research manual.
