import { pageKind, type ScanResult } from "../api";

export function ScanProgress({
  scan,
  message,
}: {
  scan: ScanResult | null;
  message: string;
}) {
  const pages = scan?.pages ?? [];
  return (
    <section className="panel" aria-live="polite">
      <div className="panel-head">
        <h2>Scan progress</h2>
        <p className="state">{scan ? labelStatus(scan.status) : "Scanning"}</p>
      </div>
      <p className="message">{message}</p>
      <dl className="progress-stats">
        <div>
          <dt>Pages discovered</dt>
          <dd>{pages.length}</dd>
        </div>
        <div>
          <dt>Journeys</dt>
          <dd>{scan?.journeys.length ?? 0}</dd>
        </div>
        <div>
          <dt>Detection</dt>
          <dd>{scan && !isOpen(scan.status) ? "Finished" : "Running"}</dd>
        </div>
      </dl>
      {pages.length === 0 ? (
        <p className="empty">Pages show up here as the crawler reports them.</p>
      ) : (
        <ul className="page-list">
          {pages.map((page, index) => {
            const kind = pageKind(page);
            return (
              <li key={page.id}>
                <span className="index">{String(index + 1).padStart(2, "0")}</span>
                <span>
                  <strong>{page.title ?? page.finalUrl ?? page.url}</strong>
                  <span className="meta">{page.finalUrl ?? page.url}</span>
                </span>
                {kind && <span className="pill">{kind.replaceAll("-", " ")}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function isOpen(status: string): boolean {
  return status === "PENDING" || status === "RUNNING";
}

function labelStatus(status: string): string {
  if (status === "RUNNING" || status === "PENDING") return "Scanning";
  if (status === "COMPLETED") return "Completed";
  if (status === "FAILED") return "Failed";
  return status;
}
