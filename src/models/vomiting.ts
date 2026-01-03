/**
 * Vomiting & Regurgitation Data Models
 */

export type VomitingType = 'regurgitation' | 'vomit' | 'projectile';
export type VomitingVolume = 'small' | 'medium' | 'large';
export type BabyMood = 'happy' | 'grumpy' | 'lethargic';

export interface VomitingLog {
  id: string;
  babyId: string;
  timestamp: string; // ISO 8601 datetime string
  type: VomitingType;
  volume: VomitingVolume;
  babyMood: BabyMood;
  hasEffort: boolean; // Did baby strain?
  color?: string; // Description of color (e.g., "greenish", "normal milk")
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VomitingInput {
  type: VomitingType;
  volume: VomitingVolume;
  babyMood: BabyMood;
  hasEffort: boolean;
  color?: string;
  notes?: string;
}

export interface VomitingStats {
  regurgitationsToday: number;
  vomitsToday: number;
  projectileVomitsToday: number;
  lastIncident?: VomitingLog;
}

export interface VomitingAlert {
  level: 'normal' | 'warning' | 'danger';
  message: string;
  signs?: string[];
  action?: string;
}
