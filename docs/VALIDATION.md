# Evidencia de validación

Validación ejecutada el **2026-07-21 UTC** sobre el commit `93c2d7a`, con datos y providers sintéticos. No se realizaron llamadas a OpenAI ni se consumieron tokens de LLM.

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
