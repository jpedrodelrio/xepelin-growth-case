"use client";

import { useState } from "react";
import type { AiExecutionMetadata, LeadItem } from "@/lib/api";

function formatCost(value: number | null): string {
  if (value === null) return "No calculado";
  if (value === 0) return "USD 0";
  return `USD ${value.toFixed(6)}`;
}

function Telemetry({ execution }: { execution: AiExecutionMetadata | null }) {
  if (!execution) return <div className="lc-tele-legacy">Sin telemetría · batch anterior</div>;
  const live = execution.mode === "live";
  return (
    <div className={`lc-tele ${execution.mode}`}>
      <div className="lc-tele-top">
        <span className={`providerBadge ${execution.mode}`}>{live ? "LLM real" : "Demo"}</span>
        <span className="lc-fld">execution</span>
      </div>
      <div className="lc-tele-grid">
        <div><div className="lc-tl">Modelo</div><div className="lc-tv">{execution.model ?? "—"}</div></div>
        <div><div className="lc-tl">Tokens</div><div className="lc-tv">{execution.usage?.totalTokens ?? "—"}</div></div>
        <div><div className="lc-tl">Costo est.</div><div className="lc-tv">{formatCost(execution.estimatedCostUsd)}</div></div>
        <div><div className="lc-tl">Latencia</div><div className="lc-tv">{(execution.latencyMs / 1_000).toFixed(2)} s</div></div>
        <div><div className="lc-tl">Reasoning</div><div className="lc-tv">{execution.usage?.reasoningTokens ?? "—"}</div></div>
        {execution.responseId && (
          <div><div className="lc-tl">Response ID</div><div className="lc-tv lc-id">{execution.responseId}</div></div>
        )}
      </div>
    </div>
  );
}

export function LeadCard({ lead, defaultExpanded = false }: { lead: LeadItem; defaultExpanded?: boolean }) {
  const [open, setOpen] = useState(defaultExpanded);
  const [copied, setCopied] = useState(false);
  const ai = lead.aiEnrichment;

  async function copyIceBreaker() {
    if (!ai) return;
    try {
      await navigator.clipboard.writeText(ai.iceBreaker);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard no disponible */
    }
  }

  const siteState = lead.websiteAlive === true ? "site vivo" : lead.websiteAlive === false ? "site no disponible" : null;

  return (
    <div className={`lc-card ${open ? "open" : ""}`}>
      <button type="button" className="lc-head" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <div className="lc-head-main">
          <div className="lc-co">{lead.legalName}</div>
          <div className="lc-sub">
            {lead.legalId} · {lead.domain ?? (lead.website || "sin website")}
            {siteState ? ` · ${siteState}` : ""}
          </div>
        </div>
        <div className="lc-head-right">
          {ai && (
            <div className="lc-scoreWrap">
              <span className="lc-score">{ai.prospectFitScore}</span>
              {open && <span className="lc-fld">prospect_fit_score</span>}
            </div>
          )}
          <span className={`badge ${lead.status}`}>{lead.status}</span>
          <span className="lc-chev">{open ? "▴" : "▾"}</span>
        </div>
      </button>

      {open && (
        <div className="lc-body">
          {lead.failure ? (
            <div className="lc-fail">
              <strong>{lead.failure.code}</strong> — {lead.failure.message}
              <div className="lc-sub">{lead.failure.retryable ? "reintentable" : "permanente"} · etapa: {lead.failure.stage}</div>
            </div>
          ) : !ai ? (
            <div className="lc-sub">Procesando…</div>
          ) : (
            <>
              <div>
                <div className="lc-lbl">Ice-breaker para el SDR <span className="lc-fld">ice_breaker</span></div>
                <div className="lc-hero">
                  <button type="button" className="lc-copy" onClick={copyIceBreaker}>{copied ? "Copiado" : "Copiar"}</button>
                  <p>“{ai.iceBreaker}”</p>
                </div>
              </div>

              <div>
                <div className="lc-lbl">Hipótesis de dolor <span className="lc-fld">pain_hypothesis</span></div>
                <div className="lc-pain">{ai.painHypothesis}</div>
              </div>

              <div>
                <div className="lc-lbl">
                  Por qué el fit <span className="lc-fld">fit_justification</span>
                  <span className="lc-conf">confianza: {ai.confidence}</span>
                </div>
                <div className="lc-just">{ai.fitJustification}</div>
              </div>

              <div>
                <div className="lc-lbl">Evidencia usada · {ai.evidence.length} <span className="lc-fld">evidence</span></div>
                <ul className="lc-ev">
                  {ai.evidence.map((item, index) => (
                    <li key={index}><span className="lc-dot" />{item}</li>
                  ))}
                </ul>
              </div>

              <Telemetry execution={lead.aiExecution} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
