import Link from 'next/link';
import '../../../styles/admin/aide-da.css';

export const metadata = {
  title: 'Aide',
  robots: { index: false, follow: false }
};

const FAMILIES = [
  {
    id: 'semaine',
    title: 'La semaine de distribution',
    lead: 'Les écrans qu’on ouvre le plus souvent, du panier de la semaine à la remise des paniers.',
    screens: [
      {
        title: 'Tableau de bord',
        path: '/admin',
        purpose: 'La page d’accueil de l’administration : l’état de l’AMAP en un coup d’œil.',
        abilities: [
          'Voir le nombre d’adhérents, de contrats en cours, de fermes partenaires et de demandes qui attendent une réponse.',
          'Suivre la liste « à faire cette semaine » : chaque ligne mène droit à l’écran concerné.',
          'Préparer la prochaine distribution : la date, le nombre de paniers, les bénévoles inscrits.',
          'Savoir où en sont les règlements : ce qui est encaissé, ce qui reste à encaisser.'
        ]
      },
      {
        title: 'Panier hebdomadaire',
        path: '/admin/panier-hebdomadaire',
        purpose: 'Ce que les adhérents trouveront dans leur panier cette semaine.',
        abilities: [
          'Relire le panier que le site a composé tout seul pour la semaine, et retrouver celui des semaines passées.',
          'Corriger la composition quand une ferme ne se présente pas : retirer un produit, en prendre un autre au catalogue, ou en écrire un à la main.',
          'Décider, produit par produit, s’il va dans le petit panier, dans le grand, ou dans les deux.',
          'Écrire « le mot de la semaine », le petit message qui accompagne le panier.',
          'Publier un panier que vous avez tiré vous-même — ceux du jeudi sont déjà en ligne. Cette publication-là, elle, prévient les adhérents par email.'
        ],
        hint: 'Chaque jeudi, le site tire le panier parmi les produits de saison des fermes présentes et le met en ligne tout seul. Vous n’avez donc rien à publier, et aucun email hebdomadaire n’est envoyé : les adhérents consultent le panier sur le site. La seule chose à faire ici, c’est corriger la composition si une ferme manque à l’appel.'
      },
      {
        title: 'Distribution',
        path: '/admin/distribution',
        purpose: 'La feuille d’appel du jour de distribution.',
        abilities: [
          'Cocher chaque panier remis : c’est enregistré aussitôt, il n’y a rien à valider ensuite.',
          'Retrouver quelqu’un en tapant son nom, son numéro de contrat, son email ou son téléphone.',
          'Laisser une note sur un panier (« mis de côté », « repris jeudi »).',
          'Exporter la liste dans un fichier tableur, à imprimer avant d’ouvrir la distribution.'
        ],
        hint: 'L’écran ne s’ouvre que si le panier de la semaine a été publié.'
      },
      {
        title: 'Permanences',
        path: '/admin/permanences',
        purpose: 'Les créneaux de bénévoles qui tiennent chaque distribution.',
        abilities: [
          'Créer un créneau : date, horaires, nombre de bénévoles attendus.',
          'Recopier un créneau sur les semaines suivantes plutôt que de tout ressaisir.',
          'Inscrire ou retirer un bénévole à la main, quand quelqu’un s’annonce de vive voix.',
          'Repérer les distributions qui cherchent encore du monde.'
        ],
        hint: 'Les adhérents s’inscrivent eux-mêmes depuis leur espace ; cet écran complète et corrige.'
      }
    ]
  },
  {
    id: 'adherents',
    title: 'Les adhérents et leurs contrats',
    lead: 'De la demande reçue sur le site jusqu’au chèque encaissé.',
    screens: [
      {
        title: 'Utilisateurs',
        path: '/admin/utilisateurs',
        purpose: 'Tous les comptes créés sur le site : adhérents, bénévoles, administrateurs.',
        abilities: [
          'Rechercher quelqu’un par nom, email ou téléphone.',
          'Changer le rôle d’un compte : adhérent, bénévole ou administrateur.',
          'Renvoyer l’email de confirmation à qui n’a jamais validé son adresse.',
          'Supprimer un compte.'
        ],
        hint: 'Le rôle administrateur donne accès à toute cette administration : à confier avec parcimonie. La relance de l’email de confirmation reste un dépannage : l’adhérent peut la demander lui-même depuis la page de connexion, voir « Quand quelqu’un n’arrive pas à se connecter » en bas de cette page.'
      },
      {
        title: 'Demandes d’abonnements',
        path: '/admin/demandes-abonnements',
        purpose: 'Les inscriptions envoyées depuis le site, en attente d’une réponse.',
        abilities: [
          'Lire la demande : formule choisie, taille du panier, tarif, message, coordonnées.',
          'Écrire une remarque interne, que seule l’équipe voit.',
          'Télécharger le contrat déjà rempli, à faire signer.',
          'Accepter : le contrat est créé en attente de règlement et l’adhérent reçoit son email de confirmation.',
          'Refuser une demande, en gardant la trace de la décision.'
        ]
      },
      {
        title: 'Abonnements',
        path: '/admin/abonnements',
        purpose: 'Tous les contrats, en cours ou terminés.',
        abilities: [
          'Filtrer par état (actif, en attente, en pause, résilié) et par formule.',
          'Ouvrir une fiche : retraits déjà faits, retraits restants, pauses posées, point de retrait.',
          'Enregistrer les chèques reçus, en une, deux ou quatre fois — le contrat devient alors actif.',
          'Corriger une saisie de chèque erronée.',
          'Mettre un contrat en pause (deux semaines par contrat au maximum), puis le reprendre.',
          'Résilier un contrat, ou rouvrir le contrat signé au format PDF.'
        ]
      },
      {
        title: 'Trésorerie',
        path: '/admin/tresorerie',
        purpose: 'Tous les chèques de l’association, rangés du plus proche au plus lointain.',
        abilities: [
          'Voir d’un coup d’œil ce qui est en main, en retard, en banque et déjà encaissé.',
          'Sélectionner plusieurs chèques et les passer ensemble « déposés en banque », puis « encaissés ».',
          'Signaler un chèque rejeté : le contrat concerné redevient dû d’autant.',
          'Retrouver un chèque par adhérent, par numéro de contrat ou par numéro de chèque.'
        ]
      }
    ]
  },
  {
    id: 'fermes',
    title: 'Les fermes et les produits',
    lead: 'Ce qui alimente les paniers, et ce que le site public montre des producteurs.',
    screens: [
      {
        title: 'Demandes producteurs',
        path: '/admin/demandes-producteurs',
        purpose: 'Les fermes qui proposent de rejoindre l’AMAP.',
        abilities: [
          'Lire la candidature : exploitation, production, certification, lieu, disponibilités.',
          'Noter l’avis de l’équipe sur la candidature.',
          'Accepter, laisser en attente ou refuser.'
        ],
        hint: 'Accepter ici ne crée pas la fiche de la ferme : elle se remplit ensuite dans Producteurs.'
      },
      {
        title: 'Producteurs',
        path: '/admin/producteurs',
        purpose: 'Les fermes partenaires, telles qu’elles apparaissent sur le site.',
        abilities: [
          'Créer ou modifier une fiche : nom, commune, distance, spécialité, certification, photo, contact.',
          'Rendre une ferme visible sur le site public, ou la masquer.',
          'Déclarer une absence sur une période (congés, récolte manquée), avec son motif.'
        ],
        hint: 'Pendant une absence, les produits de cette ferme sont écartés du tirage : le panier n’annonce que ce qui peut vraiment arriver.'
      },
      {
        title: 'Produits',
        path: '/admin/produits',
        purpose: 'Le catalogue dans lequel les paniers sont composés.',
        abilities: [
          'Ajouter un produit : nom, catégorie, ferme d’origine, description.',
          'Indiquer ses saisons et les formats de panier où il a le droit d’entrer.',
          'Le rendre disponible, ou l’écarter sans le supprimer.',
          'Filtrer le catalogue par ferme ou par catégorie.'
        ]
      }
    ]
  },
  {
    id: 'messages',
    title: 'Parler aux adhérents',
    lead: 'Tout ce qui sort du site vers les boîtes mail des adhérents, et tout ce qui en revient.',
    screens: [
      {
        title: 'Messages de contact',
        path: '/admin/messages',
        purpose: 'Les messages envoyés depuis le formulaire de contact du site.',
        abilities: [
          'Lire les messages, les non lus en premier.',
          'Répondre par email : le bouton ouvre votre logiciel de messagerie, sujet déjà rempli.',
          'Marquer un message comme lu, l’archiver, ou le supprimer.'
        ]
      },
      {
        title: 'Communication',
        path: '/admin/communication',
        purpose: 'Les newsletters envoyées aux adhérents.',
        abilities: [
          'Rédiger un message mis en forme : gras, italique, titres, listes.',
          'Choisir à qui il part : tous les adhérents, les abonnés actifs, le tarif solidaire, ou un envoi de test.',
          'Envoyer tout de suite, programmer pour plus tard, ou garder en brouillon.',
          'Annuler une programmation, ou supprimer un brouillon.'
        ]
      },
      {
        title: 'Suivi des emails',
        path: '/admin/emails',
        purpose: 'Savoir si les messages du site arrivent vraiment à destination.',
        abilities: [
          'Voir sur les trente derniers jours ce qui est parti, ce qui n’est jamais arrivé, ce qui a été signalé comme indésirable.',
          'Repérer les adresses écartées : des boîtes que le service d’envoi considère comme mortes.',
          'Remettre une adresse en service une fois corrigée avec l’adhérent.',
          'Chercher dans le journal des envois si telle personne a bien reçu tel email.'
        ],
        hint: 'Une adresse qui n’existe plus renvoie chaque message d’où il vient. Insister ne sert à rien — personne ne lit derrière — et à force, les grandes messageries prennent l’AMAP pour un expéditeur douteux et rangent tous ses emails dans les indésirables, y compris ceux qui arrivaient bien. D’où la mise à l’écart de ces adresses.'
      },
      {
        title: 'Fermetures AMAP',
        path: '/admin/fermetures',
        purpose: 'Les semaines sans distribution : congés, jours fériés, empêchement.',
        abilities: [
          'Déclarer une période de fermeture, avec son motif.',
          'Prévenir les adhérents par newsletter, envoyée automatiquement à la création comme à la modification.',
          'Suivre les jours de fermeture déjà consommés sur le quota de l’année.'
        ],
        hint: 'Aucun panier n’est tiré sur une semaine fermée : le tirage automatique passe son tour.'
      }
    ]
  },
  {
    id: 'coulisses',
    title: 'En coulisse',
    lead: 'Deux écrans qu’on ouvre rarement, mais qu’il vaut mieux connaître.',
    screens: [
      {
        title: 'Journal d’audit',
        path: '/admin/journal',
        purpose: 'La trace de ce que les administrateurs ont fait dans l’administration.',
        abilities: [
          'Voir qui a fait quoi, quand, et sur quel adhérent ou quel contrat.',
          'Ne garder que les actions critiques, ou seulement les importantes.'
        ],
        hint: 'Le journal s’écrit tout seul et ne se modifie pas : c’est là qu’on regarde en cas de doute sur une manipulation.'
      },
      {
        title: 'Paramètres',
        path: '/admin/parametres',
        purpose: 'Les quelques réglages de la plateforme.',
        abilities: [
          'Supprimer les données d’exemple installées pour les essais : fermes, produits et points de retrait fictifs.'
        ],
        hint: 'Rien qui touche aux tarifs, aux données des adhérents ou à la facturation n’est réglable ici.'
      }
    ]
  }
];

/* Les questions qui arrivent par téléphone ou sur le stand, et la réponse à
   donner sans avoir à ouvrir l'administration. */
const SITUATIONS = [
  {
    question: 'Je n’ai pas reçu l’email de confirmation.',
    answer: 'Le site sait le renvoyer tout seul. Sur la page de connexion, après une tentative avec une adresse non confirmée, un message propose « faites-vous en renvoyer un ». L’adresse directe, à dicter au téléphone, est auxptitspois.fr/auth/renvoyer-confirmation. Avant de relancer, faites regarder dans les courriers indésirables : c’est là qu’ils atterrissent neuf fois sur dix. Le site n’accepte qu’un renvoi toutes les cinq minutes, inutile d’insister entre-temps.'
  },
  {
    question: 'Le lien de confirmation dit qu’il a expiré.',
    answer: 'C’est normal passé vingt-quatre heures : chaque lien a une durée de vie, faute de quoi une vieille boîte mail piratée rouvrirait un compte des mois plus tard. La page qui annonce l’échec propose un bouton « Recevoir un nouveau lien », il n’y a rien d’autre à faire.'
  },
  {
    question: 'Le lien ouvre une page qui réclame un code d’accès.',
    answer: 'Tant que le site n’est pas ouvert au public, toutes ses pages sont derrière le code d’invitation, y compris les liens de confirmation. Le code est retenu sur l’appareil qui l’a saisi : quelqu’un qui s’inscrit sur son ordinateur puis ouvre le lien sur son téléphone retombe donc sur la porte. Il faut entrer le code une fois sur ce téléphone, puis rouvrir le lien. Cette question disparaîtra d’elle-même à l’ouverture publique.'
  },
  {
    question: 'La personne assure n’avoir jamais rien reçu, même après relance.',
    answer: 'Ouvrez Utilisateurs et relisez l’adresse enregistrée, lettre à lettre : une faute de frappe à l’inscription envoie tous les messages dans le vide. Une adresse ne se corrige pas depuis l’administration ; dans ce cas, supprimez le compte et faites refaire l’inscription avec la bonne adresse.'
  }
];

export default function AdminAidePage() {
  return (
    <div className="admin-help">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-title">Aide</h1>
          <p className="admin-title-lead">
            Une carte par écran de l’administration : à quoi il sert, et ce qu’on peut y faire.
            Aucune connaissance technique n’est nécessaire pour s’en servir.
          </p>
        </div>
      </div>

      <nav className="admin-help-summary" aria-label="Familles d’écrans">
        {FAMILIES.map((family) => (
          <a key={family.id} href={`#${family.id}`} className="admin-pill">
            {family.title}
          </a>
        ))}
        <a href="#connexion" className="admin-pill">
          Problèmes de connexion
        </a>
      </nav>

      {FAMILIES.map((family) => (
        <section key={family.id} id={family.id} className="admin-help-family">
          <div className="admin-help-family-head">
            <h2 className="admin-help-family-title">{family.title}</h2>
            <p className="admin-help-family-lead">{family.lead}</p>
          </div>

          <div className="admin-help-grid">
            {family.screens.map((screen) => (
              <article key={screen.path} className="admin-help-card">
                <h3 className="admin-help-card-title">{screen.title}</h3>

                <div className="admin-help-card-body">
                  <p className="admin-help-card-purpose">{screen.purpose}</p>

                  <span className="admin-mono-label admin-help-card-label">Ce qu’on y fait</span>
                  <ul className="admin-help-list">
                    {screen.abilities.map((ability) => (
                      <li key={ability}>{ability}</li>
                    ))}
                  </ul>

                  {screen.hint && (
                    <p className="admin-help-hint">
                      <span className="admin-mono-label">Bon à savoir</span>
                      {screen.hint}
                    </p>
                  )}
                </div>

                <Link href={screen.path} className="admin-btn-link admin-help-card-link">
                  Ouvrir {screen.title} <span aria-hidden="true">→</span>
                </Link>
              </article>
            ))}
          </div>
        </section>
      ))}

      <section id="connexion" className="admin-help-family">
        <div className="admin-help-family-head">
          <h2 className="admin-help-family-title">Quand quelqu’un n’arrive pas à se connecter</h2>
          <p className="admin-help-family-lead">
            Un compte ne s’ouvre qu’une fois l’adresse email confirmée. Voici ce qui bloque
            le plus souvent, et la réponse à donner.
          </p>
        </div>

        <dl className="admin-help-situations">
          {SITUATIONS.map((situation) => (
            <div key={situation.question} className="admin-help-situation">
              <dt className="admin-help-situation-question">{situation.question}</dt>
              <dd className="admin-help-situation-answer">{situation.answer}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="admin-help-closing">
        <h2 className="admin-help-closing-title">Une question qui n’a pas sa réponse ici ?</h2>
        <p className="admin-help-closing-note">
          Écrivez à l’équipe qui maintient le site,{' '}
          <a className="admin-help-mail" href="mailto:contact@lechoppeducode.com">
            contact@lechoppeducode.com
          </a>{' '}
          : cette page grandira au fil des questions posées.
        </p>
      </section>
    </div>
  );
}
