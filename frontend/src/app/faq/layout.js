import { headers } from 'next/headers';
import JsonLd from '../../components/JsonLd';

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Comment fonctionne un abonnement AMAP ?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: "En rejoignant Aux P'tits Pois, vous vous engagez sur une année à recevoir chaque semaine un panier de légumes frais et de saison, cultivés par nos producteurs partenaires. Vous venez récupérer votre panier chaque mercredi de 18h15 à 19h15 au point de retrait. C'est un engagement mutuel : vous soutenez le producteur en avance, et il vous garantit des produits de qualité tout au long de l'année."
      }
    },
    {
      '@type': 'Question',
      name: "Qu'est-ce que le tarif solidaire ?",
      acceptedAnswer: {
        '@type': 'Answer',
        text: "Le tarif solidaire est une formule à prix réduit destinée aux personnes en situation de précarité financière (bénéficiaires de minima sociaux, étudiants boursiers, etc.). Il permet à tous d'accéder à des produits locaux et bio sans contrainte de budget. Ce tarif est basé sur la confiance — si vous pensez y avoir droit, n'hésitez pas à le sélectionner lors de votre demande d'abonnement."
      }
    },
    {
      '@type': 'Question',
      name: 'Combien de paniers vais-je recevoir par an ?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: "Vous recevrez 49 paniers par an. L'AMAP ferme 3 semaines dans l'année (congés, jours fériés, etc.), ce qui correspond à 52 semaines moins 3 semaines de fermeture. Vous serez prévenu(e) à l'avance par email et newsletter lors de chaque période de fermeture."
      }
    },
    {
      '@type': 'Question',
      name: 'Puis-je mettre mon abonnement en pause ?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: "Oui, il est possible de mettre votre abonnement en pause jusqu'à 2 semaines par an, par exemple pour des vacances. La demande se fait auprès de l'équipe de l'AMAP qui gérera la pause depuis l'interface d'administration. Votre compteur de paniers restants est ajusté automatiquement."
      }
    },
    {
      '@type': 'Question',
      name: 'Les produits sont-ils toujours bio ?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: "Oui, tous nos producteurs partenaires pratiquent une agriculture biologique ou en conversion vers le bio. Les légumes sont cultivés sans pesticides ni engrais chimiques. Certains producteurs sont certifiés AB (Agriculture Biologique), d'autres s'inscrivent dans une démarche équivalente sans avoir encore la certification officielle."
      }
    },
    {
      '@type': 'Question',
      name: 'Le panier contient-il uniquement des légumes de saison ?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: "Absolument. Le principe fondateur de l'AMAP est de consommer local et de saison. Le contenu du panier change donc chaque semaine en fonction des récoltes. En hiver vous trouverez carottes, poireaux, courges ; au printemps radis, salades et asperges ; en été tomates, courgettes et haricots. C'est la diversité de la nature au fil des saisons !"
      }
    },
    {
      '@type': 'Question',
      name: 'Qui décide du contenu du panier ?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: "C'est le producteur qui décide du contenu du panier en fonction de ses récoltes de la semaine. L'AMAP publie chaque semaine la composition du panier sur la page « Panier de la semaine » afin que vous puissiez anticiper vos recettes. Vous pouvez d'ailleurs consulter des suggestions de recettes directement basées sur le panier de la semaine sur notre site."
      }
    },
    {
      '@type': 'Question',
      name: 'Quels moyens de paiement sont acceptés ?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: "Le paiement s'effectue uniquement par chèque. Lors de la validation de votre abonnement, vous remettrez vos chèques directement à l'équipe de l'AMAP au point de retrait. Pour un abonnement annuel, vous pouvez régler en plusieurs chèques (généralement mensuels ou trimestriels). Les modalités exactes vous seront précisées à la validation de votre contrat."
      }
    },
    {
      '@type': 'Question',
      name: "J'ai oublié mon mot de passe, que faire ?",
      acceptedAnswer: {
        '@type': 'Answer',
        text: "Sur la page de connexion, cliquez sur « Mot de passe oublié ? ». Saisissez votre adresse email et vous recevrez un lien de réinitialisation valable 1 heure. Si vous ne recevez pas l'email, pensez à vérifier vos spams. En cas de problème persistant, contactez-nous directement via la page Contact."
      }
    },
    {
      '@type': 'Question',
      name: 'Comment renouveler mon abonnement ?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: "Vous recevrez automatiquement un email de rappel 30 jours avant la fin de votre abonnement. Pour renouveler, il vous suffit de faire une nouvelle demande d'abonnement en ligne via la page « Nos Abonnements », ou de contacter directement l'équipe de l'AMAP par email. Votre historique et vos préférences seront conservés."
      }
    }
  ]
};

export const metadata = {
  title: 'Questions fréquentes',
  description: "Abonnements, contenu des paniers, tarif solidaire, permanences, paiement : les réponses aux questions courantes sur l'AMAP Aux P'tits Pois à Clamart (92140).",
};

export default async function FaqLayout({ children }) {
  const nonce = (await headers()).get('x-nonce') ?? '';

  return (
    <>
      <JsonLd data={faqSchema} nonce={nonce} />
      {children}
    </>
  );
}
