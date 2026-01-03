/**
 * Onboarding Screen
 * First-time user experience - baby profile creation
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { RootStackScreenProps } from '../../navigation/types';
import { Colors, Typography, Spacing } from '../../theme';

type Props = RootStackScreenProps<'Onboarding'>;

export default function OnboardingScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>👶 Bienvenue sur BabyGuide</Text>
        <Text style={styles.subtitle}>
          Votre compagnon anti-anxiété pour les 0-3 ans
        </Text>

        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>
            Écran Onboarding - À implémenter
          </Text>
          <Text style={styles.description}>
            • Création profil bébé{'\n'}
            • Nom, date de naissance, sexe{'\n'}
            • Photo avatar{'\n'}
            • Navigation vers app principale
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  content: {
    flex: 1,
    padding: Spacing.screenPadding,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    ...Typography.styles.h1,
    fontSize: 28,
    color: Colors.surface,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  subtitle: {
    ...Typography.styles.body,
    color: Colors.surface,
    marginBottom: Spacing.xl,
    textAlign: 'center',
    opacity: 0.9,
  },
  placeholder: {
    backgroundColor: Colors.surface,
    padding: Spacing.lg,
    borderRadius: 12,
    marginTop: Spacing.xl,
    width: '100%',
  },
  placeholderText: {
    ...Typography.styles.h3,
    color: Colors.primary,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  description: {
    ...Typography.styles.body,
    color: Colors.textSecondary,
    lineHeight: 24,
  },
});
