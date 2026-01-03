/**
 * Diaper Screen (Web)
 * Module 2: Suivi des Selles
 */

import React from 'react';
import '../Feeding/FeedingScreen.css';
import './DiaperScreen.css';

const DiaperScreen: React.FC = () => {
  return (
    <div className="screen">
      <div className="screen-content">
        <h1 className="screen-title">💩 Couches & Selles</h1>
        <p className="screen-subtitle">
          Tracker simplifié avec guide visuel
        </p>

        <div className="card placeholder-card diaper">
          <h3 className="placeholder-title-diaper">Module Couches - À implémenter</h3>
          <ul className="feature-list">
            <li>• Tracker cacas/pipi rapide</li>
            <li>• Sélection couleur (⚫🟡🟢🟤🔴⚪)</li>
            <li>• Sélection texture (💧🥄🧱)</li>
            <li>• Guide visuel par âge/alimentation</li>
            <li>• Comparateur photo (IA basique)</li>
            <li>• Alertes automatiques 🟢🟠🔴</li>
          </ul>
        </div>

        <div className="info-box diaper-info">
          <p className="info-title">💡 Message clé</p>
          <p className="info-text">
            "Le VERT est NORMAL chez les bébés. Si bébé va bien, pas d'inquiétude."
          </p>
        </div>

        <div className="warning-box">
          <p className="warning-title">🚨 Selles à surveiller</p>
          <ul className="warning-list">
            <li>⚪ Blanc/gris → Consulter immédiatement</li>
            <li>🔴 Rouge vif/sang → Consulter rapidement</li>
            <li>⚫ Noir après J3 → Consulter</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default DiaperScreen;
