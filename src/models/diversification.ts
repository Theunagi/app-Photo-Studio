/**
 * Food Diversification Data Models
 */

export type FoodCategory = 'vegetable' | 'fruit' | 'protein' | 'cereal' | 'dairy';
export type TextureStage = 'puree' | 'mashed' | 'small_pieces' | 'finger_food';

export interface Food {
  id: string;
  name: string;
  category: FoodCategory;
  introducedAt: string; // ISO 8601 date string
  lastServed?: string; // ISO 8601 date string
  reaction?: 'none' | 'mild' | 'severe';
  notes?: string;
}

export interface FoodLog {
  id: string;
  babyId: string;
  timestamp: string; // ISO 8601 datetime string
  foodId: string;
  foodName: string;
  quantity: number; // tablespoons or grams
  texture: TextureStage;
  accepted: boolean; // Did baby accept/eat it?
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DiversificationStage {
  ageMin: number; // months
  ageMax: number; // months
  name: string;
  description: string;
  textures: TextureStage[];
  recommendations: string[];
  warnings?: string[];
}

export interface DailyMenu {
  date: string;
  meals: {
    breakfast?: MealSuggestion;
    lunch?: MealSuggestion;
    snack?: MealSuggestion;
    dinner?: MealSuggestion;
  };
}

export interface MealSuggestion {
  foods: string[];
  quantity: string; // e.g., "3-5 tablespoons"
  milkAmount?: string; // e.g., "210ml"
  note?: string;
}

export interface DiversificationStats {
  foodsIntroduced: number;
  lastIntroduction?: Food;
  currentStage: DiversificationStage;
  nextMilestone?: string;
}
