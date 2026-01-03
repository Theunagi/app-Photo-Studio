/**
 * Health/Growth Screen
 * Module 7: Courbe de Croissance & Dashboard Santé
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { MainTabsScreenProps } from '../../navigation/types';
import { Colors, Typography, Spacing } from '../../theme';

type Props = MainTabsScreenProps<'Health'>;

export default function HealthScreen({ navigation }: Props) {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>📊 Santé & Croissance</Text>
        <Text style={styles.subtitle}>
          Dashboard personnalisé et courbes OMS
        </Text>

        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>
            Module Santé - À implémenter
          </Text>
          <Text style={styles.description}>
            • Courbe de poids (OMS){'\n'}
            • Indicateurs globaux{'\n'}
            • Tableau de bord santé{'\n'}
            • Messages déculpabilisation
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
    borderColor: Colors.growth,
    borderStyle: 'dashed',
  },
  placeholderText: {
    ...Typography.styles.h3,
    color: Colors.growth,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  description: {
    ...Typography.styles.body,
    color: Colors.textSecondary,
    lineHeight: 24,
  },
});
