import type { FormEvent } from "react";

export function ScanForm({
  url,
  busy,
  onUrlChange,
  onSubmit,
}: {
  url: string;
  busy: boolean;
  onUrlChange: (url: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="scan-form" onSubmit={onSubmit}>
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
            onUrlChange(event.target.value);
          }}
          required
          disabled={busy}
        />
        <button type="submit" disabled={busy}>
          {busy ? "Scanning…" : "Start Scan"}
        </button>
      </div>
    </form>
  );
}
