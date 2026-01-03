/**
 * Growth & Weight Tracking Data Models
 */

export type MeasurementType = 'weight' | 'height' | 'head_circumference';

export interface GrowthMeasurement {
  id: string;
  babyId: string;
  date: string; // ISO 8601 date string
  weight?: number; // grams
  height?: number; // centimeters
  headCircumference?: number; // centimeters
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GrowthInput {
  date: string;
  weight?: number;
  height?: number;
  headCircumference?: number;
  notes?: string;
}

export interface PercentileData {
  age: number; // days
  percentiles: {
    p3: number;
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
    p97: number;
  };
}

export interface GrowthStats {
  currentWeight?: number;
  currentHeight?: number;
  currentHeadCircumference?: number;
  weightPercentile?: number;
  heightPercentile?: number;
  weightGainRate?: number; // grams per week
  lastMeasurement?: GrowthMeasurement;
  isFollowingCurve: boolean;
  trend: 'increasing' | 'stable' | 'decreasing';
}

export interface HealthIndicators {
  curveProgression: 'normal' | 'warning';
  wetDiapersPerDay: number;
  feeding: 'adequate' | 'insufficient';
  alertness: 'interactive' | 'normal' | 'lethargic';
  overallHealth: 'good' | 'monitor' | 'consult';
}

export interface GrowthAlert {
  level: 'normal' | 'warning' | 'danger';
  message: string;
  details?: string;
}
