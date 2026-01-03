/**
 * Navigation Types
 * Type definitions for React Navigation
 */

import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

// Root Stack Navigator
export type RootStackParamList = {
  Onboarding: undefined;
  MainTabs: undefined;
};

// Main Bottom Tabs Navigator
export type MainTabsParamList = {
  Feeding: undefined;
  Diaper: undefined;
  Sleep: undefined;
  Diversification: undefined;
  Health: undefined;
};

// Screen props types
export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

export type MainTabsScreenProps<T extends keyof MainTabsParamList> =
  CompositeScreenProps<
    BottomTabScreenProps<MainTabsParamList, T>,
    RootStackScreenProps<keyof RootStackParamList>
  >;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
