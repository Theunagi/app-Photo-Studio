/**
 * Common Types and Interfaces
 */

// Alert levels used throughout the app
export type AlertLevel = 'normal' | 'warning' | 'danger';

// Status indicator with colors
export interface StatusIndicator {
  level: AlertLevel;
  color: '🟢' | '🟠' | '🔴';
  message: string;
  details?: string;
  action?: string;
}

// Time periods for statistics
export type TimePeriod = 'today' | 'week' | 'month' | 'all';

// Generic log entry
export interface BaseLog {
  id: string;
  babyId: string;
  timestamp: string;
  createdAt: string;
  updatedAt: string;
}

// Notification types
export type NotificationType =
  | 'reminder'
  | 'milestone'
  | 'alert'
  | 'insight'
  | 'educational';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionUrl?: string;
}

// User preferences
export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  units: 'metric' | 'imperial';
  language: 'fr' | 'en';
  notifications: {
    reminders: boolean;
    insights: boolean;
    educational: boolean;
  };
}

// Parent/User profile
export interface Parent {
  id: string;
  email: string;
  name: string;
  role: 'mother' | 'father' | 'other';
  babies: string[]; // Array of baby IDs
  preferences: UserPreferences;
  createdAt: string;
  updatedAt: string;
}
