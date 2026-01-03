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

### Stack (Web App)

- **Frontend**: React 18 avec Vite
- **Navigation**: React Router v6
- **Styling**: CSS Modules avec design system CSS variables
- **Charts**: Recharts (à implémenter)
- **Backend**: Firebase (Firestore, Auth, Storage)
- **Language**: TypeScript
- **Build**: Vite (super rapide ⚡)

### Structure du Projet

```
src/
├── components/        # Composants réutilisables
│   └── layout/       # Layout components (Navigation, etc.)
├── screens/          # Pages principales
│   ├── Feeding/      # Module Alimentation
│   ├── Diaper/       # Module Couches/Selles
│   ├── Sleep/        # Module Sommeil
│   ├── Diversification/
│   ├── Growth/       # Croissance & Santé
│   └── Onboarding/   # Première connexion
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

- **Font**: System default (optimisé pour chaque OS)
- **Body**: 16px (optimal readability)
- **Titles**: 20-24px Bold
- **Key Messages**: 18px Medium

### Design System Implementation

Le design system est implémenté via **CSS Custom Properties** (variables CSS) dans `src/index.css`:
- Variables de couleurs (`--color-*`)
- Variables de spacing (`--spacing-*`)
- Variables de typography (`--font-size-*`, `--font-weight-*`)
- Variables de border radius (`--radius-*`)
- Variables de shadows (`--shadow-*`)

## 🚀 Installation & Développement

### Prérequis

- Node.js 18+
- npm ou yarn

### Setup

```bash
# Installer les dépendances
npm install

# Lancer l'app en développement (localhost:3000)
npm run dev

# Build pour production
npm run build

# Preview du build de production
npm run preview
```

## 📦 Dépendances Principales

```json
{
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "react-router-dom": "^6.26.2",
  "firebase": "^10.13.2",
  "recharts": "^2.12.7",
  "vite": "^5.4.10"
}
```

## 🔐 Système d'Alertes 🟢🟠🔴

Chaque module utilise un système de décision universel :

- **🟢 TOUT VA BIEN** - Rassurant, détendu
- **🟠 À SURVEILLER** - Vigilant mais non alarmiste
- **🔴 CONSULTER MAINTENANT** - Appel à l'action clair

## 🗺️ Roadmap

### MVP (Phase actuelle)
- [x] Setup projet web app (Vite + React)
- [x] Design system (CSS variables)
- [x] Navigation (React Router + Bottom Nav)
- [x] Modèles de données TypeScript
- [x] Structure des écrans (placeholders)
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

Ce projet est une **web app** construite avec:
- **Vite** pour un développement ultra-rapide avec HMR
- **React 18** avec les dernières fonctionnalités
- **TypeScript** pour la sécurité des types
- **React Router** pour la navigation SPA
- **CSS Custom Properties** pour un design system maintenable

### Fonctionnalités Web

✅ **Responsive Design**: Adapté mobile & desktop
✅ **Navigation**: Bottom nav sur mobile, side nav sur desktop
✅ **Performance**: Build optimisé avec Vite
✅ **SEO Ready**: Structure HTML sémantique
✅ **PWA Ready**: Peut être converti en PWA facilement

Pour toute question ou contribution, consultez la documentation complète du PRD.
