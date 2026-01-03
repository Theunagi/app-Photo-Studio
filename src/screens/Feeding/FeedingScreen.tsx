/**
 * Feeding Screen
 * Module 1: Alimentation Lactée (0-12 months)
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { MainTabsScreenProps } from '../../navigation/types';
import { Colors, Typography, Spacing } from '../../theme';

type Props = MainTabsScreenProps<'Feeding'>;

export default function FeedingScreen({ navigation }: Props) {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>🍼 Alimentation</Text>
        <Text style={styles.subtitle}>
          Calculateur intelligent et suivi des biberons
        </Text>

        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>
            Module Alimentation - À implémenter
          </Text>
          <Text style={styles.description}>
            • Calculateur quantité lait{'\n'}
            • Tracker biberons{'\n'}
            • Graphique semaine{'\n'}
            • Indicateurs rassurants
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
    borderColor: Colors.feeding,
    borderStyle: 'dashed',
  },
  placeholderText: {
    ...Typography.styles.h3,
    color: Colors.feeding,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  description: {
    ...Typography.styles.body,
    color: Colors.textSecondary,
    lineHeight: 24,
  },
});
