import React from 'react';
import './Legal.css';

interface Props {
  onBack: () => void;
}

const Cookies: React.FC<Props> = ({ onBack }) => {
  return (
    <div className="legal-page">
      <div className="legal-container">
        <button className="legal-back" onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Retour
        </button>

        <h1>Politique de Cookies</h1>
        <p className="legal-subtitle">Derni&egrave;re mise &agrave; jour : mars 2026</p>

        <h2>1. Qu'est-ce qu'un cookie ?</h2>
        <p>Un cookie est un petit fichier texte d&eacute;pos&eacute; sur votre terminal (ordinateur, tablette, smartphone) lors de la consultation d'un site internet. Il permet au site de m&eacute;moriser des informations sur votre visite, comme vos pr&eacute;f&eacute;rences de langue ou d'autres param&egrave;tres.</p>

        <h2>2. Cookies utilis&eacute;s sur FrameFlow</h2>

        <h3>Cookies strictement n&eacute;cessaires (sans consentement)</h3>
        <p>Ces cookies sont indispensables au fonctionnement du site et ne peuvent pas &ecirc;tre d&eacute;sactiv&eacute;s :</p>
        <table>
          <thead>
            <tr><th>Cookie</th><th>Finalit&eacute;</th><th>Dur&eacute;e</th></tr>
          </thead>
          <tbody>
            <tr><td>sb-*-auth-token</td><td>Authentification utilisateur (Supabase)</td><td>Session</td></tr>
            <tr><td>cookie_consent</td><td>M&eacute;morisation de votre choix cookies</td><td>6 mois</td></tr>
          </tbody>
        </table>

        <h3>Cookies analytiques (soumis &agrave; consentement)</h3>
        <p>Ces cookies nous permettent de mesurer l'audience du site et d'am&eacute;liorer nos services :</p>
        <table>
          <thead>
            <tr><th>Cookie</th><th>Fournisseur</th><th>Finalit&eacute;</th><th>Dur&eacute;e</th></tr>
          </thead>
          <tbody>
            <tr><td>_ga</td><td>Google Analytics</td><td>Distinction des utilisateurs</td><td>13 mois</td></tr>
            <tr><td>_ga_*</td><td>Google Analytics</td><td>Conservation de l'&eacute;tat de session</td><td>13 mois</td></tr>
          </tbody>
        </table>

        <h2>3. Gestion de vos pr&eacute;f&eacute;rences</h2>
        <p>Lors de votre premi&egrave;re visite, un bandeau cookies vous permet de :</p>
        <ul>
          <li><strong>Tout accepter</strong> — tous les cookies sont activ&eacute;s</li>
          <li><strong>Tout refuser</strong> — seuls les cookies n&eacute;cessaires sont conserv&eacute;s</li>
        </ul>
        <p>Vous pouvez modifier vos pr&eacute;f&eacute;rences &agrave; tout moment en cliquant sur le lien &laquo; G&eacute;rer les cookies &raquo; en pied de page.</p>

        <h2>4. Dur&eacute;e de validit&eacute; du consentement</h2>
        <p>Votre consentement est valable pour une dur&eacute;e de 6 mois. Au-del&agrave;, nous vous demanderons &agrave; nouveau votre accord.</p>

        <h2>5. Comment supprimer les cookies ?</h2>
        <p>Vous pouvez &eacute;galement configurer votre navigateur pour supprimer ou bloquer les cookies :</p>
        <ul>
          <li><a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer">Google Chrome</a></li>
          <li><a href="https://support.mozilla.org/fr/kb/activer-desactiver-cookies" target="_blank" rel="noopener noreferrer">Mozilla Firefox</a></li>
          <li><a href="https://support.apple.com/fr-fr/guide/safari/sfri11471/mac" target="_blank" rel="noopener noreferrer">Safari</a></li>
          <li><a href="https://support.microsoft.com/fr-fr/microsoft-edge/supprimer-les-cookies-dans-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" target="_blank" rel="noopener noreferrer">Microsoft Edge</a></li>
        </ul>

        <h2>6. Contact</h2>
        <p>Pour toute question concernant notre utilisation des cookies, contactez-nous &agrave; : contact@frameflow.design</p>
      </div>
    </div>
  );
};

export default Cookies;
