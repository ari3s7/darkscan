export interface Interaction {
  type: "button" | "link" | "input" | "checkbox" | "radio" | "form";
  text?: string;
  name?: string;
  value?: string;
  checked?: boolean;
  disabled?: boolean;
  /** Set when the control is not visible. Used later for hidden charges. */
  hidden?: boolean;
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
  visibleText: string;
  interactions: Interaction[];
  screenshotPath: string | null;
}

export class CrawlError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "CrawlError";
  }
}
