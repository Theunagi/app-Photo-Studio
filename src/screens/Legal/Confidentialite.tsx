import React from 'react';
import './Legal.css';

interface Props {
  onBack: () => void;
}

const Confidentialite: React.FC<Props> = ({ onBack }) => {
  return (
    <div className="legal-page">
      <div className="legal-container">
        <button className="legal-back" onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Retour
        </button>

        <h1>Politique de Confidentialit&eacute;</h1>
        <p className="legal-subtitle">Derni&egrave;re mise &agrave; jour : mars 2026</p>

        <h2>1. Responsable du traitement</h2>
        <p>
          Le responsable du traitement des donn&eacute;es personnelles est :<br/>
          <span className="placeholder">[D&eacute;nomination sociale &agrave; compl&eacute;ter]</span><br/>
          <span className="placeholder">[Adresse &agrave; compl&eacute;ter]</span><br/>
          Contact : contact@frameflow.design
        </p>

        <h2>2. Donn&eacute;es collect&eacute;es et finalit&eacute;s</h2>
        <table>
          <thead>
            <tr>
              <th>Donn&eacute;es</th>
              <th>Finalit&eacute;</th>
              <th>Base l&eacute;gale</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Nom, pr&eacute;nom, email</td><td>Cr&eacute;ation et gestion du compte</td><td>Ex&eacute;cution du contrat</td></tr>
            <tr><td>Donn&eacute;es de paiement</td><td>Traitement des abonnements (via Stripe)</td><td>Ex&eacute;cution du contrat</td></tr>
            <tr><td>Images t&eacute;l&eacute;vers&eacute;es</td><td>Fourniture du service (g&eacute;n&eacute;ration IA via fal.ai)</td><td>Ex&eacute;cution du contrat</td></tr>
            <tr><td>Donn&eacute;es de connexion (IP, logs)</td><td>S&eacute;curit&eacute; et diagnostic</td><td>Int&eacute;r&ecirc;t l&eacute;gitime</td></tr>
            <tr><td>Cookies analytiques</td><td>Mesure d'audience (Google Analytics)</td><td>Consentement</td></tr>
          </tbody>
        </table>

        <h2>3. Destinataires des donn&eacute;es</h2>
        <p>Vos donn&eacute;es peuvent &ecirc;tre transmises aux sous-traitants suivants, dans le cadre strict de la fourniture du service :</p>
        <ul>
          <li><strong>Supabase Inc.</strong> &mdash; H&eacute;bergement de la base de donn&eacute;es et authentification (serveurs UE)</li>
          <li><strong>Stripe Inc.</strong> &mdash; Traitement s&eacute;curis&eacute; des paiements</li>
          <li><strong>fal.ai</strong> &mdash; Traitement des images par intelligence artificielle</li>
          <li><strong>Google LLC</strong> &mdash; Mesure d'audience (Google Analytics, sous r&eacute;serve de consentement)</li>
          <li><span className="placeholder">[H&eacute;bergeur &agrave; compl&eacute;ter]</span> &mdash; H&eacute;bergement du site web</li>
        </ul>

        <h2>4. Transferts hors Union europ&eacute;enne</h2>
        <p>Certains de nos sous-traitants (Stripe, fal.ai, Google) peuvent traiter des donn&eacute;es en dehors de l'Union europ&eacute;enne, notamment aux &Eacute;tats-Unis. Ces transferts sont encadr&eacute;s par des Clauses Contractuelles Types (CCT) approuv&eacute;es par la Commission europ&eacute;enne, conform&eacute;ment &agrave; l'article 46 du RGPD.</p>

        <h2>5. Dur&eacute;e de conservation</h2>
        <ul>
          <li><strong>Donn&eacute;es de compte :</strong> pendant la dur&eacute;e de la relation contractuelle, puis 3 ans apr&egrave;s la derni&egrave;re activit&eacute;</li>
          <li><strong>Donn&eacute;es de paiement :</strong> conform&eacute;ment aux obligations fiscales et comptables (10 ans)</li>
          <li><strong>Images t&eacute;l&eacute;vers&eacute;es :</strong> pendant la dur&eacute;e de l'abonnement actif, supprim&eacute;es dans les 30 jours suivant la cl&ocirc;ture du compte</li>
          <li><strong>Logs de connexion :</strong> 12 mois (obligation l&eacute;gale)</li>
          <li><strong>Cookies analytiques :</strong> 13 mois maximum</li>
        </ul>

        <h2>6. Vos droits</h2>
        <p>Conform&eacute;ment au RGPD, vous disposez des droits suivants :</p>
        <ul>
          <li><strong>Droit d'acc&egrave;s</strong> (article 15) &mdash; obtenir une copie de vos donn&eacute;es</li>
          <li><strong>Droit de rectification</strong> (article 16) &mdash; corriger vos donn&eacute;es</li>
          <li><strong>Droit &agrave; l'effacement</strong> (article 17) &mdash; supprimer vos donn&eacute;es</li>
          <li><strong>Droit &agrave; la limitation</strong> (article 18) &mdash; restreindre le traitement</li>
          <li><strong>Droit &agrave; la portabilit&eacute;</strong> (article 20) &mdash; r&eacute;cup&eacute;rer vos donn&eacute;es</li>
          <li><strong>Droit d'opposition</strong> (article 21) &mdash; vous opposer au traitement</li>
          <li><strong>Droit de retrait du consentement</strong> &mdash; &agrave; tout moment pour les traitements bas&eacute;s sur le consentement</li>
        </ul>
        <p>Pour exercer ces droits, contactez-nous &agrave; : contact@frameflow.design</p>
        <p>Vous pouvez &eacute;galement introduire une r&eacute;clamation aupr&egrave;s de la CNIL : <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer">www.cnil.fr</a> &mdash; 3 Place de Fontenoy, 75007 Paris.</p>

        <h2>7. S&eacute;curit&eacute;</h2>
        <p>FrameFlow met en &oelig;uvre des mesures techniques et organisationnelles appropri&eacute;es pour prot&eacute;ger vos donn&eacute;es : chiffrement HTTPS, contr&ocirc;le d'acc&egrave;s, sauvegardes r&eacute;guli&egrave;res, h&eacute;bergement s&eacute;curis&eacute;.</p>
        <p>En cas de violation de donn&eacute;es, FrameFlow s'engage &agrave; notifier la CNIL dans les 72 heures et &agrave; informer les personnes concern&eacute;es si la violation est susceptible d'engendrer un risque &eacute;lev&eacute;.</p>

        <h2>8. Utilisation des images</h2>
        <p>Les images t&eacute;l&eacute;vers&eacute;es par le Client sont trait&eacute;es uniquement dans le cadre de la fourniture du service. FrameFlow ne les utilise pas &agrave; d'autres fins (notamment pas pour l'entra&icirc;nement de mod&egrave;les d'IA) sauf consentement explicite du Client.</p>
      </div>
    </div>
  );
};

export default Confidentialite;
