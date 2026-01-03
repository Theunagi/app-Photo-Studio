/**
 * Feeding Screen (Web)
 * Module 1: Alimentation Lactée (0-12 months)
 */

import React from 'react';
import './FeedingScreen.css';

const FeedingScreen: React.FC = () => {
  return (
    <div className="screen">
      <div className="screen-content">
        <h1 className="screen-title">🍼 Alimentation</h1>
        <p className="screen-subtitle">
          Calculateur intelligent et suivi des biberons
        </p>

        <div className="card placeholder-card feeding">
          <h3 className="placeholder-title">Module Alimentation - À implémenter</h3>
          <ul className="feature-list">
            <li>• Calculateur quantité lait (âge + poids)</li>
            <li>• Tracker biberons avec horodatage</li>
            <li>• Graphique semaine</li>
            <li>• Indicateurs rassurants 🟢🟠🔴</li>
            <li>• Zone verte large (pas anxiogène)</li>
            <li>• Messages déculpabilisants</li>
          </ul>
        </div>

        <div className="info-box">
          <p className="info-title">💡 Principe clé</p>
          <p className="info-text">
            "Si bébé va bien, arrêtez de compter. La variation quotidienne est NORMALE."
          </p>
        </div>
      </div>
    </div>
  );
};

export default FeedingScreen;
