import { findingKey, type ReportFinding } from "../api";

export type SeverityFilter = "all" | ReportFinding["severity"];
export type SourceFilter = "all" | ReportFinding["source"];

export function FindingsList({
  findings,
  patterns,
  severity,
  pattern,
  source,
  selectedKey,
  onSeverity,
  onPattern,
  onSource,
  onSelect,
}: {
  findings: ReportFinding[];
  patterns: { ruleId: string; ruleName: string }[];
  severity: SeverityFilter;
  pattern: string;
  source: SourceFilter;
  selectedKey: string | null;
  onSeverity: (value: SeverityFilter) => void;
  onPattern: (value: string) => void;
  onSource: (value: SourceFilter) => void;
  onSelect: (key: string) => void;
}) {
  const visible = findings.filter((finding) => {
    if (severity !== "all" && finding.severity !== severity) return false;
    if (pattern !== "all" && finding.ruleId !== pattern) return false;
    if (source !== "all" && finding.source !== source) return false;
    return true;
  });

  return (
    <section className="panel findings">
      <div className="panel-head">
        <h2>Findings</h2>
        <p className="meta">{visible.length} shown</p>
      </div>
      <div className="filters">
        <label>
          Severity
          <select
            value={severity}
            onChange={(event) => {
              const value = event.target.value;
              if (value === "all" || value === "low" || value === "medium" || value === "high") onSeverity(value);
            }}
          >
            <option value="all">All</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>
        <label>
          Pattern
          <select
            value={pattern}
            onChange={(event) => {
              onPattern(event.target.value);
            }}
          >
            <option value="all">All</option>
            {patterns.map((item) => (
              <option key={item.ruleId} value={item.ruleId}>{item.ruleName}</option>
            ))}
          </select>
        </label>
        <label>
          Source
          <select
            value={source}
            onChange={(event) => {
              const value = event.target.value;
              if (value === "all" || value === "rule" || value === "ai") onSource(value);
            }}
          >
            <option value="all">All</option>
            <option value="rule">Rule</option>
            <option value="ai">AI</option>
          </select>
        </label>
      </div>
      {findings.length === 0 ? (
        <p className="empty">No potential patterns were recorded for this scan.</p>
      ) : visible.length === 0 ? (
        <p className="empty">No findings match these filters.</p>
      ) : (
        <ul className="finding-list">
          {visible.map((finding) => {
            const key = findingKey(finding);
            const quote = finding.evidence[0]?.value;
            return (
              <li key={key}>
                <button
                  type="button"
                  className={key === selectedKey ? "selected" : ""}
                  aria-pressed={key === selectedKey}
                  onClick={() => {
                    onSelect(key);
                  }}
                >
                  <span className="finding-title">
                    <strong>{finding.ruleName}</strong>
                    <span className={`pill sev-${finding.severity}`}>{finding.severity}</span>
                    <span className={`pill source-${finding.source}`}>{finding.source === "ai" ? "AI" : "Rule"}</span>
                  </span>
                  {quote && <span className="quote">{quote}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
