import { useState } from "react";
import type { ReportFinding } from "../api";
import { EvidenceViewer } from "./EvidenceViewer";

export function FindingDetail({ finding }: { finding: ReportFinding | null }) {
  const [evidenceIndex, setEvidenceIndex] = useState(0);

  if (!finding) {
    return (
      <section className="panel detail">
        <h2>Finding</h2>
        <p className="empty">Select a finding to see its evidence.</p>
      </section>
    );
  }

  const evidence = finding.evidence[evidenceIndex] ?? finding.evidence[0] ?? null;
  const confidence = finding.source === "ai" ? (finding.aiConfidence ?? finding.confidence) : finding.confidence;

  return (
    <section className="panel detail">
      <div className="panel-head">
        <h2>{finding.ruleName}</h2>
        <div className="tags">
          <span className={`pill sev-${finding.severity}`}>{finding.severity}</span>
          <span className={`pill source-${finding.source}`}>{finding.source === "ai" ? "AI" : "Rule"}</span>
        </div>
      </div>
      {evidence ? <EvidenceViewer evidence={evidence} /> : <p className="empty">No evidence was stored for this finding.</p>}
      {finding.evidence.length > 1 && (
        <div className="evidence-switch" role="tablist" aria-label="Evidence items">
          {finding.evidence.map((item, index) => (
            <button
              key={`${item.capturedAt}-${item.value}-${index}`}
              type="button"
              className={index === evidenceIndex ? "active" : ""}
              aria-selected={index === evidenceIndex}
              onClick={() => {
                setEvidenceIndex(index);
              }}
            >
              Evidence {index + 1}
            </button>
          ))}
        </div>
      )}
      <dl className="detail-meta">
        <div>
          <dt>Confidence</dt>
          <dd>{Math.round(confidence * 100)}%</dd>
        </div>
        <div>
          <dt>Page</dt>
          <dd><a href={finding.pageUrl}>{finding.pageUrl}</a></dd>
        </div>
        <div>
          <dt>Journey</dt>
          <dd>{finding.journeyType ? finding.journeyType.replaceAll("-", " ") : "Not part of a journey"}</dd>
        </div>
      </dl>
      <p>{finding.description}</p>
      {finding.source === "ai" && finding.aiReasoning && (
        <p className="reasoning"><span>AI reasoning. </span>{finding.aiReasoning}</p>
      )}
      {finding.suggestedRemediation && <p className="remediation">{finding.suggestedRemediation}</p>}
      {finding.regulatoryReference && (
        <details>
          <summary>Regulatory reference</summary>
          <p>{finding.regulatoryReference}</p>
        </details>
      )}
    </section>
  );
}
