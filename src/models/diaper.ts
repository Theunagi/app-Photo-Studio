/**
 * Diaper (Selles) Data Models
 */

export type DiaperColor = 'black' | 'yellow' | 'green' | 'brown' | 'red' | 'white';
export type DiaperTexture = 'liquid' | 'soft' | 'hard';
export type DiaperType = 'poop' | 'pee' | 'both';

export interface DiaperLog {
  id: string;
  babyId: string;
  timestamp: string; // ISO 8601 datetime string
  type: DiaperType;
  color?: DiaperColor; // Only for poop
  texture?: DiaperTexture; // Only for poop
  photo?: string; // URL to photo
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DiaperInput {
  type: DiaperType;
  color?: DiaperColor;
  texture?: DiaperTexture;
  photo?: string;
  notes?: string;
}

export interface DiaperStats {
  poopsToday: number;
  peesToday: number;
  lastPoop?: DiaperLog;
  lastPee?: DiaperLog;
  hoursSinceLastPoop: number;
  hoursSinceLastPee: number;
}

export interface DiaperAlert {
  level: 'normal' | 'warning' | 'danger';
  message: string;
  action?: string;
}
