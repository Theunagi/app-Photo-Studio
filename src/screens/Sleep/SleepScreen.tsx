/**
 * Sleep Screen (Web)
 * Module 4: Sommeil & Réveils
 */

import React from 'react';
import '../Feeding/FeedingScreen.css';
import './SleepScreen.css';

const SleepScreen: React.FC = () => {
  return (
    <div className="screen">
      <div className="screen-content">
        <h1 className="screen-title">😴 Sommeil</h1>
        <p className="screen-subtitle">
          Interface contextuelle adaptée à l'âge de bébé
        </p>

        <div className="card placeholder-card sleep">
          <h3 className="placeholder-title-sleep">Module Sommeil - À implémenter</h3>
          <ul className="feature-list">
            <li>• Tracker réveils nuit</li>
            <li>• Timeline sommeil (nuit + siestes)</li>
            <li>• Messages adaptatifs par âge</li>
            <li>• Gestion pleurs du soir</li>
            <li>• Total sommeil quotidien</li>
            <li>• Indicateurs normaux par âge</li>
          </ul>
        </div>

        <div className="age-based-messages">
          <div className="age-card">
            <h4>👶 0-3 mois</h4>
            <p>Réveils toutes les 2-3h sont <strong>physiologiques</strong></p>
          </div>
          <div className="age-card">
            <h4>👶 4-6 mois</h4>
            <p>Horloge biologique se met en place progressivement</p>
          </div>
          <div className="age-card">
            <h4>👶 6+ mois</h4>
            <p>Bébé peut dormir sans manger. Un réveil ≠ forcément faim</p>
          </div>
        </div>

        <div className="info-box sleep-info">
          <p className="info-title">💡 Pleurs du soir (Coliques)</p>
          <p className="info-text">
            Pleurs inconsolables entre 19h-21h sont fréquents entre 3 semaines et 4 mois.
            Ce n'est PAS votre faute. Techniques: portage, bruit blanc, mouvement.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SleepScreen;
