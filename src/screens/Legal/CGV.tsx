import React from 'react';
import './Legal.css';

interface Props {
  onBack: () => void;
}

const CGV: React.FC<Props> = ({ onBack }) => {
  return (
    <div className="legal-page">
      <div className="legal-container">
        <button className="legal-back" onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Retour
        </button>

        <h1>Conditions Générales de Vente</h1>
        <p className="legal-subtitle">Dernière mise à jour : mars 2026</p>

        <h2>1. Objet</h2>
        <p>Les présentes Conditions Générales de Vente (CGV) régissent les relations contractuelles entre <span className="placeholder">[Dénomination sociale]</span> (ci-après « Photo Studio ») et toute personne physique ou morale souscrivant à un abonnement au service Photo Studio (ci-après « le Client »).</p>

        <h2>2. Description du service</h2>
        <p>Photo Studio est un service en ligne (SaaS) de photographie produit assistée par intelligence artificielle. Le service comprend :</p>
        <ul>
          <li>La suppression automatique d'arrière-plans</li>
          <li>La génération d'ombres réalistes</li>
          <li>La génération de scènes lifestyle par IA</li>
          <li>L'export en résolution 2K et 4K</li>
        </ul>

        <h2>3. Formules et tarifs</h2>
        <table>
          <thead>
            <tr>
              <th>Formule</th>
              <th>Prix mensuel TTC</th>
              <th>Crédits inclus</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Starter</td><td>9,90 €</td><td>70 crédits</td></tr>
            <tr><td>Pro</td><td>19,90 €</td><td>180 crédits</td></tr>
            <tr><td>Business</td><td>39,90 €</td><td>420 crédits</td></tr>
          </tbody>
        </table>
        <p>Chaque génération consomme 2 crédits (résolution 2K) ou 3 crédits (résolution 4K). Les crédits non utilisés à la fin du mois en cours ne sont pas reportés sur le mois suivant, sauf mention contraire dans l'offre souscrite.</p>
        <p>Photo Studio se réserve le droit de modifier ses tarifs. Toute modification sera communiquée au Client avec un préavis de 30 jours. Le nouveau tarif s'appliquera à la prochaine période de facturation.</p>

        <h2>4. Souscription et paiement</h2>
        <p>La souscription à un abonnement implique l'acceptation pleine et entière des présentes CGV. Le Client reconnaît en avoir pris connaissance avant toute souscription.</p>
        <p>Le paiement est effectué par carte bancaire via notre prestataire de paiement sécurisé Stripe. Le prélèvement est effectué mensuellement à la date anniversaire de la souscription.</p>

        <h2>5. Durée et renouvellement</h2>
        <p>L'abonnement est souscrit pour une durée d'un mois, renouvelable par tacite reconduction.</p>
        <p>Conformément aux articles L215-1 à L215-5 du Code de la consommation (loi Chatel), Photo Studio informe le Client entre 3 mois et 1 mois avant la date de renouvellement de la possibilité de ne pas reconduire son abonnement.</p>

        <h2>6. Résiliation</h2>
        <p>Le Client peut résilier son abonnement à tout moment depuis son espace personnel, conformément à la loi n°2022-1158 (résiliation en 3 clics). La résiliation prend effet à la fin de la période de facturation en cours.</p>
        <p>Les crédits restants au moment de la résiliation ne sont pas remboursables et ne peuvent être transférés.</p>

        <h2>7. Droit de rétractation</h2>
        <p>Conformément à l'article L.221-18 du Code de la consommation, le Client consommateur dispose d'un délai de 14 jours à compter de la souscription pour exercer son droit de rétractation, sans avoir à justifier de motifs ni à payer de pénalités.</p>
        <p>Toutefois, conformément à l'article L.221-28 du Code de la consommation, si le Client demande expressément que l'exécution du service commence avant la fin du délai de rétractation, il reconnaît perdre son droit de rétractation une fois le service pleinement exécuté.</p>
        <p>Pour exercer ce droit, le Client peut envoyer sa demande par email à : <span className="placeholder">[email à compléter]</span> ou utiliser le formulaire de rétractation ci-dessous.</p>

        <h3>Formulaire type de rétractation</h3>
        <p style={{ background: '#F5F4F0', padding: '16px', borderRadius: '8px', fontSize: '13px' }}>
          À l'attention de <span className="placeholder">[Dénomination sociale, adresse]</span> :<br/><br/>
          Je vous notifie par la présente ma rétractation du contrat portant sur l'abonnement au service Photo Studio.<br/><br/>
          Souscrit le : _______________<br/>
          Nom du Client : _______________<br/>
          Adresse du Client : _______________<br/>
          Date : _______________<br/>
          Signature (en cas de formulaire papier) : _______________
        </p>

        <h2>8. Garantie légale de conformité</h2>
        <p>Conformément aux articles L224-25-1 et suivants du Code de la consommation, le Client bénéficie de la garantie légale de conformité des services numériques. En cas de défaut de conformité, le Client peut obtenir la mise en conformité du service, une réduction du prix ou la résolution du contrat.</p>

        <h2>9. Responsabilité</h2>
        <p>Photo Studio s'engage à fournir le service avec diligence. Toutefois, Photo Studio ne saurait être tenu responsable :</p>
        <ul>
          <li>Des interruptions temporaires du service pour maintenance ou mise à jour</li>
          <li>De la qualité des résultats générés par l'intelligence artificielle</li>
          <li>Des dommages indirects résultant de l'utilisation du service</li>
          <li>Des cas de force majeure au sens de l'article 1218 du Code civil</li>
        </ul>

        <h2>10. Propriété intellectuelle</h2>
        <p>Le Client conserve la pleine propriété des images qu'il téléverse sur la plateforme. Les images générées par le service sont la propriété du Client et peuvent être utilisées librement à des fins commerciales.</p>
        <p>Photo Studio ne conserve pas les images traitées au-delà de la durée nécessaire à la fourniture du service, sauf accord explicite du Client.</p>

        <h2>11. Protection des données</h2>
        <p>Photo Studio traite les données personnelles du Client conformément au RGPD. Pour plus d'informations, consultez notre Politique de Confidentialité.</p>

        <h2>12. Médiation</h2>
        <p>En cas de litige, le Client peut recourir gratuitement au service de médiation :</p>
        <p>
          <span className="placeholder">[Nom du médiateur à compléter]</span><br/>
          <span className="placeholder">[Coordonnées du médiateur à compléter]</span>
        </p>

        <h2>13. Loi applicable</h2>
        <p>Les présentes CGV sont soumises au droit français. Tout litige sera soumis à la compétence exclusive des tribunaux français.</p>
      </div>
    </div>
  );
};

export default CGV;
