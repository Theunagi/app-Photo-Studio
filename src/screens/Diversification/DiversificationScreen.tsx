/**
 * Diversification Screen (Web)
 * Module 5: Diversification Alimentaire
 */

import React from 'react';
import '../Feeding/FeedingScreen.css';
import './DiversificationScreen.css';

const DiversificationScreen: React.FC = () => {
  return (
    <div className="screen">
      <div className="screen-content">
        <h1 className="screen-title">🥕 Diversification</h1>
        <p className="screen-subtitle">
          Timeline interactive et menus personnalisés
        </p>

        <div className="card placeholder-card diversification">
          <h3 className="placeholder-title-diversification">Module Diversification - À implémenter</h3>
          <ul className="feature-list">
            <li>• Timeline personnalisée par âge</li>
            <li>• Menu du jour suggéré</li>
            <li>• Checklist légumes/fruits</li>
            <li>• Planning allergènes (🥜🥚🐟)</li>
            <li>• Progression textures</li>
            <li>• Rappels introduction</li>
          </ul>
        </div>

        <div className="timeline-preview">
          <div className="timeline-stage completed">
            <div className="timeline-marker">✅</div>
            <div className="timeline-content">
              <h4>4-6 mois : DÉCOUVERTE</h4>
              <p>Quelques cuillères/jour • UN aliment à la fois</p>
            </div>
          </div>
          <div className="timeline-stage current">
            <div className="timeline-marker">➡️</div>
            <div className="timeline-content">
              <h4>6-8 mois : PROGRESSION</h4>
              <p>Textures plus épaisses • Protéines 10g/j</p>
            </div>
          </div>
          <div className="timeline-stage future">
            <div className="timeline-marker">⏸️</div>
            <div className="timeline-content">
              <h4>8-12 mois : MORCEAUX</h4>
              <p>⚠️ Avant 10 mois = crucial pour éviter refus</p>
            </div>
          </div>
        </div>

        <div className="info-box diversification-info">
          <p className="info-title">💡 RÈGLE FONDAMENTALE</p>
          <p className="info-text">
            Le LAIT reste l'aliment PRINCIPAL jusqu'à 1 an. La diversification est une DÉCOUVERTE,
            pas un remplacement.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DiversificationScreen;
