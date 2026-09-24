import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  findingKey,
  getReport,
  isRunning,
  pollScan,
  requestScan,
  type ComplianceReport,
  type ReportFinding,
  type ScanResult,
} from "./api";
import { FindingDetail } from "./components/FindingDetail";
import { FindingsList, type SeverityFilter, type SourceFilter } from "./components/FindingsList";
import { JourneyView } from "./components/JourneyView";
import { ResultsDashboard } from "./components/ResultsDashboard";
import { ScanForm } from "./components/ScanForm";
import { ScanProgress } from "./components/ScanProgress";

type Phase = "idle" | "scanning" | "completed" | "failed";

const WORKFLOW = ["URL", "Scan", "Progress", "Journeys", "Findings", "Evidence", "Report"];

export function App() {
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState("Enter a URL to start a scan.");
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [report, setReport] = useState<ComplianceReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [severity, setSeverity] = useState<SeverityFilter>("all");
  const [pattern, setPattern] = useState("all");
  const [source, setSource] = useState<SourceFilter>("all");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const visibleFindings = (report?.findings ?? []).filter((finding) => matches(finding, severity, pattern, source));
  const selected = visibleFindings.find((finding) => findingKey(finding) === selectedKey) ?? visibleFindings[0] ?? null;
  const activeKey = selected ? findingKey(selected) : null;

  function selectFinding(key: string) {
    const finding = report?.findings.find((item) => findingKey(item) === key);
    if (finding) {
      if (severity !== "all" && finding.severity !== severity) setSeverity("all");
      if (pattern !== "all" && finding.ruleId !== pattern) setPattern("all");
      if (source !== "all" && finding.source !== source) setSource("all");
    }
    setSelectedKey(key);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase("scanning");
    setMessage("Crawling the site and running detection.");
    setScan(null);
    setReport(null);
    setError(null);
    setSelectedKey(null);
    setSeverity("all");
    setPattern("all");
    setSource("all");

    try {
      let current = await requestScan(url, controller.signal);
      if (controller.signal.aborted) return;
      setScan(current);
      if (isRunning(current.status)) {
        setMessage("Crawl in progress. Checking for newly discovered pages.");
        current = await pollScan(current.id, setScan, controller.signal);
      }
      if (current.status === "FAILED") {
        setPhase("failed");
        setError(current.errors[0] ?? "Scan failed.");
        return;
      }
      setMessage("Preparing findings, journeys, and evidence.");
      const nextReport = await getReport(current.id, controller.signal);
      if (controller.signal.aborted) return;
      setReport(nextReport);
      const first = nextReport.findings[0];
      setSelectedKey(first ? findingKey(first) : null);
      setPhase("completed");
    } catch (caught) {
      if (isAbort(caught)) return;
      setPhase("failed");
      setError(caught instanceof Error ? caught.message : "Scan failed");
    }
  }

  return (
    <main>
      <header className="top">
        <div>
          <p className="eyebrow">Website audit</p>
          <h1>DarkScan</h1>
        </div>
        <ScanForm url={url} busy={phase === "scanning"} onUrlChange={setUrl} onSubmit={onSubmit} />
      </header>

      {phase === "idle" && (
        <section className="panel idle">
          <h2>Workflow</h2>
          <ol className="workflow">
            {WORKFLOW.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <p>{message}</p>
        </section>
      )}

      {phase === "scanning" && <ScanProgress scan={scan} message={message} />}

      {phase === "failed" && (
        <section className="panel failure" role="alert">
          <h2>Scan failed</h2>
          <p>{error ?? "Scan failed."}</p>
          {scan && scan.pages.length > 0 && <ScanProgress scan={scan} message="Pages captured before the scan stopped." />}
        </section>
      )}

      {phase === "completed" && scan && report && (
        <>
          <ResultsDashboard scan={scan} report={report} />
          <div className="workspace">
            <FindingsList
              findings={report.findings}
              patterns={report.summary.findingsByPattern}
              severity={severity}
              pattern={pattern}
              source={source}
              selectedKey={activeKey}
              onSeverity={setSeverity}
              onPattern={setPattern}
              onSource={setSource}
              onSelect={selectFinding}
            />
            <FindingDetail key={activeKey ?? "empty"} finding={selected} />
          </div>
          <JourneyView
            scan={scan}
            findings={report.findings}
            selectedKey={activeKey}
            onSelect={selectFinding}
          />
          <p className="disclaimer">
            Findings describe potential patterns. They are not a determination that a page is non-compliant.
          </p>
        </>
      )}
    </main>
  );
}

function matches(finding: ReportFinding, severity: SeverityFilter, pattern: string, source: SourceFilter): boolean {
  if (severity !== "all" && finding.severity !== severity) return false;
  if (pattern !== "all" && finding.ruleId !== pattern) return false;
  if (source !== "all" && finding.source !== source) return false;
  return true;
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
