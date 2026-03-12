import React from 'react';
import './Legal.css';

interface Props {
  onBack: () => void;
}

const MentionsLegales: React.FC<Props> = ({ onBack }) => {
  return (
    <div className="legal-page">
      <div className="legal-container">
        <button className="legal-back" onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Retour
        </button>

        <h1>Mentions Légales</h1>
        <p className="legal-subtitle">Dernière mise à jour : mars 2026</p>

        <h2>1. Éditeur du site</h2>
        <p>
          Le site <strong>Photo Studio</strong> est édité par :<br/>
          <span className="placeholder">[Dénomination sociale à compléter]</span><br/>
          Forme juridique : <span className="placeholder">[À compléter]</span><br/>
          Capital social : <span className="placeholder">[À compléter]</span><br/>
          Siège social : <span className="placeholder">[Adresse à compléter]</span><br/>
          RCS : <span className="placeholder">[Numéro RCS à compléter]</span><br/>
          SIRET : <span className="placeholder">[Numéro SIRET à compléter]</span><br/>
          TVA intracommunautaire : <span className="placeholder">[Numéro TVA à compléter]</span><br/>
          Téléphone : <span className="placeholder">[À compléter]</span><br/>
          Email : <span className="placeholder">[À compléter]</span>
        </p>
        <p>
          Directeur de la publication : <span className="placeholder">[Nom du représentant légal à compléter]</span>
        </p>

        <h2>2. Hébergeur</h2>
        <p>
          Le site est hébergé par :<br/>
          <span className="placeholder">[Nom de l'hébergeur à compléter]</span><br/>
          Adresse : <span className="placeholder">[Adresse de l'hébergeur à compléter]</span><br/>
          Téléphone : <span className="placeholder">[Téléphone de l'hébergeur à compléter]</span>
        </p>

        <h2>3. Propriété intellectuelle</h2>
        <p>
          L'ensemble du contenu du site Photo Studio (textes, images, graphismes, logo, icônes, logiciels) est protégé par les lois françaises et internationales relatives à la propriété intellectuelle.
        </p>
        <p>
          Toute reproduction, représentation, modification, publication ou adaptation de tout ou partie du site, quel que soit le moyen ou le procédé utilisé, est interdite sans l'autorisation écrite préalable de l'éditeur.
        </p>

        <h2>4. Protection des données personnelles</h2>
        <p>
          Conformément au Règlement Général sur la Protection des Données (RGPD) et à la loi Informatique et Libertés du 6 janvier 1978 modifiée, vous disposez des droits suivants concernant vos données personnelles :
        </p>
        <ul>
          <li>Droit d'accès, de rectification et d'effacement</li>
          <li>Droit à la limitation du traitement</li>
          <li>Droit à la portabilité des données</li>
          <li>Droit d'opposition</li>
        </ul>
        <p>
          Pour exercer ces droits, vous pouvez nous contacter à l'adresse : <span className="placeholder">[email DPO à compléter]</span>
        </p>
        <p>
          Vous pouvez également introduire une réclamation auprès de la CNIL : <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer">www.cnil.fr</a>
        </p>
        <p>
          Pour plus d'informations, consultez notre <a href="#" onClick={(e) => { e.preventDefault(); }}>Politique de Confidentialité</a>.
        </p>

        <h2>5. Cookies</h2>
        <p>
          Le site utilise des cookies pour assurer son bon fonctionnement et mesurer son audience. Pour en savoir plus, consultez notre <a href="#" onClick={(e) => { e.preventDefault(); }}>Politique de Cookies</a>.
        </p>

        <h2>6. Médiation de la consommation</h2>
        <p>
          Conformément à l'article L.612-1 du Code de la consommation, en cas de litige non résolu, le consommateur peut recourir gratuitement au service de médiation suivant :
        </p>
        <p>
          <span className="placeholder">[Nom du médiateur à compléter]</span><br/>
          <span className="placeholder">[Adresse du médiateur à compléter]</span><br/>
          <span className="placeholder">[Site internet du médiateur à compléter]</span>
        </p>

        <h2>7. Loi applicable</h2>
        <p>
          Les présentes mentions légales sont soumises au droit français. En cas de litige, les tribunaux français seront seuls compétents.
        </p>
      </div>
    </div>
  );
};

export default MentionsLegales;
