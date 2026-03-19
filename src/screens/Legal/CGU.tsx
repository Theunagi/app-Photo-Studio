import React from 'react';
import './Legal.css';

interface Props {
  onBack: () => void;
}

const CGU: React.FC<Props> = ({ onBack }) => {
  return (
    <div className="legal-page">
      <div className="legal-container">
        <button className="legal-back" onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Retour
        </button>

        <h1>Conditions G&eacute;n&eacute;rales d'Utilisation</h1>
        <p className="legal-subtitle">Derni&egrave;re mise &agrave; jour : mars 2026</p>

        <h2>1. Objet</h2>
        <p>Les pr&eacute;sentes Conditions G&eacute;n&eacute;rales d'Utilisation (CGU) d&eacute;finissent les modalit&eacute;s d'acc&egrave;s et d'utilisation du service FrameFlow. En cr&eacute;ant un compte, l'Utilisateur accepte sans r&eacute;serve les pr&eacute;sentes CGU.</p>

        <h2>2. Acc&egrave;s au service</h2>
        <p>L'acc&egrave;s au service n&eacute;cessite la cr&eacute;ation d'un compte. L'Utilisateur s'engage &agrave; :</p>
        <ul>
          <li>Fournir des informations exactes et &agrave; jour</li>
          <li>Pr&eacute;server la confidentialit&eacute; de ses identifiants de connexion</li>
          <li>Informer FrameFlow imm&eacute;diatement en cas d'utilisation non autoris&eacute;e de son compte</li>
        </ul>
        <p>L'Utilisateur est seul responsable de toute activit&eacute; effectu&eacute;e depuis son compte.</p>

        <h2>3. Utilisation acceptable</h2>
        <p>L'Utilisateur s'engage &agrave; utiliser le service de mani&egrave;re conforme &agrave; la loi et aux pr&eacute;sentes CGU. Il est strictement interdit de :</p>
        <ul>
          <li>T&eacute;l&eacute;verser des contenus illicites, diffamatoires, pornographiques ou incitant &agrave; la haine</li>
          <li>T&eacute;l&eacute;verser des images portant atteinte aux droits de propri&eacute;t&eacute; intellectuelle de tiers</li>
          <li>Utiliser le service pour g&eacute;n&eacute;rer des contenus trompeurs ou frauduleux (deepfakes, contrefa&ccedil;on)</li>
          <li>Tenter d'acc&eacute;der aux syst&egrave;mes informatiques de FrameFlow de mani&egrave;re non autoris&eacute;e</li>
          <li>Utiliser des robots, scripts ou outils automatis&eacute;s pour acc&eacute;der au service</li>
          <li>Revendre ou sous-licencier l'acc&egrave;s au service sans autorisation</li>
        </ul>

        <h2>4. Propri&eacute;t&eacute; intellectuelle</h2>
        <h3>Contenus de l'Utilisateur</h3>
        <p>L'Utilisateur conserve l'int&eacute;gralit&eacute; de ses droits de propri&eacute;t&eacute; intellectuelle sur les images qu'il t&eacute;l&eacute;verse. En utilisant le service, l'Utilisateur accorde &agrave; FrameFlow une licence limit&eacute;e, non exclusive et temporaire de traiter ces images dans le seul but de fournir le service.</p>

        <h3>Images g&eacute;n&eacute;r&eacute;es</h3>
        <p>Les images g&eacute;n&eacute;r&eacute;es par le service sont la propri&eacute;t&eacute; de l'Utilisateur. Il peut les utiliser librement, y compris &agrave; des fins commerciales (publicit&eacute;, e-commerce, r&eacute;seaux sociaux).</p>

        <h3>Service FrameFlow</h3>
        <p>Le logiciel, les algorithmes, l'interface et le design de FrameFlow sont la propri&eacute;t&eacute; exclusive de <span className="placeholder">[D&eacute;nomination sociale]</span>. L'abonnement conf&egrave;re &agrave; l'Utilisateur un droit d'utilisation personnel, non cessible et non exclusif.</p>

        <h2>5. Disponibilit&eacute; du service</h2>
        <p>FrameFlow s'efforce d'assurer une disponibilit&eacute; continue du service. Toutefois, le service peut &ecirc;tre temporairement interrompu pour des raisons de maintenance, de mise &agrave; jour ou de force majeure. FrameFlow informera les Utilisateurs dans la mesure du possible en cas d'interruption programm&eacute;e.</p>

        <h2>6. Limitation de responsabilit&eacute;</h2>
        <p>FrameFlow ne garantit pas que les r&eacute;sultats g&eacute;n&eacute;r&eacute;s par l'intelligence artificielle seront adapt&eacute;s aux besoins sp&eacute;cifiques de l'Utilisateur. Le service est fourni &laquo; en l'&eacute;tat &raquo;.</p>
        <p>En aucun cas, FrameFlow ne pourra &ecirc;tre tenu responsable des dommages indirects (perte de chiffre d'affaires, perte de donn&eacute;es, atteinte &agrave; l'image) r&eacute;sultant de l'utilisation du service.</p>

        <h2>7. Suspension et r&eacute;siliation</h2>
        <p>FrameFlow se r&eacute;serve le droit de suspendre ou de r&eacute;silier le compte d'un Utilisateur en cas de violation des pr&eacute;sentes CGU, notamment en cas de :</p>
        <ul>
          <li>Utilisation frauduleuse ou abusive du service</li>
          <li>T&eacute;l&eacute;versement de contenus illicites</li>
          <li>Atteinte aux syst&egrave;mes informatiques de FrameFlow</li>
        </ul>
        <p>En cas de suspension, l'Utilisateur sera inform&eacute; par email et pourra pr&eacute;senter ses observations.</p>

        <h2>8. Modification des CGU</h2>
        <p>FrameFlow se r&eacute;serve le droit de modifier les pr&eacute;sentes CGU. Les Utilisateurs seront inform&eacute;s de toute modification substantielle par email ou notification dans l'application, avec un pr&eacute;avis de 15 jours. La poursuite de l'utilisation du service apr&egrave;s ce d&eacute;lai vaut acceptation des nouvelles CGU.</p>

        <h2>9. Loi applicable</h2>
        <p>Les pr&eacute;sentes CGU sont soumises au droit fran&ccedil;ais. Tout litige sera soumis &agrave; la comp&eacute;tence exclusive des tribunaux fran&ccedil;ais.</p>
      </div>
    </div>
  );
};

export default CGU;
