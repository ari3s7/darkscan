import { useState, type FormEvent } from "react";
import { requestScan, type ScanResult } from "./api";

export function App() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState("Idle");
  const [message, setMessage] = useState("Enter a URL to start a scan.");
  const [scan, setScan] = useState<ScanResult | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("Scanning");
    setMessage("Loading the page…");
    setScan(null);

    try {
      const result = await requestScan(url);
      const page = result.pages[0];
      const failed = result.status === "FAILED";
      setScan(result);
      setStatus(failed ? "Failed" : "Completed");
      if (failed) {
        setMessage(result.errors?.[0] ?? "Scan failed.");
      } else {
        const count = result.pages.length;
        setMessage(page?.title ? `Crawled ${count} page${count === 1 ? "" : "s"}.` : "Scan finished.");
      }
    } catch (error) {
      setStatus("Failed");
      setMessage(error instanceof Error ? error.message : "Scan failed");
    }
  }

  const page = scan?.pages[0];

  return (
    <main>
      <p className="eyebrow">Website audit</p>
      <h1>DarkScan</h1>
      <p className="lede">Submit a page URL. DarkScan crawls that site and stores each page it opens.</p>

      <form onSubmit={onSubmit}>
        <label htmlFor="url">Page URL</label>
        <div className="row">
          <input
            id="url"
            name="url"
            type="url"
            inputMode="url"
            placeholder="https://example.com"
            value={url}
            onChange={(event) => {
              setUrl(event.target.value);
            }}
            required
          />
          <button type="submit" disabled={status === "Scanning"}>
            {status === "Scanning" ? "Scanning…" : "Scan"}
          </button>
        </div>
      </form>

      <section className="status" aria-live="polite">
        <h2>Scan status</h2>
        <p className="state">{status}</p>
        <p>{message}</p>
        {scan && (
          <dl>
            <div>
              <dt>Scan</dt>
              <dd>{scan.id}</dd>
            </div>
            <div>
              <dt>Requested URL</dt>
              <dd>{scan.url}</dd>
            </div>
            <div>
              <dt>Final URL</dt>
              <dd>{page?.finalUrl ?? "—"}</dd>
            </div>
            <div>
              <dt>Title</dt>
              <dd>{page?.title ?? "—"}</dd>
            </div>
            <div>
              <dt>HTTP status</dt>
              <dd>{page?.statusCode ?? "—"}</dd>
            </div>
            <div>
              <dt>Pages</dt>
              <dd>{scan.pages.length}</dd>
            </div>
          </dl>
        )}
        {scan && scan.pages.length > 0 && (
          <ul className="pages">
            {scan.pages.map((item) => (
              <li key={item.id}>
                <span>{item.title ?? item.finalUrl ?? item.url}</span>
                <span className="meta">{item.finalUrl ?? item.url}</span>
                {item.screenshotPath && <span className="meta">{item.screenshotPath}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
