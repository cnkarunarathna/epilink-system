/**
 * Colombo District — DS Division Disaggregation Weights
 *
 * Mirrors ml-model/src/config/colombo_ds_weights.py.
 * Weights are pre-computed composites of:
 *   50% population proportion  (Census 2012, DCS Sri Lanka)
 *   30% population density score (min-max scaled, population / area km²)
 *   20% historical dengue burden index (NCDS annual surveillance reports)
 *
 * All 13 weights sum to 1.0.
 */

export interface DsDivisionWeight {
  /** Official DS division name */
  name: string;
  /** Composite disaggregation weight (0–1, all entries sum to 1.0) */
  weight: number;
}

export const COLOMBO_DS_WEIGHTS: DsDivisionWeight[] = [
  { name: 'Thimbirigasyaya',            weight: 0.165972 },
  { name: 'Colombo',                     weight: 0.143655 },
  { name: 'Dehiwala',                    weight: 0.129146 },
  { name: 'Sri Jayawardenepura Kotte',   weight: 0.099213 },
  { name: 'Moratuwa',                    weight: 0.075972 },
  { name: 'Maharagama',                  weight: 0.075642 },
  { name: 'Kolonnawa',                   weight: 0.073569 },
  { name: 'Kesbewa',                     weight: 0.068826 },
  { name: 'Kaduwela',                    weight: 0.057124 },
  { name: 'Homagama',                    weight: 0.043966 },
  { name: 'Seethawaka',                  weight: 0.030240 },
  { name: 'Padukka',                     weight: 0.018964 },
  { name: 'Hanwella',                    weight: 0.017710 },
];

/**
 * DS-level risk thresholds (cases per DS division per week).
 * Lower than district-level thresholds because each division receives
 * roughly 1/13th of the district total on average.
 */
export const DS_RISK_THRESHOLDS = {
  low: 5,
  medium: 15,
  high: 25,
} as const;

export function classifyDsRisk(cases: number): 'low' | 'medium' | 'high' | 'critical' {
  if (cases < DS_RISK_THRESHOLDS.low) return 'low';
  if (cases < DS_RISK_THRESHOLDS.medium) return 'medium';
  if (cases < DS_RISK_THRESHOLDS.high) return 'high';
  return 'critical';
}
