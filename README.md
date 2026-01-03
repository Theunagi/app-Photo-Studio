# BabyGuide - L'Application d'Accompagnement Parental 0-3 ans

BabyGuide est un compagnon anti-anxiété qui transforme l'incertitude parentale en confiance sereine.

## 🎯 Vision

**BabyGuide** n'est pas une application médicale, c'est un **compagnon anti-anxiété** pour les jeunes parents. L'objectif est la **réduction du stress** par la clarté, la simplicité et la réassurance intelligente.

## 📱 Modules Principaux

1. **🍼 Alimentation Lactée** - Calculateur intelligent et tracker de biberons
2. **💩 Suivi des Selles** - Tracker simplifié avec guide visuel
3. **🤮 Régurgitations & Vomissements** - Différenciation et alertes
4. **😴 Sommeil & Réveils** - Interface contextuelle par âge
5. **🥕 Diversification Alimentaire** - Timeline interactive et menus
6. **🥜 Allergènes** - Guide d'introduction pas à pas
7. **📊 Croissance & Santé** - Courbes OMS et dashboard global

## 🏗️ Architecture Technique

### Stack

- **Frontend**: React Native avec Expo
- **Navigation**: React Navigation (Bottom Tabs + Stack)
- **Charts**: react-native-chart-kit
- **Backend**: Firebase (Firestore, Auth, Storage)
- **Language**: TypeScript

### Structure du Projet

```
src/
├── components/        # Composants réutilisables
├── screens/          # Écrans principaux
│   ├── Feeding/      # Module Alimentation
│   ├── Diaper/       # Module Couches/Selles
│   ├── Sleep/        # Module Sommeil
│   ├── Diversification/
│   ├── Allergens/
│   ├── Growth/       # Croissance & Santé
│   └── Onboarding/   # Première connexion
├── navigation/       # Configuration navigation
├── theme/            # Design system (couleurs, typo, spacing)
├── models/           # Types TypeScript et modèles de données
├── services/         # Services (Firebase, etc.)
├── utils/            # Fonctions utilitaires
└── constants/        # Constantes app
```

## 🎨 Design System

### Couleurs Principales

- **Primary**: #5B9BD5 (Bleu doux - confiance, sérénité)
- **Secondary**: #A8D08D (Vert menthe - croissance, nature)
- **Success**: #92D050 🟢 (Tout va bien)
- **Warning**: #FFC000 🟠 (À surveiller)
- **Danger**: #FF5050 🔴 (Consulter maintenant)

### Typographie

- **Font**: System default (San Francisco iOS / Roboto Android)
- **Body**: 16px (optimal readability)
- **Titles**: 20-24px Bold
- **Key Messages**: 18px Medium

## 🚀 Installation

### Prérequis

- Node.js 18+
- npm ou yarn
- Expo CLI

### Setup

```bash
# Installer les dépendances
npm install

# Lancer l'app en développement
npm start

# Lancer sur iOS
npm run ios

# Lancer sur Android
npm run android

# Lancer sur Web
npm run web
```

## 📦 Dépendances Principales

```json
{
  "@react-navigation/native": "Navigation",
  "@react-navigation/bottom-tabs": "Bottom tabs",
  "@react-navigation/native-stack": "Stack navigation",
  "firebase": "Backend services",
  "react-native-chart-kit": "Charts & graphs",
  "expo-image-picker": "Photo upload",
  "@react-native-async-storage/async-storage": "Local storage"
}
```

## 🔐 Système d'Alertes 🟢🟠🔴

Chaque module utilise un système de décision universel :

- **🟢 TOUT VA BIEN** - Rassurant, détendu
- **🟠 À SURVEILLER** - Vigilant mais non alarmiste
- **🔴 CONSULTER MAINTENANT** - Appel à l'action clair

## 🗺️ Roadmap

### MVP (Phase actuelle)
- [x] Setup projet et architecture
- [x] Design system
- [x] Navigation de base
- [x] Modèles de données
- [ ] Module Alimentation Lactée
- [ ] Module Couches/Selles
- [ ] Module Régurgitations
- [ ] Système d'alertes 🟢🟠🔴

### V2
- [ ] Module Sommeil
- [ ] Module Diversification
- [ ] Module Allergènes
- [ ] Export PDF rapports
- [ ] Mode multi-parents

### V3
- [ ] IA détection photos
- [ ] Chatbot assistant
- [ ] Téléconsultation pédiatre
- [ ] Rappels vaccinations

## ⚠️ Disclaimers

**IMPORTANT**: BabyGuide est un outil d'information et de suivi, **PAS un avis médical**.

En cas de doute, consultez toujours un professionnel de santé.
- **France**: 15
- **Europe**: 112

## 📄 Licence

Propriétaire - Tous droits réservés

## 👨‍💻 Développement

Ce projet a été initialisé avec [Expo](https://expo.dev/) et suit les meilleures pratiques React Native.

Pour toute question ou contribution, consultez la documentation complète du PRD.
