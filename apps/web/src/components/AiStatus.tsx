import type { AiAnalysis } from "../api";

const COPY: Record<AiAnalysis, { title: string; detail: string }> = {
  completed: {
    title: "AI review finished",
    detail: "Ambiguous pages were checked. Rule findings stay separate from AI findings.",
  },
  skipped: {
    title: "AI review skipped",
    detail: "No ambiguous pages were sent to the model. Rule findings are unchanged.",
  },
  unavailable: {
    title: "AI review unavailable",
    detail: "The model could not be used. Rule-based findings are still shown.",
  },
};

export function AiStatus({ status }: { status: AiAnalysis }) {
  const copy = COPY[status];
  return (
    <p className={`ai-status ai-${status}`}>
      <strong>{copy.title}</strong>
      <span>{copy.detail}</span>
    </p>
  );
}
