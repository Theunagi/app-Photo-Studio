/**
 * Sleep Data Models
 */

export type SleepType = 'night' | 'nap';

export interface SleepLog {
  id: string;
  babyId: string;
  startTime: string; // ISO 8601 datetime string
  endTime?: string; // ISO 8601 datetime string (null if still sleeping)
  type: SleepType;
  wakings?: number; // Number of wakings during this sleep period
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SleepInput {
  startTime: string;
  endTime?: string;
  type: SleepType;
  wakings?: number;
  notes?: string;
}

export interface SleepStats {
  totalSleepToday: number; // minutes
  napsToday: number;
  nightSleepDuration?: number; // minutes
  wakingsLastNight: number;
  longestStretch?: number; // minutes
  lastSleep?: SleepLog;
}

export interface SleepWaking {
  timestamp: string;
  reason?: 'feeding' | 'diaper' | 'unknown';
}

export interface SleepRecommendation {
  averageSleep: { min: number; max: number }; // hours per day
  message: string;
  tips?: string[];
}
