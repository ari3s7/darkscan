import { pageKind, type ComplianceReport, type ScanResult } from "../api";
import { AiStatus } from "./AiStatus";

export function ResultsDashboard({
  scan,
  report,
}: {
  scan: ScanResult;
  report: ComplianceReport;
}) {
  const severity = report.summary.findingsBySeverity;
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Results</h2>
        <p className="meta">{scan.url}</p>
      </div>
      <div className="stats">
        <article>
          <p>Findings</p>
          <strong>{report.summary.totalFindings}</strong>
        </article>
        <article className="sev-high">
          <p>High</p>
          <strong>{severity.high}</strong>
        </article>
        <article className="sev-medium">
          <p>Medium</p>
          <strong>{severity.medium}</strong>
        </article>
        <article className="sev-low">
          <p>Low</p>
          <strong>{severity.low}</strong>
        </article>
        <article>
          <p>Pages</p>
          <strong>{report.summary.pagesCrawled}</strong>
        </article>
        <article>
          <p>Journeys</p>
          <strong>{report.summary.journeysDiscovered}</strong>
        </article>
      </div>
      <AiStatus status={report.summary.aiAnalysis} />
      {scan.errors.length > 0 && (
        <div className="page-note">
          <p>Some pages could not be opened. The rest of the scan was kept.</p>
          <ul>
            {scan.errors.slice(0, 4).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      <ul className="page-list compact">
        {scan.pages.map((page) => {
          const kind = pageKind(page);
          return (
            <li key={page.id}>
              <span>
                <strong>{page.title ?? page.finalUrl ?? page.url}</strong>
                <span className="meta">{page.finalUrl ?? page.url}</span>
              </span>
              {kind && <span className="pill">{kind.replaceAll("-", " ")}</span>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
