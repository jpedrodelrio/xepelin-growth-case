# Estimación de latencia y capacidad AI

## Evidencia y supuesto

Se observaron dos llamadas reales a `gpt-5-mini-2025-08-07`:

| Ejecución (real) | Latencia AI | Tokens | Costo USD |
|---|---:|---:|---:|
| Prueba local controlada | 5,53 s | 761 | 0,000932 |
| Prueba end-to-end Railway | 8,67 s | 854 | 0,001134 |
| ICB (live) | 5,25 s | 1.712 | 0,001492 |
| ICB (live, 2ª) | 7,25 s | 1.625 | 0,001400 |
| Blumar (live) | 5,60 s | 3.239 | 0,001685 |
| OMAJ (live) | 3,98 s | 2.035 | 0,001259 |
| Rhona (live) | 8,11 s | 3.072 | 0,001697 |

Siete corridas reales dan latencias de **~4 a 9 s** por empresa; aún pocas para declarar un p95, así que para capacity planning se redondea de forma conservadora a **10 s de AI + 2 s de website, cola y persistencia = 12 s por empresa**.

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

Las siete corridas reales promedian **USD 0,00137 por empresa → ~USD 14 por 10K/mes** (rango USD 9–17 según cuánto texto del sitio se envía al modelo). El LLM **no es el costo dominante**: la búsqueda y la infraestructura pesan más. Comprimir el prompt (no mandar el HTML completo) baja el extremo alto del rango.

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
