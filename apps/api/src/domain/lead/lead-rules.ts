import { ERROR_REASON, ErrorReason } from '@domain/shared/error-reason';

/**
 * Normaliza un identificador legal (RUT chileno o RFC mexicano) a una forma canónica
 * para comparar: MAYÚSCULAS y sólo caracteres alfanuméricos.
 *
 *   "76.123.456-7"  → "761234567"
 *   "77.444.222-K"  → "77444222K"
 *   "MAGE920101AB1" → "MAGE920101AB1"
 *
 * Así dos representaciones del mismo contribuyente (con/sin puntos o guiones) colisionan
 * y la deduplicación las detecta.
 */
export function normalizeLegalId(raw: string): string {
  return (raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Sufijos societarios comunes en CL y MX que se remueven para normalizar la razón social. */
const COMPANY_SUFFIXES = [
  'SA DE CV',
  'S DE RL DE CV',
  'S DE RL',
  'SAPI DE CV',
  'SPA',
  'S A',
  'SA',
  'S.A.',
  'LTDA',
  'LIMITADA',
  'EIRL',
  'E.I.R.L.',
  'INC',
  'LLC',
];

/**
 * Normaliza la razón social: colapsa espacios, quita sufijos societarios del final
 * y aplica Title Case. Es "sintético" a propósito (el caso pide contactabilidad sintética).
 *
 *   "Comercializadora Andes SpA"   → "Comercializadora Andes"
 *   "Manufacturas Aguila SA de CV" → "Manufacturas Aguila"
 */
export function normalizeCompanyName(raw: string): string {
  let name = (raw ?? '').replace(/\s+/g, ' ').trim();
  const upper = name.toUpperCase();
  for (const suffix of COMPANY_SUFFIXES) {
    if (upper.endsWith(' ' + suffix)) {
      name = name.slice(0, name.length - suffix.length - 1).trim();
      break;
    }
  }
  return name
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export interface ValidationOk {
  ok: true;
}
export interface ValidationError {
  ok: false;
  reason: ErrorReason;
}
export type ValidationResult = ValidationOk | ValidationError;

/**
 * Validación básica de un lead (paso `validate` del pipeline):
 *  - legal_id no vacío  → si no, INVALID_LEGAL_ID
 *  - website presente   → si no, MISSING_WEBSITE
 *  - website parseable como URL http(s) → si no, INVALID_WEBSITE
 *
 * Nota de diseño (conecta con Pregunta 2): en un pipeline de Growth "maduro", un lead con
 * RUT válido pero sin website NO se descarta, sino que se rutea a la iniciativa de
 * "enrichment de contactabilidad" (Apollo/Hunter) para recuperar canal. En este MVP lo
 * marcamos como fallo para dejar el manejo de bordes explícito y medible.
 */
export function validateLeadInput(input: { legalId: string; website: string | null }): ValidationResult {
  if (!input.legalId || input.legalId.trim() === '') {
    return { ok: false, reason: ERROR_REASON.INVALID_LEGAL_ID };
  }
  if (!input.website || input.website.trim() === '') {
    return { ok: false, reason: ERROR_REASON.MISSING_WEBSITE };
  }
  if (!isParseableHttpUrl(input.website)) {
    return { ok: false, reason: ERROR_REASON.INVALID_WEBSITE };
  }
  return { ok: true };
}

export function isParseableHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Extrae el dominio principal de un website. Asume que ya pasó validateLeadInput.
 *   "https://comercializadoraandes.cl"  → "comercializadoraandes.cl"
 *   "http://tinorte.com.mx"             → "tinorte.com.mx"
 *   "https://www.foo.com"               → "foo.com"
 */
export function extractDomain(website: string): string {
  const host = new URL(website).hostname.toLowerCase();
  return host.startsWith('www.') ? host.slice(4) : host;
}

/**
 * Deduplicación intra-batch (determinista y segura ante concurrencia).
 *
 * Un lead es duplicado si existe OTRO lead en el mismo batch con el mismo legal_id
 * normalizado y una `position` menor. El "ganador" es siempre el de menor position
 * (primera aparición). Como el criterio depende sólo de datos inmutables (position),
 * el resultado es idéntico corran los leads en serie o en paralelo.
 *
 * @param target      lead a evaluar
 * @param siblings    otros leads del batch con el MISMO legal_id normalizado
 */
export function isDuplicateWithin(
  target: { position: number; legalIdNormalized: string },
  siblings: ReadonlyArray<{ position: number; legalIdNormalized: string }>,
): boolean {
  return siblings.some(
    (s) => s.legalIdNormalized === target.legalIdNormalized && s.position < target.position,
  );
}
