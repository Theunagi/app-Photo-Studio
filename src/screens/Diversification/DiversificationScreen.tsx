/**
 * Diversification Screen
 * Module 5: Diversification Alimentaire
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { MainTabsScreenProps } from '../../navigation/types';
import { Colors, Typography, Spacing } from '../../theme';

type Props = MainTabsScreenProps<'Diversification'>;

export default function DiversificationScreen({ navigation }: Props) {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>🥕 Diversification</Text>
        <Text style={styles.subtitle}>
          Timeline interactive et menus personnalisés
        </Text>

        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>
            Module Diversification - À implémenter
          </Text>
          <Text style={styles.description}>
            • Timeline personnalisée{'\n'}
            • Menu du jour{'\n'}
            • Checklist légumes/fruits{'\n'}
            • Planning allergènes
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
    borderColor: Colors.diversification,
    borderStyle: 'dashed',
  },
  placeholderText: {
    ...Typography.styles.h3,
    color: Colors.diversification,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  description: {
    ...Typography.styles.body,
    color: Colors.textSecondary,
    lineHeight: 24,
  },
});
