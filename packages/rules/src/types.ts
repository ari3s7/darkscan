export interface DarkPatternRule {
  id: string;
  name: string;
  description: string;
  /** Present so later phases can attach a detector. Not executed in phase 1. */
  detectionStrategy: "placeholder";
}
