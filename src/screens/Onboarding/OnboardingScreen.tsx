/**
 * Onboarding Screen (Web)
 * First-time user experience - baby profile creation
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import './OnboardingScreen.css';

const OnboardingScreen: React.FC = () => {
  const navigate = useNavigate();

  const handleStart = () => {
    // TODO: Save baby profile
    navigate('/feeding');
  };

  return (
    <div className="onboarding">
      <div className="onboarding-content">
        <div className="onboarding-header">
          <h1 className="onboarding-title">👶 Bienvenue sur BabyGuide</h1>
          <p className="onboarding-subtitle">
            Votre compagnon anti-anxiété pour les 0-3 ans
          </p>
        </div>

        <div className="onboarding-card">
          <h3 className="onboarding-card-title">⚠️ IMPORTANT</h3>
          <p className="disclaimer">
            BabyGuide est un outil d'information et de suivi, <strong>PAS un avis médical</strong>.
          </p>
          <p className="disclaimer">
            En cas de doute, consultez toujours un professionnel de santé.
          </p>
          <div className="emergency-numbers">
            <p>Urgences : <strong>15</strong> (France) / <strong>112</strong> (Europe)</p>
          </div>
        </div>

        <div className="onboarding-features">
          <h3>✨ Ce que BabyGuide fait pour vous</h3>
          <div className="features-grid">
            <div className="feature-item">
              <span className="feature-icon">🍼</span>
              <p>Calculateur intelligent d'alimentation</p>
            </div>
            <div className="feature-item">
              <span className="feature-icon">💩</span>
              <p>Guide visuel des selles normales</p>
            </div>
            <div className="feature-item">
              <span className="feature-icon">😴</span>
              <p>Conseils sommeil adaptés à l'âge</p>
            </div>
            <div className="feature-item">
              <span className="feature-icon">🥕</span>
              <p>Planning diversification personnalisé</p>
            </div>
            <div className="feature-item">
              <span className="feature-icon">📊</span>
              <p>Courbes de croissance OMS</p>
            </div>
            <div className="feature-item">
              <span className="feature-icon">✅</span>
              <p>Système 🟢🟠🔴 pour décisions claires</p>
            </div>
          </div>
        </div>

        <div className="onboarding-cta">
          <h3>Créer le profil de bébé - À implémenter</h3>
          <p>Nom, date de naissance, sexe, photo avatar</p>
          <button className="btn btn-primary" onClick={handleStart}>
            Commencer →
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingScreen;
