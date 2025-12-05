export default function HowItWorks() {
  const steps = [
    {
      number: '1',
      title: 'Choisissez votre panier',
      description: 'Parcourez nos paniers et sélectionnez celui qui vous convient'
    },
    {
      number: '2',
      title: 'Réservez et payez',
      description: 'Créez votre compte et validez votre commande en ligne'
    },
    {
      number: '3',
      title: 'Récupérez votre panier',
      description: 'Venez chercher votre panier au point de retrait choisi'
    }
  ];

  return (
    <section className="how-it-works">
      <div className="container">
        <div className="section-header">
          <h2 className="section-title">Comment ça marche ?</h2>
          <p className="section-description">
            Commandez vos paniers en 3 étapes simples
          </p>
        </div>

        <div className="steps-grid">
          {steps.map((step, index) => (
            <div key={index} className="step-card">
              <div className="step-number">{step.number}</div>
              <h3 className="step-title">{step.title}</h3>
              <p className="step-description">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}