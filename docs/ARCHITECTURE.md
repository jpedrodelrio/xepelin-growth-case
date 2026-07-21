# Architecture decision record

## Hexagonal, pero pragmática

**Decisión:** separar Domain/Application de Infrastructure y Presentation. Crear puertos sólo para DB, cola, website, public info, AI y webhook.

**Por qué:** son límites con fallos, costos o vendors cambiantes. La separación permite unit tests sin servicios externos, modo demo reproducible y reemplazar proveedores sin tocar `ProcessLead`.

**Qué evitamos:** repositorios genéricos, factories por entidad, command buses y mappers sin una segunda representación útil.

**Fuente de verdad:** `packages/core` contiene Domain/Application y `packages/infrastructure` contiene adaptadores y el único schema Prisma. Se eliminó una implementación de dominio y schema antiguos bajo `apps/api` que estaban excluidos del build; mantenerlos habría creado dos modelos contradictorios.

## PostgreSQL + Prisma

El workflow necesita consistencia relacional, auditoría y consultas por batch/estado. PostgreSQL permite compare-and-set en transiciones y transacciones para estado + evento. Prisma acelera el MVP con tipos y migraciones legibles.

## BullMQ + Redis

El worker debe sobrevivir reinicios y aplicar retry/backoff. Una cola in-memory perdería jobs; cron agregaría polling y peor latencia. BullMQ entrega persistencia, retries y stalled-job recovery con bajo setup.

## Webhook

Se dispara un único evento lógico cuando todos los leads están terminales. La entrega es at-least-once: hasta tres requests comparten idempotency key. `webhookSentAt` evita nuevos eventos lógicos, incluso después de retry-failed. Cada respuesta HTTP se persiste con su status real y modo `live` o `demo`; timeouts y errores de red quedan con status nulo y error seguro. Las filas anteriores a esta telemetría usan `unknown` para no atribuirles un modo falso. Se reintentan `408`, `429`, `5xx` y fallas de red, mientras otros `4xx` terminan inmediatamente. El worker emite un log estructurado por intento y el detalle del batch consulta la misma auditoría persistida.

## Providers demo

Los dominios del Anexo A son sintéticos y mayoritariamente no resuelven. Fallar 16 enrichments por ese motivo ocultaría el flujo evaluado. El modo demo genera dos fuentes sintéticas etiquetadas; el modo live demuestra la integración real.

## Trazabilidad del enrichment AI

`AiEnrichmentProvider` devuelve un resultado compuesto por output de negocio y metadata neutral de ejecución. El repositorio persiste ambos atómicamente y registra `ai_enrichment_completed`. La metadata usa un campo JSON porque provider, usage y pricing pueden evolucionar sin convertir detalles de OpenAI en columnas del dominio. La UI distingue explícitamente `demo` de `live` y expone modelo, response ID, tokens, latencia y costo estimado.

## Siguiente evolución

1. Transactional outbox y reconciliador para DB → queue.
2. Rate limiter/circuit breaker por provider.
3. Métricas OpenTelemetry y dashboard de costos.
4. Cache por dominio + hash de contenido.
5. Matching cross-batch con revisión humana para casos ambiguos.
