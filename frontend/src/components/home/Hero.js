import Link from 'next/link';
import Image from 'next/image';

function Hero() {
  return (
    <section className="hero">
      <div className="container">
        <div className="hero-content">
          <div className="hero-text">
            <h1 className="hero-title">
              Des produits locaux et bio
              <span className="hero-highlight"> livrés près de chez vous</span>
            </h1>
            <p className="hero-description">
              Découvrez nos paniers de fruits et légumes de saison, 
              directement issus de nos producteurs locaux. 
              Soutenez l&apos;agriculture locale et mangez sainement.
            </p>
            <div className="hero-actions">
              <Link href="/paniers" className="btn btn-primary btn-lg">
                Découvrir nos paniers
              </Link>
              <Link href="/producteurs" className="btn btn-outline btn-lg">
                Nos producteurs
              </Link>
            </div>
          </div>
          <div className="hero-image">
            <div className="hero-image-grid">
              <Image 
                src="/icons/carrots.png" 
                alt="Agriculture locale" 
                width={80} 
                height={80}
                className="hero-icon"
              />
              <Image 
                src="/icons/tomato.png" 
                alt="Qualité bio" 
                width={80} 
                height={80}
                className="hero-icon"
              />
              <Image 
                src="/icons/leek.png" 
                alt="Livraison" 
                width={80} 
                height={80}
                className="hero-icon"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Hero;