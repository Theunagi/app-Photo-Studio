/**
 * Feeding (Alimentation) Data Models
 */

export type FeedingType = 'bottle' | 'breastfeeding' | 'solid';

export interface FeedingLog {
  id: string;
  babyId: string;
  timestamp: string; // ISO 8601 datetime string
  type: FeedingType;
  quantity?: number; // ml for bottle, grams for solid
  duration?: number; // minutes for breastfeeding
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FeedingInput {
  type: FeedingType;
  quantity?: number;
  duration?: number;
  notes?: string;
}

export interface FeedingRecommendation {
  minQuantity: number; // ml per day
  maxQuantity: number; // ml per day
  perFeeding: {
    min: number;
    max: number;
  };
  feedingsPerDay: number;
  message: string;
}

export interface FeedingStats {
  dailyTotal: number;
  feedingsToday: number;
  averagePerFeeding: number;
  lastFeeding?: FeedingLog;
}
