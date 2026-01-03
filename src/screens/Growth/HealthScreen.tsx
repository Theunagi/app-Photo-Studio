/**
 * Health/Growth Screen (Web)
 * Module 7: Courbe de Croissance & Dashboard Santé
 */

import React from 'react';
import '../Feeding/FeedingScreen.css';
import './HealthScreen.css';

const HealthScreen: React.FC = () => {
  return (
    <div className="screen">
      <div className="screen-content">
        <h1 className="screen-title">📊 Santé & Croissance</h1>
        <p className="screen-subtitle">
          Dashboard personnalisé et courbes OMS
        </p>

        <div className="card placeholder-card growth">
          <h3 className="placeholder-title-growth">Module Santé - À implémenter</h3>
          <ul className="feature-list">
            <li>• Courbe de poids (OMS)</li>
            <li>• Courbe de taille</li>
            <li>• Indicateurs globaux</li>
            <li>• Tableau de bord santé</li>
            <li>• Messages déculpabilisation</li>
            <li>• Percentiles expliqués</li>
          </ul>
        </div>

        <div className="health-indicators">
          <h3>🎯 Indicateurs de Santé Globale</h3>
          <div className="indicator-grid">
            <div className="indicator-card success">
              <span className="indicator-icon">✓</span>
              <div className="indicator-content">
                <p className="indicator-label">Courbe de poids</p>
                <p className="indicator-value">En progression</p>
              </div>
            </div>
            <div className="indicator-card success">
              <span className="indicator-icon">✓</span>
              <div className="indicator-content">
                <p className="indicator-label">Couches mouillées</p>
                <p className="indicator-value">7/jour</p>
              </div>
            </div>
            <div className="indicator-card success">
              <span className="indicator-icon">✓</span>
              <div className="indicator-content">
                <p className="indicator-label">Éveil & sourires</p>
                <p className="indicator-value">Interactif</p>
              </div>
            </div>
            <div className="indicator-card success">
              <span className="indicator-icon">✓</span>
              <div className="indicator-content">
                <p className="indicator-label">Alimentation</p>
                <p className="indicator-value">Mange à sa faim</p>
              </div>
            </div>
          </div>
          <div className="verdict">
            <p>➜ VERDICT : Bébé va parfaitement bien ✅</p>
          </div>
        </div>

        <div className="info-box growth-info">
          <p className="info-title">💡 100 façons d'être en bonne santé</p>
          <p className="info-text">
            Votre bébé suit SA propre courbe, pas celle du voisin. Un bébé au 10e percentile
            en bonne santé vaut mieux qu'un bébé au 90e malade. La variation individuelle
            est la NORME, pas l'exception.
          </p>
        </div>
      </div>
    </div>
  );
};

export default HealthScreen;
