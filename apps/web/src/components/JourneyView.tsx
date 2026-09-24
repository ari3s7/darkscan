import { findingKey, type PageResult, type ReportFinding, type ScanResult } from "../api";

export function JourneyView({
  scan,
  findings,
  selectedKey,
  onSelect,
}: {
  scan: ScanResult;
  findings: ReportFinding[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Journeys</h2>
        <p className="meta">{scan.journeys.length} discovered</p>
      </div>
      {scan.journeys.length === 0 ? (
        <p className="empty">No checkout, signup, subscription, or cancellation flow was discovered.</p>
      ) : (
        <div className="journey-list">
          {scan.journeys.map((journey) => (
            <article key={journey.type} className="journey">
              <header>
                <h3>{journey.type.replaceAll("-", " ")}</h3>
                <span className={`pill status-${journey.status}`}>{journey.status.replaceAll("_", " ")}</span>
                <span className="meta">{journey.pages} pages · {journey.findings} findings</span>
              </header>
              {journey.steps.length === 0 ? (
                <p className="empty">This journey has no recorded steps.</p>
              ) : (
                <ol className="steps">
                  {journey.steps.map((step) => {
                    const page = scan.pages.find((item) => item.id === step.pageId);
                    const stepFindings = findingsForStep(findings, journey.type, step.id, step.pageId);
                    return (
                      <li key={step.id}>
                        {step.actionLabel && <p className="action">via {step.actionLabel}</p>}
                        <div className="step-card">
                          <p className="kind">{step.pageKind.replaceAll("-", " ")}</p>
                          <strong>{pageTitle(page, step.pageKind)}</strong>
                          {page && <span className="meta">{page.finalUrl ?? page.url}</span>}
                          {stepFindings.length === 0 ? (
                            <p className="quiet">No findings on this step</p>
                          ) : (
                            <ul>
                              {stepFindings.map((finding) => {
                                const key = findingKey(finding);
                                return (
                                  <li key={key}>
                                    <button
                                      type="button"
                                      className={key === selectedKey ? "selected" : ""}
                                      onClick={() => {
                                        onSelect(key);
                                      }}
                                    >
                                      {finding.ruleName}
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function pageTitle(page: PageResult | undefined, pageKind: string): string {
  if (!page) return pageKind.replaceAll("-", " ");
  return page.title ?? page.finalUrl ?? page.url;
}

function findingsForStep(
  findings: ReportFinding[],
  journeyType: string,
  stepId: string,
  pageId: string | null,
): ReportFinding[] {
  return findings.filter((finding) => {
    if (finding.journeyType !== journeyType) return false;
    const linked = finding.evidence.find((item) => item.journeyStepId)?.journeyStepId;
    if (linked) return linked === stepId;
    return pageId !== null && finding.pageId === pageId;
  });
}
