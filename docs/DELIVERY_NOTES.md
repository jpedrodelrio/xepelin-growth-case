# Notas de entrega y uso del tiempo

## Esfuerzo declarado

La preparación total de esta entrega superó el objetivo de **4–6 horas** indicado en el caso. No se registró un cronómetro exacto, por lo que no se declara una cifra artificial.

El tiempo adicional se destinó a dejar mejor resueltos aspectos que normalmente quedarían fuera de un MVP de entrevista:

- Deploy end-to-end en Railway con API, worker, web, PostgreSQL y Redis.
- Prueba real del webhook HTTP, incluida la `Idempotency-Key` y la persistencia del intento.
- Proxy same-origin para que el frontend no dependa de exponer la URL interna de la API al navegador.
- Evidencia y justificación del enrichment visibles en la UI.
- Validación reproducible del batch de 20 leads del anexo.
- QA final de código, build y presentación.

La decisión fue mantener fuera RBAC completo, multi-tenancy, scraping masivo, deduplicación probabilística global, transactional outbox, tracing distribuido e infraestructura como código. Esas capacidades no cambian la hipótesis principal del caso y habrían aumentado el costo de la demo.

## Uso de AI assistants y presupuesto del LLM

Se utilizó **Codex** como asistente de implementación, revisión, documentación y QA, tal como permiten las reglas del caso.

La aplicación desplegada usa por defecto:

```env
AI_PROVIDER=demo # cambiar a openai sólo en el worker para la prueba live
PUBLIC_INFO_PROVIDER=demo
WEBHOOK_PROVIDER=demo
```

La validación original y los batches de la demo pública usaron el provider determinístico. Adicionalmente se ejecutó **una prueba controlada real** con OpenAI sobre un solo lead sintético: 761 tokens totales y costo estimado de USD 0,00093225, cubierto por crédito promocional. El comprobante sanitizado está en `docs/evidence/openai-live-proof.json`.

## Verificación final

Ejecutada el **2026-07-21 UTC**:

| Control | Resultado |
|---|---|
| `pnpm lint` | Pass |
| `pnpm typecheck` | Pass |
| `pnpm test` | Pass: 3 archivos, 7 tests de Domain/Application/Infrastructure |
| `pnpm build` | Pass: API, worker, web y packages compartidos |
| Demo desplegada | Pass: 20 leads, 16 `ai_ready`, 4 fallos esperados, batch `completed` |
| Webhook live | Pass: HTTP 200, un intento, `Idempotency-Key` comprobada |
| Presentación | Pass: 8 slides, sin overflow y sin desviaciones de plantilla |

La cobertura automatizada se concentra deliberadamente en reglas puras y el caso de uso principal. Los adaptadores de infraestructura se verificaron mediante build y smoke tests del deploy; ampliar integración automatizada sería la siguiente inversión de calidad.
