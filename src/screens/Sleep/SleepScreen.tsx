/**
 * Sleep Screen
 * Module 4: Sommeil & Réveils
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { MainTabsScreenProps } from '../../navigation/types';
import { Colors, Typography, Spacing } from '../../theme';

type Props = MainTabsScreenProps<'Sleep'>;

export default function SleepScreen({ navigation }: Props) {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>😴 Sommeil</Text>
        <Text style={styles.subtitle}>
          Interface contextuelle par âge
        </Text>

        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>
            Module Sommeil - À implémenter
          </Text>
          <Text style={styles.description}>
            • Tracker réveils nuit{'\n'}
            • Timeline sommeil{'\n'}
            • Messages adaptatifs par âge{'\n'}
            • Gestion pleurs du soir
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
    borderColor: Colors.sleep,
    borderStyle: 'dashed',
  },
  placeholderText: {
    ...Typography.styles.h3,
    color: Colors.sleep,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  description: {
    ...Typography.styles.body,
    color: Colors.textSecondary,
    lineHeight: 24,
  },
});
