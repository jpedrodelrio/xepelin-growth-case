# Evidencia de validación

Validación original ejecutada el **2026-07-21 UTC** sobre el commit `93c2d7a`, con datos y providers sintéticos. La prueba OpenAI controlada descrita abajo se ejecutó después y no altera los resultados del batch original.

## Prueba OpenAI real controlada

Se ejecutó Responses API sobre un único lead sintético, sin proveedor de búsqueda pagado:

- Modelo: `gpt-5-mini-2025-08-07`.
- Response ID: `resp_0439c0d70ec416b1016a5ee8602b1c8195a49db41f14f8511a`.
- Uso: 337 tokens de entrada, 424 de salida y 761 totales.
- Reasoning: 128 tokens con esfuerzo `low`.
- Latencia: 5.525 ms.
- Costo estimado: USD 0,00093225, cubierto por crédito promocional.
- Structured Output validado con Zod y secret scan limpio.

Evidencia completa: [`docs/evidence/openai-live-proof.json`](evidence/openai-live-proof.json).

## Servicios públicos

- UI: <https://web-production-43317.up.railway.app>
- API health: <https://xepelin-growth-case-production.up.railway.app/health>
- Railway: API, worker, web, PostgreSQL y Redis en estado `Online`.

## Caso de aceptación de 20 leads

Batch `ad858e85-f657-452c-a3ba-9f331ef7991e` creado desde la UI pública:

- Estado final: `completed`.
- Total: 20.
- `ai_ready`: 16.
- Fallidos permanentes: 4 (dos duplicados y dos URLs inválidas o vacías).
- Fallos parciales no bloquearon la finalización.
- Entrega demo del webhook: intento 1, status `200`.

## Webhook HTTP real

Se activó temporalmente `WEBHOOK_PROVIDER=live` sólo en el worker y se creó el batch sintético `ee4cc98f-44f1-4dc7-b7db-78c0fd217085`.

Resultado persistido por la aplicación:

- Estado final: `completed`.
- `webhookSentAt`: `2026-07-21T02:33:51.503Z`.
- Delivery `bcd39714-6b1c-41c1-bd1a-5fc0fd0d1b45`.
- Intento: 1.
- Status HTTP: `200`.
- Error: `null`.

El inspector temporal de Webhook.site registró la request `5257846c-7801-4251-809a-396891a3bb8a` con:

- Método `POST`.
- Payload con `batch_id`, nombre, resumen y `link_to_detail` público.
- Header `Idempotency-Key: batch:ee4cc98f-44f1-4dc7-b7db-78c0fd217085:completed`.
- Un único request recibido.

Después de la prueba, el worker se restauró a `WEBHOOK_PROVIDER=demo` para evitar tráfico externo durante la entrevista. La URL del inspector expira, por lo que los IDs y el resultado persistido quedan documentados aquí como evidencia estable.
