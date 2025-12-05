import Image from 'next/image';

export default function WhyUs() {
  const reasons = [
    {
      icon: '/icons/bio.png',
      title: 'Bio et local',
      description: 'Tous nos produits sont issus de l\'agriculture biologique et cultivés localement'
    },
    {
      icon: '/icons/tracteur.png',
      title: 'Soutien aux producteurs',
      description: 'En achetant chez nous, vous soutenez directement nos producteurs locaux'
    },
    {
      icon: '/icons/carrots.png',
      title: 'Produits de saison',
      description: 'Découvrez des fruits et légumes frais cueillis à maturité'
    },
    {
      icon: '/icons/ecologic.png',
      title: 'Écologique',
      description: 'Réduction des intermédiaires et du transport pour moins d\'empreinte carbone'
    }
  ];

  return (
    <section className="why-us">
      <div className="container">
        <div className="section-header">
          <h2 className="section-title">Pourquoi choisir Aux P&apos;tits Pois ?</h2>
        </div>

        <div className="why-us-grid">
          {reasons.map((reason, index) => (
            <div key={index} className="why-us-card">
              <div className="why-us-icon">
                <Image 
                  src={reason.icon} 
                  alt={reason.title}
                  width={60}
                  height={60}
                />
              </div>
              <h3 className="why-us-title">{reason.title}</h3>
              <p className="why-us-description">{reason.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}