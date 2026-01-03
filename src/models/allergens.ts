/**
 * Allergens Introduction Data Models
 */

export type AllergenType =
  | 'peanut'
  | 'egg'
  | 'milk'
  | 'fish'
  | 'shellfish'
  | 'soy'
  | 'wheat'
  | 'tree_nuts'
  | 'sesame';

export type ReactionSeverity = 'none' | 'mild' | 'moderate' | 'severe';

export interface AllergenIntroduction {
  allergen: AllergenType;
  introduced: boolean;
  introductionDate?: string; // ISO 8601 date string
  lastReintroduction?: string; // ISO 8601 date string
  reaction: ReactionSeverity;
  reactionDetails?: string;
  frequency: number; // Times per week
  notes?: string;
}

export interface AllergenLog {
  id: string;
  babyId: string;
  timestamp: string; // ISO 8601 datetime string
  allergen: AllergenType;
  amount: string; // e.g., "1/2 teaspoon"
  reaction: ReactionSeverity;
  symptoms?: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AllergenInput {
  allergen: AllergenType;
  amount: string;
  reaction: ReactionSeverity;
  symptoms?: string[];
  notes?: string;
}

export interface AllergenGuide {
  allergen: AllergenType;
  name: string;
  recommendedAge: { min: number; max: number }; // months
  howToIntroduce: string;
  amount: string;
  frequency: string;
  warningSigns: string[];
  emergencySigns: string[];
}

export interface AllergenAlert {
  level: 'info' | 'warning' | 'emergency';
  message: string;
  action: string;
}

export interface AllergenStats {
  introduced: number;
  pending: number;
  nextToIntroduce?: AllergenType;
  nextReminderDate?: string;
}
