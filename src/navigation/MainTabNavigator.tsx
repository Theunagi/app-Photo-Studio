/**
 * Main Bottom Tab Navigator
 * 5 tabs: Feeding, Diaper, Sleep, Diversification, Health
 */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Platform, Text } from 'react-native';
import { MainTabsParamList } from './types';
import { Colors, Sizing } from '../theme';

// Import screens (we'll create placeholders for now)
import FeedingScreen from '../screens/Feeding/FeedingScreen';
import DiaperScreen from '../screens/Diaper/DiaperScreen';
import SleepScreen from '../screens/Sleep/SleepScreen';
import DiversificationScreen from '../screens/Diversification/DiversificationScreen';
import HealthScreen from '../screens/Growth/HealthScreen';

const Tab = createBottomTabNavigator<MainTabsParamList>();

export default function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textLight,
        tabBarStyle: {
          height: Platform.OS === 'ios' ? 85 : 60,
          paddingBottom: Platform.OS === 'ios' ? 25 : 8,
          paddingTop: 8,
          backgroundColor: Colors.surface,
          borderTopColor: Colors.surfaceAlt,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
        headerStyle: {
          backgroundColor: Colors.primary,
        },
        headerTintColor: Colors.surface,
        headerTitleStyle: {
          fontWeight: '600',
          fontSize: 18,
        },
      }}
    >
      <Tab.Screen
        name="Feeding"
        component={FeedingScreen}
        options={{
          title: 'Alimentation',
          tabBarLabel: 'Alim.',
          tabBarIcon: ({ color, size }) => (
            // For now, we'll use emoji. In production, use proper icons
            <TabIcon emoji="🍼" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Diaper"
        component={DiaperScreen}
        options={{
          title: 'Couches',
          tabBarLabel: 'Cacas',
          tabBarIcon: ({ color, size }) => (
            <TabIcon emoji="💩" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Sleep"
        component={SleepScreen}
        options={{
          title: 'Sommeil',
          tabBarLabel: 'Sommeil',
          tabBarIcon: ({ color, size }) => (
            <TabIcon emoji="😴" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Diversification"
        component={DiversificationScreen}
        options={{
          title: 'Diversification',
          tabBarLabel: 'Div.',
          tabBarIcon: ({ color, size }) => (
            <TabIcon emoji="🥕" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Health"
        component={HealthScreen}
        options={{
          title: 'Santé',
          tabBarLabel: 'Santé',
          tabBarIcon: ({ color, size }) => (
            <TabIcon emoji="📊" color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// Simple emoji-based tab icon component
// In production, replace with proper icon library
interface TabIconProps {
  emoji: string;
  color: string;
  size: number;
}

function TabIcon({ emoji, color, size }: TabIconProps) {
  return (
    <Text style={{ fontSize: size, opacity: color === Colors.primary ? 1 : 0.5 }}>
      {emoji}
    </Text>
  );
}
