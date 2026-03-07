'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Leaf, CreditCard, User, ShoppingBasket } from 'lucide-react';
import '../../styles/public/faq.css';

const FAQ_CATEGORIES = [
  {
    id: 'abonnement',
    icon: <Leaf size={22} />,
    title: "L'abonnement",
    items: [
      {
        question: "Comment fonctionne un abonnement AMAP ?",
        answer: "En rejoignant Aux P'tits Pois, vous vous engagez sur une année à recevoir chaque semaine un panier de légumes frais et de saison, cultivés par nos producteurs locaux. Vous venez récupérer votre panier chaque mercredi de 18h15 à 19h15 au point de retrait. C'est un engagement mutuel : vous soutenez le producteur en avance, et il vous garantit des produits de qualité tout au long de l'année."
      },
      {
        question: "Qu'est-ce que le tarif solidaire ?",
        answer: "Le tarif solidaire est une formule à prix réduit destinée aux personnes en situation de précarité financière (bénéficiaires de minima sociaux, étudiants boursiers, etc.). Il permet à tous d'accéder à des produits locaux et bio sans contrainte de budget. Ce tarif est basé sur la confiance — si vous pensez y avoir droit, n'hésitez pas à le sélectionner lors de votre demande d'abonnement."
      },
      {
        question: "Combien de paniers vais-je recevoir par an ?",
        answer: "Vous recevrez 49 paniers par an. L'AMAP ferme 3 semaines dans l'année (congés, jours fériés, etc.), ce qui correspond à 52 semaines moins 3 semaines de fermeture. Vous serez prévenu(e) à l'avance par email et newsletter lors de chaque période de fermeture."
      },
      {
        question: "Puis-je mettre mon abonnement en pause ?",
        answer: "Oui, il est possible de mettre votre abonnement en pause jusqu'à 2 semaines par an, par exemple pour des vacances. La demande se fait auprès de l'équipe de l'AMAP qui gérera la pause depuis l'interface d'administration. Votre compteur de paniers restants est ajusté automatiquement."
      },
    ]
  },
  {
    id: 'panier',
    icon: <ShoppingBasket size={22} />,
    title: "Le contenu du panier",
    items: [
      {
        question: "Les produits sont-ils toujours bio ?",
        answer: "Oui, tous nos producteurs partenaires pratiquent une agriculture biologique ou en conversion vers le bio. Les légumes sont cultivés sans pesticides ni engrais chimiques. Certains producteurs sont certifiés AB (Agriculture Biologique), d'autres s'inscrivent dans une démarche équivalente sans avoir encore la certification officielle."
      },
      {
        question: "Le panier contient-il uniquement des légumes de saison ?",
        answer: "Absolument. Le principe fondateur de l'AMAP est de consommer local et de saison. Le contenu du panier change donc chaque semaine en fonction des récoltes. En hiver vous trouverez carottes, poireaux, courges ; au printemps radis, salades et asperges ; en été tomates, courgettes et haricots. C'est la diversité de la nature au fil des saisons !"
      },
      {
        question: "Qui décide du contenu du panier ?",
        answer: "C'est le producteur qui décide du contenu du panier en fonction de ses récoltes de la semaine. L'AMAP publie chaque semaine la composition du panier sur la page « Panier de la semaine » afin que vous puissiez anticiper vos recettes. Vous pouvez d'ailleurs consulter des suggestions de recettes directement basées sur le panier de la semaine sur notre site."
      },
    ]
  },
  {
    id: 'paiement',
    icon: <CreditCard size={22} />,
    title: "Paiement",
    items: [
      {
        question: "Quels moyens de paiement sont acceptés ?",
        answer: "Le paiement s'effectue uniquement par chèque. Lors de la validation de votre abonnement, vous remettrez vos chèques directement à l'équipe de l'AMAP au point de retrait. Pour un abonnement annuel, vous pouvez régler en plusieurs chèques (généralement mensuels ou trimestriels). Les modalités exactes vous seront précisées à la validation de votre contrat."
      },
    ]
  },
  {
    id: 'compte',
    icon: <User size={22} />,
    title: "Mon compte",
    items: [
      {
        question: "J'ai oublié mon mot de passe, que faire ?",
        answer: "Sur la page de connexion, cliquez sur « Mot de passe oublié ? ». Saisissez votre adresse email et vous recevrez un lien de réinitialisation valable 1 heure. Si vous ne recevez pas l'email, pensez à vérifier vos spams. En cas de problème persistant, contactez-nous directement via la page Contact."
      },
      {
        question: "Comment renouveler mon abonnement ?",
        answer: "Vous recevrez automatiquement un email de rappel 30 jours avant la fin de votre abonnement. Pour renouveler, il vous suffit de faire une nouvelle demande d'abonnement en ligne via la page « Nos Abonnements », ou de contacter directement l'équipe de l'AMAP par email. Votre historique et vos préférences seront conservés."
      },
    ]
  },
];

export default function FaqPage() {
  const [openItems, setOpenItems] = useState({});

  function toggle(categoryId, index) {
    const key = `${categoryId}-${index}`;
    setOpenItems(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function isOpen(categoryId, index) {
    return !!openItems[`${categoryId}-${index}`];
  }

  return (
    <div className="faq-page">
      {/* Hero */}
      <div className="faq-hero">
        <div className="faq-hero-content">
          <h1 className="faq-hero-title">Questions fréquentes</h1>
          <p className="faq-hero-subtitle">
            Tout ce que vous devez savoir sur votre AMAP Aux P&apos;tits Pois
          </p>
        </div>
      </div>

      {/* Contenu */}
      <div className="faq-container">
        {FAQ_CATEGORIES.map(category => (
          <section key={category.id} className="faq-section">
            <div className="faq-section-header">
              <span className="faq-section-icon">{category.icon}</span>
              <h2 className="faq-section-title">{category.title}</h2>
            </div>

            <div className="faq-list">
              {category.items.map((item, index) => {
                const open = isOpen(category.id, index);
                return (
                  <div key={index} className={`faq-item${open ? ' faq-item--open' : ''}`}>
                    <button
                      className="faq-question"
                      onClick={() => toggle(category.id, index)}
                      aria-expanded={open}
                    >
                      <span>{item.question}</span>
                      <ChevronDown size={20} className="faq-chevron" />
                    </button>
                    <div className="faq-answer">
                      <p>{item.answer}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        {/* CTA */}
        <div className="faq-cta">
          <p>Vous ne trouvez pas la réponse à votre question ?</p>
          <Link href="/contact" className="btn btn-primary">
            Contactez-nous
          </Link>
        </div>
      </div>
    </div>
  );
}
