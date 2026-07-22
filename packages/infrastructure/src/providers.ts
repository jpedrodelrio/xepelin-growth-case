import dns from "node:dns/promises";
import net from "node:net";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import {
  PipelineError,
  type AiEnrichmentRun,
  type AiExecutionMetadata,
  type AiEnrichmentProvider,
  type Lead,
  type PublicCompanyInfo,
  type PublicInfoProvider,
  type WebhookSender,
  type WebsiteAvailabilityChecker,
} from "@xepelin/core";

const aiSchema = z.object({
  prospect_fit_score: z.number().int().min(0).max(100).describe("Entero en escala 0 a 100; 100 = fit ideal con Xepelin"),
  fit_justification: z.string().min(10).max(700),
  ice_breaker: z.string().min(10).max(500),
  pain_hypothesis: z.string().min(10).max(500),
  confidence: z.enum(["low", "medium", "high"]),
  evidence: z.array(z.string().min(3)).max(5),
});

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a = 0, b = 0] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  return ip === "::1" || ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80:");
}

async function assertPublicUrl(url: URL): Promise<void> {
  if (!["http:", "https:"].includes(url.protocol)) throw new PipelineError("unsafe_url", "contactability", "Only HTTP(S) URLs are allowed", false);
  if (["localhost", "0.0.0.0"].includes(url.hostname)) throw new PipelineError("unsafe_url", "contactability", "Private hosts are blocked", false);
  const addresses = await dns.lookup(url.hostname, { all: true }).catch(() => []);
  if (addresses.some(({ address }) => isPrivateIp(address))) throw new PipelineError("unsafe_url", "contactability", "Private IP ranges are blocked", false);
}

export class HttpWebsiteAvailabilityChecker implements WebsiteAvailabilityChecker {
  async check(url: URL): Promise<boolean> {
    try {
      await assertPublicUrl(url);
      let response = await fetch(url, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(3_000) });
      if ([403, 405].includes(response.status)) {
        response = await fetch(url, { method: "GET", redirect: "follow", headers: { Range: "bytes=0-1024" }, signal: AbortSignal.timeout(3_000) });
      }
      return response.status < 500;
    } catch {
      return false;
    }
  }
}

export class DemoWebsiteAvailabilityChecker implements WebsiteAvailabilityChecker {
  async check(): Promise<boolean> {
    return true;
  }
}

export class DemoPublicInfoProvider implements PublicInfoProvider {
  async fetch(lead: Lead): Promise<PublicCompanyInfo> {
    const domain = lead.domain ?? new URL(lead.website).hostname;
    const profile = syntheticProfileFor(lead.legalName);
    const sources = [
      {
        url: lead.website,
        title: `Sitio sintético de ${lead.legalName}`,
        snippet: profile.officialSiteSignal,
      },
      {
        url: `https://directory.example/companies/${encodeURIComponent(domain)}`,
        title: "Directorio B2B sintético",
        snippet: profile.externalSourceSignal,
      },
    ];
    return {
      summary: sources.map((source) => source.snippet).join(" "),
      sources,
    };
  }
}

interface SyntheticCompanyProfile {
  officialSiteSignal: string;
  externalSourceSignal: string;
}

function syntheticProfileFor(legalName: string): SyntheticCompanyProfile {
  const name = legalName.toLocaleLowerCase("es");
  if (/(transport|logíst|logistic|ruta)/.test(name)) {
    return {
      officialSiteSignal: "El sitio describe transporte B2B, coordinación de flota y entregas recurrentes para clientes empresa.",
      externalSourceSignal: "El directorio la clasifica en logística, con pagos operativos frecuentes a combustible, mantenimiento y transportistas asociados.",
    };
  }
  if (/(constructor|obra|ingenier)/.test(name)) {
    return {
      officialSiteSignal: "El sitio presenta proyectos de construcción por etapas y trabajo coordinado con proveedores y subcontratistas.",
      externalSourceSignal: "El directorio reporta actividad B2B por proyectos, con ciclos distintos entre certificación de avances y pagos operativos.",
    };
  }
  if (/(software|tecnolog|digital|consultor|talento|nube)/.test(name)) {
    return {
      officialSiteSignal: "El sitio ofrece servicios B2B por suscripción o proyecto y destaca procesos digitales para sus clientes.",
      externalSourceSignal: "El directorio la clasifica como servicios profesionales, con baja intensidad de inventario y cobros empresariales recurrentes.",
    };
  }
  if (/(alimento|agro|medic|distribu|comercial|maquin|ferreter|acero)/.test(name)) {
    return {
      officialSiteSignal: "El sitio describe venta B2B de productos, abastecimiento de inventario y atención recurrente a clientes empresa.",
      externalSourceSignal: "El directorio identifica una cadena de suministro con compras a proveedores y capital inmovilizado entre inventario, venta y cobro.",
    };
  }
  return {
    officialSiteSignal: "El sitio describe una operación B2B recurrente y servicios entregados a otras empresas.",
    externalSourceSignal: "El directorio confirma actividad empresarial, pero ofrece pocas señales sobre inventario o ciclos de pago.",
  };
}

export class LivePublicInfoProvider implements PublicInfoProvider {
  constructor(private readonly braveApiKey?: string) {}

  async fetch(lead: Lead): Promise<PublicCompanyInfo> {
    const url = new URL(lead.website);
    await assertPublicUrl(url);
    const homepage = await fetch(url, { signal: AbortSignal.timeout(5_000), redirect: "follow" })
      .then((response) => response.text())
      .then((html) => html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 4_000))
      .catch(() => "");

    const searchResult = this.braveApiKey
      ? await this.searchBrave(lead.legalName)
      : await this.searchWikipedia(lead.legalName);
    const sources = [
      ...(homepage ? [{ url: lead.website, title: `Sitio oficial de ${lead.legalName}`, snippet: homepage }] : []),
      ...(searchResult ? [searchResult] : []),
    ];
    if (sources.length === 0) throw new PipelineError("public_info_unavailable", "public_info", "No public evidence was available", true);
    return { summary: sources.map((source) => source.snippet).join(" ").slice(0, 5_000), sources };
  }

  private async searchBrave(legalName: string): Promise<PublicCompanyInfo["sources"][number] | null> {
    const search = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(legalName)}`, {
      headers: { Accept: "application/json", "X-Subscription-Token": this.braveApiKey ?? "" },
      signal: AbortSignal.timeout(5_000),
    }).then((response) => {
      if (!response.ok) throw new Error(`Search provider returned ${response.status}`);
      return response.json() as Promise<{ web?: { results?: Array<{ title: string; url: string; description: string }> } }>;
    });
    const result = search.web?.results?.[0];
    return result ? { url: result.url, title: result.title, snippet: result.description } : null;
  }

  private async searchWikipedia(legalName: string): Promise<PublicCompanyInfo["sources"][number] | null> {
    const endpoint = new URL("https://es.wikipedia.org/w/api.php");
    endpoint.search = new URLSearchParams({
      action: "query",
      list: "search",
      srsearch: legalName,
      utf8: "1",
      format: "json",
      origin: "*",
    }).toString();
    const search = await fetch(endpoint, {
      headers: { Accept: "application/json", "User-Agent": "XepelinGrowthCase/1.0" },
      signal: AbortSignal.timeout(5_000),
    }).then((response) => {
      if (!response.ok) throw new Error(`Wikipedia returned ${response.status}`);
      return response.json() as Promise<{ query?: { search?: Array<{ title: string; snippet: string }> } }>;
    });
    const result = search.query?.search?.[0];
    if (!result) return null;
    const slug = encodeURIComponent(result.title.replaceAll(" ", "_"));
    return {
      url: `https://es.wikipedia.org/wiki/${slug}`,
      title: `${result.title} — Wikipedia`,
      snippet: result.snippet.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    };
  }
}

export class DemoAiEnrichmentProvider implements AiEnrichmentProvider {
  async enrich(lead: Lead, publicInfo: PublicCompanyInfo): Promise<AiEnrichmentRun> {
    const checksum = [...lead.legalIdNormalized].reduce((total, character) => total + character.charCodeAt(0), 0);
    const score = 60 + (checksum % 31);
    return {
      enrichment: {
        prospectFitScore: score,
        fitJustification: "La evidencia sintética indica operación B2B recurrente y potencial necesidad de administrar liquidez entre cobros y pagos.",
        iceBreaker: `Vi que ${lead.legalName} trabaja con una operación recurrente de clientes y proveedores. ¿Cómo están gestionando hoy los desfases entre cobros y pagos?`,
        painHypothesis: "Hipótesis: podría necesitar capital de trabajo o una forma más simple de programar y financiar pagos a proveedores.",
        confidence: publicInfo.sources.length >= 2 ? "medium" : "low",
        evidence: publicInfo.sources.map((source) => source.title),
      },
      execution: {
        provider: "demo",
        mode: "demo",
        model: "deterministic-fixture-v1",
        responseId: null,
        completedAt: new Date().toISOString(),
        latencyMs: 0,
        maxOutputTokens: null,
        reasoningEffort: null,
        usage: null,
        estimatedCostUsd: 0,
      },
    };
  }
}

export function estimateOpenAiCostUsd(
  model: string,
  usage: NonNullable<AiExecutionMetadata["usage"]>,
): number | null {
  if (!model.startsWith("gpt-5-mini")) return null;
  return Number(((usage.inputTokens * 0.25 + usage.outputTokens * 2) / 1_000_000).toFixed(8));
}

export class OpenAiEnrichmentProvider implements AiEnrichmentProvider {
  private readonly client: OpenAI;

  constructor(
    apiKey: string,
    private readonly model: string,
    private readonly maxOutputTokens = 1_200,
  ) {
    this.client = new OpenAI({ apiKey });
  }

  async enrich(lead: Lead, publicInfo: PublicCompanyInfo): Promise<AiEnrichmentRun> {
    return this.enrichWithEvidence(lead, publicInfo);
  }

  async enrichWithEvidence(lead: Lead, publicInfo: PublicCompanyInfo): Promise<AiEnrichmentRun> {
    const startedAt = performance.now();
    const response = await this.client.responses.parse({
      model: this.model,
      max_output_tokens: this.maxOutputTokens,
      reasoning: { effort: "low" },
      store: false,
      input: [
        {
          role: "system",
          content: "Eres analista de Growth B2B para Xepelin. Usa exclusivamente la evidencia entregada. No inventes facturación, problemas financieros ni eventos. Redacta en español claro. El pain_hypothesis debe declararse como hipótesis, no como hecho. Evalúa afinidad con pagos, gestión financiera y capital de trabajo. Sé conciso: fit_justification, ice_breaker y pain_hypothesis en 1–2 frases cada uno, sin cortar ideas a mitad. El prospect_fit_score es un entero en escala 0 a 100 (100 = fit ideal), no una nota de 0 a 10. ICP de Xepelin: PyME o mediana B2B que factura a empresas y paga a proveedores (necesita capital de trabajo por el desfase cobros-pagos), con presencia web, en Chile o México. Puntúa por cercanía al ICP: alto (80-100) PyME B2B con inventario o ciclo de crédito (distribución, manufactura, logística, agro, servicios B2B con facturación); medio (55-79) señales parciales; bajo (0-54) gran corporación con tesorería propia, micro sin volumen o sin web, o negocio 100% consumidor al contado. No subas el score por el tamaño o la fama de la marca: una gran corporación conocida va bajo.",
        },
        {
          role: "user",
          content: `Empresa: ${lead.legalName}\nLegal ID: ${lead.legalId}\nSitio: ${lead.website}\nEvidencia pública:\n${JSON.stringify(publicInfo)}`,
        },
      ],
      text: { format: zodTextFormat(aiSchema, "prospect_enrichment") },
    });

    const parsed = response.output_parsed;
    if (!parsed) throw new PipelineError("invalid_ai_output", "ai", "The model did not return a valid structured output", true);
    const enrichment = {
      prospectFitScore: parsed.prospect_fit_score,
      fitJustification: parsed.fit_justification,
      iceBreaker: parsed.ice_breaker,
      painHypothesis: parsed.pain_hypothesis,
      confidence: parsed.confidence,
      evidence: parsed.evidence,
    };

    const usage = response.usage
      ? {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          reasoningTokens: response.usage.output_tokens_details.reasoning_tokens,
          totalTokens: response.usage.total_tokens,
        }
      : null;

    return {
      enrichment,
      execution: {
        provider: "openai",
        mode: "live",
        responseId: response.id,
        model: response.model,
        completedAt: new Date().toISOString(),
        latencyMs: Math.round(performance.now() - startedAt),
        maxOutputTokens: this.maxOutputTokens,
        reasoningEffort: "low",
        usage,
        estimatedCostUsd: usage ? estimateOpenAiCostUsd(response.model, usage) : null,
      },
    };
  }
}

export class HttpWebhookSender implements WebhookSender {
  readonly mode = "live" as const;

  async send(input: { url: string; idempotencyKey: string; payload: Record<string, unknown> }): Promise<{ statusCode: number; ok: boolean }> {
    const url = new URL(input.url);
    await assertPublicUrl(url);
    const response = await fetch(url, {
      method: "POST",
      redirect: "error",
      headers: { "content-type": "application/json", "idempotency-key": input.idempotencyKey },
      body: JSON.stringify(input.payload),
      signal: AbortSignal.timeout(5_000),
    });
    return { statusCode: response.status, ok: response.ok };
  }
}

export class DemoWebhookSender implements WebhookSender {
  readonly mode = "demo" as const;

  async send(): Promise<{ statusCode: number; ok: boolean }> {
    return { statusCode: 200, ok: true };
  }
}
