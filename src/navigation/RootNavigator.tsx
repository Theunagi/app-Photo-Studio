/**
 * Root Navigation
 * Handles Onboarding -> Main App flow
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import { Colors } from '../theme';

// Import navigators and screens
import MainTabNavigator from './MainTabNavigator';
import OnboardingScreen from '../screens/Onboarding/OnboardingScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  // TODO: Check if user has completed onboarding
  // For now, we'll always show MainTabs
  const hasCompletedOnboarding = true;

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={hasCompletedOnboarding ? 'MainTabs' : 'Onboarding'}
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.background },
        }}
      >
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="MainTabs" component={MainTabNavigator} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
