import { useEffect, useState } from "react";
import { mediaUrl, type ReportEvidence } from "../api";

export function EvidenceViewer({ evidence }: { evidence: ReportEvidence }) {
  const src = mediaUrl(evidence.screenshotPath);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const box = evidence.box;

  useEffect(() => {
    setSize(null);
  }, [src]);

  if (!src) {
    return (
      <figure className="evidence">
        <blockquote>{evidence.value}</blockquote>
        <figcaption>
          <span>{evidence.pageUrl}</span>
          {evidence.selector && <code>{evidence.selector}</code>}
        </figcaption>
      </figure>
    );
  }

  const highlight = box && size && size.width > 0 && size.height > 0
    ? {
        left: `${(box.x / size.width) * 100}%`,
        top: `${(box.y / size.height) * 100}%`,
        width: `${(box.width / size.width) * 100}%`,
        height: `${(box.height / size.height) * 100}%`,
      }
    : null;

  return (
    <figure className="evidence">
      <div className="evidence-frame">
        <div className="evidence-shot">
          <img
            src={src}
            alt=""
            onLoad={(event) => {
              const image = event.currentTarget;
              setSize({ width: image.naturalWidth, height: image.naturalHeight });
            }}
          />
          {highlight && <span className="highlight" style={highlight} />}
        </div>
      </div>
      <figcaption>
        <blockquote>{evidence.value}</blockquote>
        <span className="meta">{evidence.pageUrl}</span>
        {evidence.selector && <code>{evidence.selector}</code>}
      </figcaption>
    </figure>
  );
}
