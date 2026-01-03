/**
 * Baby Profile Data Model
 */

export type Sex = 'M' | 'F' | 'other';

export interface Baby {
  id: string;
  name: string;
  birthDate: string; // ISO 8601 date string
  sex: Sex;
  avatar?: string; // URL to avatar image
  createdAt: string;
  updatedAt: string;
}

export interface BabyInput {
  name: string;
  birthDate: string;
  sex: Sex;
  avatar?: string;
}
