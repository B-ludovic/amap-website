'use client';

import { Cookie, Settings } from 'lucide-react';
import '../../styles/public/legal.css'

export default function MentionsLegalesPage() {
  const handleOpenCookiePanel = () => {
    if (typeof window !== 'undefined' && window.orejime) {
      window.orejime.prompt();
    }
  };

  return (
    <div className="legal-page">
      <div className="container">
        <h1>Mentions Légales</h1>
        
        <section className="legal-section">
          <h2>Éditeur du site</h2>
          <p>
            <strong>Association Aux P'tits Pois</strong><br />
            Association loi 1901<br />
            Siège social : 14, rue du Château 45300 Yèvre-la-Ville<br />
            Email de contact : auxptitspois@gmail.com
          </p>
          <p>
            <strong>Directrice de la publication :</strong> Kerina DAVIGNY<br />
            <strong>Conception et développement :</strong> Ludovic BATAILLE
          </p>
          <h2>Partenaire Agricole</h2>
          <p>
            L'association collabore avec le producteur suivant pour la fourniture des paniers :
          </p>
          <p>
            <strong>LES TROIS PARCELLES</strong><br />
            Représenté par M. Simon RONCERAY<br />
            14, rue du Château 45300 Yèvre-la-Ville<br />
            SIRET : 815 169 974 000 12<br />
            Téléphone : 06 30 41 28 67<br />
            Email : lestroisparcelles@gmail.com
          </p>
        </section>

        <section className="legal-section">
          <h2>Hébergement</h2>
          <p>
            Le frontend est hébergé par :<br />
            <strong>Vercel Inc.</strong><br />
            340 S Lemon Ave #4133<br />
            Walnut, CA 91789, USA<br />
            Site web : <a href="https://vercel.com" target="_blank" rel="noopener noreferrer">vercel.com</a>
          </p>
          <p>
            Le backend est hébergé par :<br />
            <strong>Render Services, Inc.</strong><br />
            525 Brannan St, Suite 300<br />
            San Francisco, CA 94107, USA<br />
            Site web : <a href="https://render.com" target="_blank" rel="noopener noreferrer">render.com</a>
          </p>
        </section>

        <section id="cookies" className="legal-section">
          <h2 className="legal-section-title-icon">
            <Cookie size={28} aria-hidden="true" />
            Politique de cookies
          </h2>
          
          <h3>Qu'est-ce qu'un cookie ?</h3>
          <p>
            Un cookie est un petit fichier texte déposé sur votre ordinateur lors de la visite d'un site web. 
            Il permet de mémoriser des informations relatives à votre navigation et de vous offrir une expérience personnalisée.
          </p>

          <h3>Cookies utilisés sur notre site</h3>
          
          <h4>1. Cookies strictement nécessaires</h4>
          <p>
            Ces cookies sont indispensables au bon fonctionnement du site et ne peuvent pas être désactivés :
          </p>
          <ul className="legal-list">
            <li><strong>Authentification</strong> : Permettent de vous identifier et d'accéder à votre espace membre</li>
            <li><strong>Panier</strong> : Mémorisent vos sélections de produits</li>
            <li><strong>Sécurité</strong> : Protection contre les attaques et fraudes</li>
            <li><strong>Gestion du consentement</strong> : Cookie <code>orejime</code> — mémorise vos choix concernant les cookies (13 mois)</li>
          </ul>

          <h4>2. Cookies analytiques (optionnels)</h4>
          <p>
            Avec votre consentement, nous utilisons Google Analytics pour comprendre comment vous utilisez notre site. 
            Ces statistiques sont anonymisées et nous aident à améliorer votre expérience.
          </p>

          <h3>Gérer vos préférences</h3>
          <p>
            Vous pouvez à tout moment modifier vos préférences en cliquant sur le bouton ci-dessous :
          </p>
          
          <button
            onClick={handleOpenCookiePanel}
            className="btn btn-primary btn-cookies"
          >
            <Settings size={20} aria-hidden="true" />
            Gérer mes cookies
          </button>

          <h3>Durée de conservation</h3>
          <ul className="legal-list">
            <li>Cookies de session : Supprimés à la fermeture du navigateur</li>
            <li>Cookies de consentement : 13 mois</li>
            <li>Cookies analytiques : 13 mois maximum</li>
          </ul>

          <h3>Vos droits</h3>
          <p>
            Conformément au RGPD, vous disposez d'un droit d'accès, de rectification et de suppression de vos données. 
            Pour exercer ces droits, contactez-nous à : <a href="mailto:auxptitspois@gmail.com">auxptitspois@gmail.com</a>
          </p>
        </section>

        <section className="legal-section">
          <h2>Services tiers</h2>
          <p>
            Ce site fait appel à des services externes pour certaines fonctionnalités :
          </p>
          <ul className="legal-list">
            <li>
              <strong>TheMealDB</strong> (<a href="https://www.themealdb.com" target="_blank" rel="noopener noreferrer">themealdb.com</a>) —
              Base de données de recettes de cuisine. Les recherches d'ingrédients sont transmises à ce service.
              Aucune donnée personnelle n'est envoyée.
            </li>
            <li>
              <strong>Google Translate</strong> — Utilisé côté serveur pour traduire automatiquement
              les noms de recettes et d'ingrédients en français. Les termes de recherche peuvent transiter
              par les serveurs de Google. Aucune donnée personnelle n'est transmise.
            </li>
            <li>
              <strong>Brevo (anciennement Sendinblue)</strong> — Utilisé pour l'envoi des emails transactionnels
              (confirmation d'abonnement, notifications, etc.). Votre adresse email est transmise à ce service
              dans le cadre de l'exécution du contrat.
            </li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>Propriété intellectuelle</h2>
          <p>
            L'ensemble du contenu de ce site (textes, images, logos) est la propriété de l'association Aux P'tits Pois
            et est protégé par les lois sur la propriété intellectuelle.
          </p>
          <p>
            Les icônes de légumes utilisées sur ce site sont issues du projet{' '}
            <a href="https://openmoji.org" target="_blank" rel="noopener noreferrer">OpenMoji</a>,
            publiées sous licence{' '}
            <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a>.
          </p>
        </section>

        <section className="legal-section">
          <h2>Données personnelles</h2>
          <p>
            Les informations collectées sur ce site sont destinées uniquement à la gestion de votre abonnement et des distributions.
            En dehors des services tiers mentionnés ci-dessus (Brevo pour les emails), elles ne sont jamais transmises à des tiers.
          </p>
          <p>
            Conformément au RGPD, vous disposez d'un droit d'accès, de rectification et de suppression de vos données.
          </p>
        </section>
      </div>
    </div>
  );
}