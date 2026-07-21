import dns from "node:dns/promises";
import net from "node:net";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import {
  PipelineError,
  type AiEnrichment,
  type AiEnrichmentProvider,
  type Lead,
  type PublicCompanyInfo,
  type PublicInfoProvider,
  type WebhookSender,
  type WebsiteAvailabilityChecker,
} from "@xepelin/core";

const aiSchema = z.object({
  prospect_fit_score: z.number().int().min(0).max(100),
  fit_justification: z.string().min(10).max(500),
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

export class DemoPublicInfoProvider implements PublicInfoProvider {
  async fetch(lead: Lead): Promise<PublicCompanyInfo> {
    const domain = lead.domain ?? new URL(lead.website).hostname;
    return {
      summary: `${lead.legalName} es una empresa B2B sintética con operación recurrente, relación con proveedores y necesidades potenciales de capital de trabajo.`,
      sources: [
        { url: lead.website, title: `Sitio de ${lead.legalName}`, snippet: `Empresa enfocada en servicios y operación B2B. Dominio: ${domain}.` },
        { url: `https://demo.example/search?q=${encodeURIComponent(lead.legalName)}`, title: "Fuente pública sintética", snippet: "Señales simuladas de compras, facturación y pagos recurrentes para demostrar el pipeline." },
      ],
    };
  }
}

export class LivePublicInfoProvider implements PublicInfoProvider {
  constructor(private readonly braveApiKey: string) {}

  async fetch(lead: Lead): Promise<PublicCompanyInfo> {
    const url = new URL(lead.website);
    await assertPublicUrl(url);
    const homepage = await fetch(url, { signal: AbortSignal.timeout(5_000), redirect: "follow" })
      .then((response) => response.text())
      .then((html) => html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 4_000))
      .catch(() => "");

    const search = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(lead.legalName)}`, {
      headers: { Accept: "application/json", "X-Subscription-Token": this.braveApiKey },
      signal: AbortSignal.timeout(5_000),
    }).then((response) => {
      if (!response.ok) throw new Error(`Search provider returned ${response.status}`);
      return response.json() as Promise<{ web?: { results?: Array<{ title: string; url: string; description: string }> } }>;
    });

    const searchResult = search.web?.results?.[0];
    const sources = [
      ...(homepage ? [{ url: lead.website, title: `Sitio oficial de ${lead.legalName}`, snippet: homepage }] : []),
      ...(searchResult ? [{ url: searchResult.url, title: searchResult.title, snippet: searchResult.description }] : []),
    ];
    if (sources.length === 0) throw new PipelineError("public_info_unavailable", "public_info", "No public evidence was available", true);
    return { summary: sources.map((source) => source.snippet).join(" ").slice(0, 5_000), sources };
  }
}

export class DemoAiEnrichmentProvider implements AiEnrichmentProvider {
  async enrich(lead: Lead, publicInfo: PublicCompanyInfo): Promise<AiEnrichment> {
    const checksum = [...lead.legalIdNormalized].reduce((total, character) => total + character.charCodeAt(0), 0);
    const score = 60 + (checksum % 31);
    return {
      prospectFitScore: score,
      fitJustification: "La evidencia sintética indica operación B2B recurrente y potencial necesidad de administrar liquidez entre cobros y pagos.",
      iceBreaker: `Vi que ${lead.legalName} trabaja con una operación recurrente de clientes y proveedores. ¿Cómo están gestionando hoy los desfases entre cobros y pagos?`,
      painHypothesis: "Hipótesis: podría necesitar capital de trabajo o una forma más simple de programar y financiar pagos a proveedores.",
      confidence: publicInfo.sources.length >= 2 ? "medium" : "low",
      evidence: publicInfo.sources.map((source) => source.title),
    };
  }
}

export class OpenAiEnrichmentProvider implements AiEnrichmentProvider {
  private readonly client: OpenAI;

  constructor(apiKey: string, private readonly model: string) {
    this.client = new OpenAI({ apiKey });
  }

  async enrich(lead: Lead, publicInfo: PublicCompanyInfo): Promise<AiEnrichment> {
    const response = await this.client.responses.parse({
      model: this.model,
      input: [
        {
          role: "system",
          content: "Eres analista de Growth B2B para Xepelin. Usa exclusivamente la evidencia entregada. No inventes facturación, problemas financieros ni eventos. Redacta en español claro. El pain_hypothesis debe declararse como hipótesis, no como hecho. Evalúa afinidad con pagos, gestión financiera y capital de trabajo.",
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
    return {
      prospectFitScore: parsed.prospect_fit_score,
      fitJustification: parsed.fit_justification,
      iceBreaker: parsed.ice_breaker,
      painHypothesis: parsed.pain_hypothesis,
      confidence: parsed.confidence,
      evidence: parsed.evidence,
    };
  }
}

export class HttpWebhookSender implements WebhookSender {
  async send(input: { url: string; idempotencyKey: string; payload: Record<string, unknown> }): Promise<{ statusCode: number }> {
    const url = new URL(input.url);
    await assertPublicUrl(url);
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": input.idempotencyKey },
      body: JSON.stringify(input.payload),
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new PipelineError("webhook_http_error", "webhook", `Webhook returned ${response.status}`, true);
    return { statusCode: response.status };
  }
}

export class DemoWebhookSender implements WebhookSender {
  async send(): Promise<{ statusCode: number }> {
    return { statusCode: 200 };
  }
}
