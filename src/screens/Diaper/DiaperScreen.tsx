/**
 * Diaper Screen
 * Module 2: Suivi des Selles
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { MainTabsScreenProps } from '../../navigation/types';
import { Colors, Typography, Spacing } from '../../theme';

type Props = MainTabsScreenProps<'Diaper'>;

export default function DiaperScreen({ navigation }: Props) {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>💩 Couches & Selles</Text>
        <Text style={styles.subtitle}>
          Tracker simplifié avec guide visuel
        </Text>

        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>
            Module Couches - À implémenter
          </Text>
          <Text style={styles.description}>
            • Tracker cacas/pipi{'\n'}
            • Guide visuel couleurs{'\n'}
            • Comparateur photo{'\n'}
            • Alertes automatiques
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.screenPadding,
  },
  title: {
    ...Typography.styles.h1,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    ...Typography.styles.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.xl,
  },
  placeholder: {
    backgroundColor: Colors.surface,
    padding: Spacing.lg,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.diaper,
    borderStyle: 'dashed',
  },
  placeholderText: {
    ...Typography.styles.h3,
    color: Colors.diaper,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  description: {
    ...Typography.styles.body,
    color: Colors.textSecondary,
    lineHeight: 24,
  },
});
