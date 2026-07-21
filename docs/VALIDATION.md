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

## Prueba OpenAI end-to-end en Railway

Batch público: <https://web-production-43317.up.railway.app/batches/5507d0df-9279-41f6-800f-6237c0d5475d>

- Un lead sintético procesado mediante API → BullMQ → worker → OpenAI → PostgreSQL → API → UI.
- Estado final: `completed`; lead `ai_ready`.
- Modelo: `gpt-5-mini-2025-08-07`.
- Response ID: `resp_015ed2ce5048fd97016a5eee46e6a08199881b43ea7a188b5a`.
- Uso: 854 tokens totales; 192 de reasoning.
- Latencia AI: 8,670 s.
- Costo estimado: USD 0,001134.
- La UI mostró badge `LLM real`, modelo, tokens, latencia, costo y response ID.

## Batch OpenAI multi-lead con datos sintéticos

Batch público: <https://web-production-43317.up.railway.app/batches/6f12f9a7-8b2c-4a64-a9ea-1386792ffdfc>

Se ejecutó el escenario `supply-chain-cl` con tres empresas ficticias y `PUBLIC_INFO_PROVIDER=demo` para no usar datos ni búsqueda pagada reales.

- Estado final del batch: `completed`.
- Leads: 3 `ai_ready`, 0 fallidos.
- Ejecuciones OpenAI reales: 3.
- Modelo: `gpt-5-mini-2025-08-07`.
- Consumo total: 2.321 tokens.
- Costo estimado total: USD 0,00287975.
- Latencia AI observada: entre 4,791 s y 5,518 s.
- Cada lead persistió dos fuentes sintéticas, score, justificación, ice-breaker, pain hypothesis, confianza, evidencia y telemetría.
- Webhook: un intento, status HTTP `200`.
- La UI mostró los tres estados `ai_ready`, outputs personalizados y badge `LLM real`.

Los tres scores fueron 75 porque esta ejecución ocurrió antes de desplegar el provider demo sectorial. El nuevo fixture y provider generan evidencia diferenciada para supply chain, logística, construcción, servicios digitales y distribución; debe ejecutarse un batch nuevo después del siguiente deploy para comparar la variación de scores.

## Prueba live con sitio y fuente adicional reales

Batch público: <https://web-production-43317.up.railway.app/batches/31d4bc9b-e34e-4c1e-90e6-24c778109f71>

Se procesó un único lead de prueba con identificador y owner sintéticos, pero con el nombre público `Cencosud S.A.` y su sitio oficial real. `PUBLIC_INFO_PROVIDER=live` quedó activo y, al no existir una key de Brave, usó el fallback gratuito documentado.

- Estado final: `completed`; lead `ai_ready` en un intento.
- Website checker: `cencosud.com`, disponible.
- Fuente 1: contenido real de <https://www.cencosud.com>.
- Fuente 2: resultado real de <https://es.wikipedia.org/wiki/Cencosud>.
- OpenAI real: `gpt-5-mini-2025-08-07`, response ID `resp_08c3d7eac0ab432b016a5f04f801b8819987ce6ff2cbc219c9`.
- Uso: 2.181 tokens de entrada, 604 de salida y 2.785 totales.
- Latencia AI: 6,484 s.
- Costo estimado: USD 0,00175325.
- La UI mostró website vivo, evidencia grounded, output comercial y telemetría `LLM real`.

La ejecución también detectó una inconsistencia de calidad útil para el eval: el score fue `8/100`, mientras la justificación describió afinidad alta. El schema rechazaba valores fuera de rango, pero no garantizaba coherencia semántica; este caso queda como fixture candidato para calibrar el prompt y agregar un eval score↔justificación.

Durante esta prueba `WEBHOOK_PROVIDER` estaba accidentalmente en `live` y la URL demo respondió `404`; el intento y el error quedaron persistidos y visibles en el log expandible del frontend. Después se restauró únicamente el webhook a `demo`, manteniendo public info en `live`.

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

Prueba pública más reciente: <https://web-production-43317.up.railway.app/batches/24e34f6e-467a-422e-b175-b14b0359d95b>

Se activó temporalmente `WEBHOOK_PROVIDER=live` sólo en el worker y se creó un batch sintético de un lead para minimizar el consumo del LLM.

Resultado persistido por la aplicación:

- Estado final: `completed`.
- Lead terminal: `ai_ready`.
- OpenAI: 796 tokens, 3,884 s de latencia y costo estimado de USD 0,00100225.
- `webhookSentAt`: `2026-07-21T05:04:25.086Z`.
- Delivery `a7786be2-152c-4835-ab0d-701ca4eec6ef`.
- Modo persistido: `live`.
- Intento: 1.
- Status HTTP: `200`.
- Error: `null`.
- La UI mostró el badge **Webhook real**, intento, fecha y status.

El inspector temporal de Webhook.site registró la request `39eb735f-1a36-4679-802a-12d686d0a1b8` con:

- Método `POST`.
- Payload `{ batch_id, name, summary: { total: 1, ready: 1, failed: 0 }, link_to_detail }`.
- Header `Idempotency-Key: batch:24e34f6e-467a-422e-b175-b14b0359d95b:completed`.
- Un único request recibido.

Después de verificar el POST, Railway desplegó nuevamente el worker con `WEBHOOK_PROVIDER=demo` y quedó en estado `Active`, evitando tráfico externo durante la entrevista. La URL del inspector expira, por lo que los IDs y el resultado persistido quedan documentados aquí como evidencia estable.
