export interface DarkPatternRule {
  id: string;
  name: string;
  description: string;
  /** Names the guideline that specifies this pattern. A match is not a legal ruling. */
  regulatoryReference: string;
  /** Present so later phases can attach a detector. Detection runs in the server, not here. */
  detectionStrategy: "placeholder";
}
