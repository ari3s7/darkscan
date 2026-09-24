export const PAGE_KINDS = [
  "landing",
  "product",
  "pricing",
  "cart",
  "checkout",
  "signup",
  "login",
  "subscription",
  "confirmation",
  "cancellation",
  "unknown",
] as const;

export type PageKind = (typeof PAGE_KINDS)[number];

export type JourneyStatus = "discovered" | "in_progress" | "completed" | "blocked";

export type ActionKind =
  | "add-to-cart"
  | "buy-now"
  | "continue"
  | "checkout"
  | "subscribe"
  | "start-free-trial"
  | "sign-up"
  | "cancel"
  | "manage-subscription"
  | "continue-without"
  | "decline"
  | "remove";

/** Proposed by the detector. The interaction handler makes the final safety decision. */
export type FollowMode = "link" | "click" | "none";

export interface PageField {
  type: string;
  name?: string;
  text?: string;
  hidden?: boolean;
}

export interface PageSignals {
  url: string;
  title: string | null;
  headings: string[];
  buttons: string[];
  visibleText: string;
  fields: PageField[];
}

export interface JourneyAction {
  label: string;
  selector?: string;
  type: string;
}

export interface DiscoveredAction extends JourneyAction {
  kind: ActionKind;
  follow: FollowMode;
  href?: string;
}

export interface JourneyStepRecord {
  url: string;
  kind: PageKind;
  actionLabel?: string;
  actionSelector?: string;
  actionType?: string;
}

export interface JourneyRecord {
  type: string;
  pages: string[];
  actions: JourneyAction[];
  status: JourneyStatus;
  steps: JourneyStepRecord[];
}

export interface VisitRecord {
  url: string;
  kind: PageKind;
  blocked: boolean;
  actions: JourneyAction[];
  arrival?: JourneyAction;
}
