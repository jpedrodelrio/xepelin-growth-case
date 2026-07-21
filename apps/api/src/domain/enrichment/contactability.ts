/** Resultado del enrichment de contactabilidad sintético (Parte A). */
export interface ContactabilityResult {
  /** Dominio principal extraído del website, p.ej. "comercializadoraandes.cl". */
  domain: string;
  /** Razón social normalizada (sin sufijos societarios, trim, capitalización consistente). */
  normalizedName: string;
  /** ¿El sitio respondió a un HEAD request dentro del timeout? */
  websiteAlive: boolean;
}
