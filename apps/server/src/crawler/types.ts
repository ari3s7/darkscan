export interface Interaction {
  type: "button" | "link" | "input" | "checkbox" | "radio" | "form";
  text?: string;
  name?: string;
  value?: string;
  checked?: boolean;
  disabled?: boolean;
  /** Set when the control is not visible. Used later for hidden charges. */
  hidden?: boolean;
  /** Stable selector captured with the element, when one can be built. */
  selector?: string;
}

export interface NavigationCandidate {
  url: string;
  text?: string;
}

export interface PageExtraction {
  title: string | null;
  visibleText: string;
  language: string | null;
  description: string | null;
  interactions: Interaction[];
  navigation: NavigationCandidate[];
}

export interface CrawledPage {
  requestedUrl: string;
  finalUrl: string;
  title: string | null;
  statusCode: number | null;
  contentType: string | null;
  language: string | null;
  description: string | null;
  depth: number;
  index: number;
  visibleText: string;
  interactions: Interaction[];
  screenshotPath: string | null;
  error: string | null;
}

export interface CrawlOptions {
  maxPages: number;
  maxDepth: number;
  timeoutMs: number;
  screenshotDir: string;
  screenshotPathPrefix: string;
}

export interface CrawlResult {
  pages: CrawledPage[];
  errors: string[];
}

export class CrawlError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "CrawlError";
  }
}
