# Estimación de latencia y capacidad AI

## Evidencia y supuesto

Se observaron dos llamadas reales a `gpt-5-mini-2025-08-07`:

| Ejecución | Latencia AI | Tokens totales |
|---|---:|---:|
| Prueba local controlada | 5,525 s | 761 |
| Prueba end-to-end en Railway | 8,670 s | 854 |

Dos muestras no permiten declarar un p95. Para capacity planning se redondea de forma conservadora a **10 segundos de AI + 2 segundos de website, cola y persistencia = 12 segundos por empresa**.

## Resultado para 10.000 empresas/mes

La fórmula es:

```text
tiempo total = ceil(empresas / concurrencia efectiva) × 12 segundos
```

| Escenario | Concurrencia efectiva | Throughput | Tiempo para 10K |
|---|---:|---:|---:|
| Un batch grande, configuración actual | 5 | 25 empresas/min | 6,67 h |
| Cola sostenida con dos batches activos | 10 | 50 empresas/min | 3,33 h |
| Promedio diario de 334 empresas | 5 | 25 empresas/min | 13,4 min/día |

Con 854 tokens observados por empresa, el escenario de concurrencia 10 consumiría aproximadamente **42.700 tokens/minuto**. La restricción práctica inicial no es la capacidad del worker, sino controlar costo, rate limits del proveedor y calidad.

La ejecución end-to-end costó USD 0,001134; extrapolada linealmente representa USD 11,34 por 10K empresas, consistente con el presupuesto documentado de aproximadamente USD 10–11/mes de LLM.

## SLO e instrumentación

- Objetivo inicial propuesto: p95 end-to-end menor a 20 segundos por empresa.
- No declararlo como resultado hasta reunir al menos 100 ejecuciones live.
- Medir por etapa: website, public info, LLM, persistencia y tiempo en cola.
- Alertar por p95, tasa de `ai_failed`, tokens/lead y costo/lead.

## Orden de optimización

1. Cache por hash de evidencia y TTL para evitar llamadas repetidas.
2. No invocar el LLM cuando no exista evidencia mínima.
3. Aumentar concurrencia gradualmente respetando RPM/TPM y errores 429.
4. Evaluar un modelo menor contra golden set antes de migrar.
5. Usar Batch API para refresh no urgente cuando importe más costo que latencia.

La estimación es reproducible con `pnpm estimate:ai-capacity`.
